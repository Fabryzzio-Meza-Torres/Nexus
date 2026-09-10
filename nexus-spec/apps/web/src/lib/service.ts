// Servicio único de acciones. Valida matriz de permisos + estado + versión
// ANTES de tocar nada. Cada mutación calcula el estado siguiente completo y lo
// devuelve entero (atomicidad local). Idempotencia por requestId.
//
// specs/technical-architecture.md, specs/roles-requirements-matrix.md,
// specs/data-model.md (sección Transacciones), specs/features/*.
import type {
  NexusState,
  Role,
  Selection,
  SelectionItem,
  ChangeRequest,
  ChangeRequestPayload,
  ChangeRequestType,
  ActivityLog,
  Priority,
  Requirement,
  Location,
} from "./types.ts";
import { CATALOG, catalogById } from "./fixtures.ts";
import {
  candidatesFor,
  withDistances,
  rankRecommended,
  norm,
} from "./matching.ts";

export type ErrorCode =
  | "forbidden"
  | "invalid_state"
  | "conflict"
  | "not_found"
  | "validation";

export type CmdBase = { actor: string; role: Role; requestId: string };

export type ServiceResult =
  | { ok: true; state: NexusState; note?: string }
  | { ok: false; code: ErrorCode; error: string; state: NexusState; blockers?: string[] };

// ---- Matriz de permisos centralizada (roles-requirements-matrix.md) ----
const CAN: Record<string, Role[]> = {
  createSelection: ["project_designer"],
  editItem: ["project_designer"],
  addItem: ["project_designer"],
  removeItem: ["project_designer"],
  createChangeRequest: ["logistics"],
  acceptChangeRequest: ["project_designer"],
  rejectChangeRequest: ["project_designer"],
  resolveReview: ["project_designer"],
  resolveCoverage: ["project_designer"],
  finalizeSelection: ["project_designer"],
  setProjectLocation: ["project_designer"],
};

function now(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function fail(
  state: NexusState,
  code: ErrorCode,
  error: string,
  blockers?: string[],
): ServiceResult {
  return { ok: false, code, error, state, blockers };
}

function guardRole(cmd: CmdBase, name: keyof typeof CAN, state: NexusState): ServiceResult | null {
  if (!CAN[name].includes(cmd.role)) {
    return fail(state, "forbidden", `El rol ${cmd.role} no puede ejecutar ${name}.`);
  }
  return null;
}

/** Devuelve el resultado ya emitido si este requestId se procesó antes. */
function replayGuard(cmd: CmdBase, state: NexusState): ServiceResult | null {
  if (state.processed_request_ids.includes(cmd.requestId)) {
    return { ok: true, state, note: "idempotent-replay" };
  }
  return null;
}

type LogInput = {
  selection_id?: string | null;
  action: string;
  entity_id: string;
  before: unknown;
  after: unknown;
};

function commit(
  state: NexusState,
  cmd: CmdBase,
  patch: Partial<NexusState>,
  log: LogInput,
): ServiceResult {
  const entry: ActivityLog = {
    id: uuid(),
    project_id: state.project.id,
    selection_id: log.selection_id ?? state.selection?.id ?? null,
    actor_id: cmd.actor,
    actor_role: cmd.role,
    request_id: cmd.requestId,
    created_at: now(),
    action: log.action,
    entity_id: log.entity_id,
    before: log.before ?? null,
    after: log.after ?? null,
  };
  const next: NexusState = {
    ...state,
    ...patch,
    activity_log: [...state.activity_log, entry],
    processed_request_ids: [...state.processed_request_ids, cmd.requestId],
  };
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------

function projectLoc(state: NexusState): { latitude: number; longitude: number } | null {
  return state.project.project_location
    ? {
        latitude: state.project.project_location.latitude,
        longitude: state.project.project_location.longitude,
      }
    : null;
}

function requirementById(state: NexusState, id: string): Requirement | undefined {
  return state.requirements.find((r) => r.id === id);
}

function itemById(state: NexusState, id: string): SelectionItem | undefined {
  return state.selection_items.find((i) => i.id === id);
}

/** Recalcula score/razones/revisión de un ítem contra su(s) requerimiento(s). */
function rescore(state: NexusState, item: SelectionItem): Pick<
  SelectionItem,
  "compatibility_score" | "match_reasons" | "review_status" | "review_note" | "resolved_by" | "resolved_by_role"
> {
  const req = item.requirement_ids
    .map((rid) => requirementById(state, rid))
    .find(Boolean);
  const cat = catalogById(item.catalog_item_id);
  if (!req || !cat) {
    return {
      compatibility_score: 0,
      match_reasons: [],
      review_status: "needs_review",
      review_note: null,
      resolved_by: null,
      resolved_by_role: null,
    };
  }
  const c = candidatesFor(req, [cat])[0];
  return {
    compatibility_score: c.compatibility_score,
    match_reasons: c.reasons,
    review_status: c.needs_review ? "needs_review" : "clear",
    review_note: null,
    resolved_by: null,
    resolved_by_role: null,
  };
}

// =========================================================================
// createSelection — Proyectista crea la lista oficial desde la propuesta.
// =========================================================================
export function createSelection(
  cmd: CmdBase & {
    catalogItemIdsByRequirement?: Record<string, string>;
    onlyRequirementIds?: string[];
  },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "createSelection", state);
  if (g) return g;

  if (state.selection) {
    return fail(state, "invalid_state", "Ya existe una lista oficial para este proyecto.");
  }
  if (!state.proposal || state.proposal.candidates.length === 0) {
    return fail(state, "invalid_state", "No hay propuesta para crear la lista.");
  }

  const selectionId = uuid();
  const withD = withDistances(state.proposal.candidates, CATALOG, projectLoc(state));

  // agrupar candidatos por conjunto de requerimientos y elegir el mejor (Recomendados)
  const groups = new Map<string, typeof withD>();
  for (const c of withD) {
    const key = c.requirement_ids.slice().sort().join(",");
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }

  const items: SelectionItem[] = [];
  for (const [key, cands] of groups.entries()) {
    const reqIds = key.split(",");
    if (cmd.onlyRequirementIds && !reqIds.some((r) => cmd.onlyRequirementIds!.includes(r))) continue;
    const override = cmd.catalogItemIdsByRequirement?.[reqIds[0]];
    const chosen = override
      ? cands.find((c) => c.catalog_item_id === override) ?? rankRecommended(cands)[0]
      : rankRecommended(cands)[0];
    const req = requirementById(state, reqIds[0]);
    // requerimiento sin cantidad conocida: no bloquea la lista, se asume 1 (editable)
    const qty = req?.quantity && req.quantity > 0 ? req.quantity : 1;
    items.push({
      id: uuid(),
      selection_id: selectionId,
      catalog_item_id: chosen.catalog_item_id,
      requirement_ids: reqIds,
      quantity: qty,
      unit: req?.unit ?? "unidad",
      priority: "normal",
      compatibility_score: chosen.compatibility_score,
      match_reasons: chosen.reasons,
      review_status: chosen.needs_review ? "needs_review" : "clear",
      review_note: null,
      resolved_by: null,
      resolved_by_role: null,
      created_at: now(),
      updated_at: now(),
    });
  }

  if (items.length === 0) {
    return fail(state, "invalid_state", "No hay ningún producto que elegir para la lista.");
  }

  const selection: Selection = {
    id: selectionId,
    project_id: state.project.id,
    status: "draft",
    version: 1,
    created_by: cmd.actor,
    created_by_role: "project_designer",
    created_at: now(),
    finalized_by: null,
    finalized_by_role: null,
    finalized_at: null,
    coverage_resolutions: [],
  };

  return commit(
    state,
    cmd,
    { selection, selection_items: items },
    {
      selection_id: selectionId,
      action: "selection.create",
      entity_id: selectionId,
      before: null,
      after: { version: 1, items: items.length },
    },
  );
}

// =========================================================================
// editItem / addItem / removeItem — edición directa del Proyectista (draft).
// =========================================================================
export function editItem(
  cmd: CmdBase & {
    expectedVersion: number;
    itemId: string;
    patch: Partial<Pick<SelectionItem, "quantity" | "unit" | "priority">> & {
      catalog_item_id?: string;
      requirement_ids?: string[];
    };
  },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "editItem", state);
  if (g) return g;

  const draftErr = requireDraft(state);
  if (draftErr) return draftErr;
  const verErr = requireVersion(state, cmd.expectedVersion);
  if (verErr) return verErr;

  const item = itemById(state, cmd.itemId);
  if (!item) return fail(state, "not_found", "El ítem no existe en la lista.");

  const changesProduct =
    cmd.patch.catalog_item_id !== undefined && cmd.patch.catalog_item_id !== item.catalog_item_id;
  const changesReqs =
    cmd.patch.requirement_ids !== undefined &&
    cmd.patch.requirement_ids.join(",") !== item.requirement_ids.join(",");

  if (cmd.patch.catalog_item_id && !catalogById(cmd.patch.catalog_item_id)) {
    return fail(state, "not_found", "El producto de reemplazo no existe en el catálogo.");
  }
  if (cmd.patch.quantity !== undefined && !(cmd.patch.quantity > 0)) {
    return fail(state, "validation", "La cantidad debe ser positiva.");
  }

  let updated: SelectionItem = {
    ...item,
    ...cmd.patch,
    catalog_item_id: cmd.patch.catalog_item_id ?? item.catalog_item_id,
    requirement_ids: cmd.patch.requirement_ids ?? item.requirement_ids,
    updated_at: now(),
  };

  // duplicado UNIQUE(selection_id, catalog_item_id, unit)
  const dup = state.selection_items.some(
    (i) =>
      i.id !== item.id &&
      i.catalog_item_id === updated.catalog_item_id &&
      i.unit === updated.unit,
  );
  if (dup) return fail(state, "validation", "Ya existe un ítem con ese producto y unidad.");

  if (changesProduct || changesReqs) {
    updated = { ...updated, ...rescore({ ...state, selection_items: [] }, updated) };
  }

  return bumpAndCommit(
    state,
    cmd,
    {
      selection_items: state.selection_items.map((i) => (i.id === item.id ? updated : i)),
    },
    {
      action: "item.edit",
      entity_id: item.id,
      before: item,
      after: updated,
    },
  );
}

export function addItem(
  cmd: CmdBase & {
    expectedVersion: number;
    catalog_item_id: string;
    requirement_ids: string[];
    quantity: number;
    unit: string;
    priority: Priority;
  },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "addItem", state);
  if (g) return g;
  const draftErr = requireDraft(state);
  if (draftErr) return draftErr;
  const verErr = requireVersion(state, cmd.expectedVersion);
  if (verErr) return verErr;

  if (!catalogById(cmd.catalog_item_id)) {
    return fail(state, "not_found", "El producto no existe en el catálogo.");
  }
  if (!(cmd.quantity > 0)) return fail(state, "validation", "La cantidad debe ser positiva.");
  const dup = state.selection_items.some(
    (i) => i.catalog_item_id === cmd.catalog_item_id && i.unit === cmd.unit,
  );
  if (dup) return fail(state, "validation", "Ya existe un ítem con ese producto y unidad.");

  const base: SelectionItem = {
    id: uuid(),
    selection_id: state.selection!.id,
    catalog_item_id: cmd.catalog_item_id,
    requirement_ids: cmd.requirement_ids,
    quantity: cmd.quantity,
    unit: cmd.unit,
    priority: cmd.priority,
    compatibility_score: 0,
    match_reasons: [],
    review_status: "needs_review",
    review_note: null,
    resolved_by: null,
    resolved_by_role: null,
    created_at: now(),
    updated_at: now(),
  };
  const scored = { ...base, ...rescore({ ...state, selection_items: [] }, base) };

  return bumpAndCommit(
    state,
    cmd,
    { selection_items: [...state.selection_items, scored] },
    { action: "item.add", entity_id: scored.id, before: null, after: scored },
  );
}

export function removeItem(
  cmd: CmdBase & { expectedVersion: number; itemId: string },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "removeItem", state);
  if (g) return g;
  const draftErr = requireDraft(state);
  if (draftErr) return draftErr;
  const verErr = requireVersion(state, cmd.expectedVersion);
  if (verErr) return verErr;

  const item = itemById(state, cmd.itemId);
  if (!item) return fail(state, "not_found", "El ítem no existe.");

  return bumpAndCommit(
    state,
    cmd,
    {
      selection_items: state.selection_items.filter((i) => i.id !== item.id),
      // tickets que apuntaban a este ítem: FK -> null + conservan snapshot
      change_requests: state.change_requests.map((cr) =>
        cr.selection_item_id === item.id
          ? { ...cr, selection_item_id: null, target_snapshot: cr.target_snapshot ?? item }
          : cr,
      ),
    },
    { action: "item.remove", entity_id: item.id, before: item, after: null },
  );
}

// =========================================================================
// change requests
// =========================================================================
export function createChangeRequest(
  cmd: CmdBase & {
    type: ChangeRequestType;
    payload: ChangeRequestPayload;
    itemId: string | null;
    reason: string;
    baseVersion: number;
  },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "createChangeRequest", state);
  if (g) return g;

  if (!state.selection || state.selection.status !== "draft") {
    return fail(state, "invalid_state", "Se requiere una lista oficial en borrador.");
  }
  if (!cmd.reason.trim()) return fail(state, "validation", "El motivo es obligatorio.");

  if (cmd.type !== "add_product") {
    if (!cmd.itemId) return fail(state, "validation", "El ticket requiere un ítem objetivo.");
    const target = itemById(state, cmd.itemId);
    if (!target) return fail(state, "not_found", "El ítem objetivo no existe en esta lista.");
  }
  const validation = validatePayload(cmd.type, cmd.payload, state);
  if (validation) return fail(state, "validation", validation);

  const target = cmd.itemId ? itemById(state, cmd.itemId) ?? null : null;
  const cr: ChangeRequest = {
    id: uuid(),
    selection_id: state.selection.id,
    selection_item_id: cmd.itemId,
    requested_by: cmd.actor,
    requested_by_role: "logistics",
    type: cmd.type,
    requested_value: cmd.payload,
    reason: cmd.reason.trim(),
    status: "pending",
    base_selection_version: cmd.baseVersion,
    resolved_by: null,
    resolved_by_role: null,
    resolution_note: null,
    created_at: now(),
    resolved_at: null,
    target_snapshot: target,
  };

  // NO toca selection_items ni version
  return commit(
    state,
    cmd,
    { change_requests: [...state.change_requests, cr] },
    {
      selection_id: state.selection.id,
      action: `ticket.create.${cmd.type}`,
      entity_id: cr.id,
      before: null,
      after: { type: cmd.type, reason: cr.reason },
    },
  );
}

export function acceptChangeRequest(
  cmd: CmdBase & { expectedVersion: number; changeRequestId: string },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay; // doble aceptación -> resultado existente, sin repetir cambio
  const g = guardRole(cmd, "acceptChangeRequest", state);
  if (g) return g;

  // --- todo dentro del "lock" ---
  if (!state.selection || state.selection.status !== "draft") {
    return fail(state, "invalid_state", "La lista no está en borrador.");
  }
  const cr = state.change_requests.find((c) => c.id === cmd.changeRequestId);
  if (!cr) return fail(state, "not_found", "El ticket no existe.");
  if (cr.status !== "pending") {
    return fail(state, "invalid_state", `El ticket ya está ${cr.status}.`);
  }
  if (cmd.expectedVersion !== state.selection.version) {
    return fail(state, "conflict", "La vista está desactualizada; el ticket sigue pendiente.");
  }
  if (cr.base_selection_version !== state.selection.version) {
    return fail(
      state,
      "conflict",
      "El ticket se creó sobre una versión anterior de la lista; sigue pendiente.",
    );
  }

  const applied = applyPayload(cr, state);
  if ("error" in applied) return fail(state, applied.code, applied.error);

  const resolvedCr: ChangeRequest = {
    ...cr,
    status: "accepted",
    resolved_by: cmd.actor,
    resolved_by_role: "project_designer",
    resolved_at: now(),
  };

  return bumpAndCommit(
    state,
    cmd,
    {
      selection_items: applied.items,
      change_requests: state.change_requests.map((c) => (c.id === cr.id ? resolvedCr : c)),
    },
    {
      selection_id: state.selection.id,
      action: `ticket.accept.${cr.type}`,
      entity_id: cr.id,
      before: applied.before,
      after: applied.after,
    },
  );
}

export function rejectChangeRequest(
  cmd: CmdBase & { changeRequestId: string; note: string },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "rejectChangeRequest", state);
  if (g) return g;

  const cr = state.change_requests.find((c) => c.id === cmd.changeRequestId);
  if (!cr) return fail(state, "not_found", "El ticket no existe.");
  if (cr.status !== "pending") return fail(state, "invalid_state", `El ticket ya está ${cr.status}.`);
  if (!cmd.note.trim()) return fail(state, "validation", "El rechazo requiere un motivo.");

  const rejected: ChangeRequest = {
    ...cr,
    status: "rejected",
    resolved_by: cmd.actor,
    resolved_by_role: "project_designer",
    resolution_note: cmd.note.trim(),
    resolved_at: now(),
  };

  // conserva ítems y versión
  return commit(
    state,
    cmd,
    { change_requests: state.change_requests.map((c) => (c.id === cr.id ? rejected : c)) },
    {
      selection_id: cr.selection_id,
      action: `ticket.reject.${cr.type}`,
      entity_id: cr.id,
      before: { status: "pending" },
      after: { status: "rejected", note: rejected.resolution_note },
    },
  );
}

// =========================================================================
// review + coverage + finalize + project location
// =========================================================================
export function resolveReview(
  cmd: CmdBase & { expectedVersion: number; itemId: string; note: string },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "resolveReview", state);
  if (g) return g;
  const draftErr = requireDraft(state);
  if (draftErr) return draftErr;
  const verErr = requireVersion(state, cmd.expectedVersion);
  if (verErr) return verErr;

  const item = itemById(state, cmd.itemId);
  if (!item) return fail(state, "not_found", "El ítem no existe.");
  if (item.review_status !== "needs_review") {
    return fail(state, "invalid_state", "El ítem no está en revisión.");
  }
  if (!cmd.note.trim()) return fail(state, "validation", "La resolución requiere una nota.");

  const resolved: SelectionItem = {
    ...item,
    review_status: "resolved",
    review_note: cmd.note.trim(),
    resolved_by: cmd.actor,
    resolved_by_role: "project_designer",
    updated_at: now(),
  };

  return bumpAndCommit(
    state,
    cmd,
    { selection_items: state.selection_items.map((i) => (i.id === item.id ? resolved : i)) },
    { action: "review.resolve", entity_id: item.id, before: item, after: resolved },
  );
}

export function resolveCoverage(
  cmd: CmdBase & { expectedVersion: number; requirementId: string; reason: string },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "resolveCoverage", state);
  if (g) return g;
  const draftErr = requireDraft(state);
  if (draftErr) return draftErr;
  const verErr = requireVersion(state, cmd.expectedVersion);
  if (verErr) return verErr;
  if (!cmd.reason.trim()) return fail(state, "validation", "Se requiere justificación.");

  const resolution = {
    requirement_id: cmd.requirementId,
    reason: cmd.reason.trim(),
    resolved_by: cmd.actor,
    resolved_at: now(),
  };
  return bumpAndCommit(
    state,
    cmd,
    {
      selection: {
        ...state.selection!,
        coverage_resolutions: [
          ...state.selection!.coverage_resolutions.filter(
            (r) => r.requirement_id !== cmd.requirementId,
          ),
          resolution,
        ],
      },
    },
    { action: "coverage.resolve", entity_id: cmd.requirementId, before: null, after: resolution },
  );
}

export function finalizeSelection(
  cmd: CmdBase & { expectedVersion: number },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "finalizeSelection", state);
  if (g) return g;
  const draftErr = requireDraft(state);
  if (draftErr) return draftErr;
  const verErr = requireVersion(state, cmd.expectedVersion);
  if (verErr) return verErr;

  const blockers = finalizeBlockers(state);
  if (blockers.length > 0) {
    return fail(state, "invalid_state", "La lista no está lista para finalizar.", blockers);
  }

  const finalized: Selection = {
    ...state.selection!,
    status: "finalized",
    version: state.selection!.version + 1,
    finalized_by: cmd.actor,
    finalized_by_role: "project_designer",
    finalized_at: now(),
  };

  return commit(
    state,
    cmd,
    { selection: finalized },
    {
      selection_id: finalized.id,
      action: "selection.finalize",
      entity_id: finalized.id,
      before: { status: "draft", version: state.selection!.version },
      after: { status: "finalized", version: finalized.version },
    },
  );
}

export function setProjectLocation(
  cmd: CmdBase & { location: Location },
  state: NexusState,
): ServiceResult {
  const replay = replayGuard(cmd, state);
  if (replay) return replay;
  const g = guardRole(cmd, "setProjectLocation", state);
  if (g) return g;
  if (state.selection && state.selection.status === "finalized") {
    return fail(state, "invalid_state", "La lista está finalizada; no se cambia la ubicación.");
  }

  return commit(
    state,
    cmd,
    { project: { ...state.project, project_location: cmd.location } },
    {
      action: "project.location",
      entity_id: state.project.id,
      before: state.project.project_location,
      after: cmd.location,
    },
  );
}

// =========================================================================
// helpers de estado / versión
// =========================================================================
function requireDraft(state: NexusState): ServiceResult | null {
  if (!state.selection) return fail(state, "invalid_state", "No existe lista oficial.");
  if (state.selection.status !== "draft") {
    return fail(state, "invalid_state", "La lista finalizada es inmutable.");
  }
  return null;
}

function requireVersion(state: NexusState, expected: number): ServiceResult | null {
  if (state.selection && state.selection.version !== expected) {
    return fail(
      state,
      "conflict",
      `Versión esperada ${expected} pero la lista está en ${state.selection.version}.`,
    );
  }
  return null;
}

/** Incrementa la versión de la selección y hace commit atómico. */
function bumpAndCommit(
  state: NexusState,
  cmd: CmdBase,
  patch: Partial<NexusState>,
  log: LogInput,
): ServiceResult {
  const sel = patch.selection ?? state.selection!;
  const bumped: Selection = { ...sel, version: sel.version + 1 };
  return commit(state, cmd, { ...patch, selection: bumped }, log);
}

export function finalizeBlockers(state: NexusState): string[] {
  const b: string[] = [];
  if (!state.selection) return ["No existe lista oficial."];
  if (state.selection_items.length === 0) b.push("La lista está vacía.");
  const pending = state.change_requests.filter((c) => c.status === "pending");
  if (pending.length > 0) b.push(`Hay ${pending.length} ticket(s) pendiente(s).`);
  const inReview = state.selection_items.filter((i) => i.review_status === "needs_review");
  if (inReview.length > 0) b.push(`Hay ${inReview.length} ítem(s) en revisión técnica.`);
  const badQty = state.selection_items.filter((i) => !(i.quantity > 0) || !i.unit);
  if (badQty.length > 0) b.push(`Hay ${badQty.length} ítem(s) con cantidad/unidad inválida.`);

  const covered = new Set<string>();
  for (const i of state.selection_items) for (const r of i.requirement_ids) covered.add(r);
  const resolved = new Set(state.selection.coverage_resolutions.map((r) => r.requirement_id));
  const missing = state.requirements.filter((r) => !covered.has(r.id) && !resolved.has(r.id));
  if (missing.length > 0) {
    b.push(
      `Cobertura pendiente: ${missing.map((m) => m.type_name).join(", ")}.`,
    );
  }
  return b;
}

// =========================================================================
// payloads de tickets
// =========================================================================
function validatePayload(
  type: ChangeRequestType,
  payload: ChangeRequestPayload,
  state: NexusState,
): string | null {
  switch (type) {
    case "add_product": {
      if (payload.kind !== "add_product") return "Payload no coincide con el tipo.";
      if (!catalogById(payload.catalog_item_id)) return "Producto inexistente.";
      if (!(payload.quantity > 0)) return "Cantidad no positiva.";
      if (
        state.selection_items.some(
          (i) => i.catalog_item_id === payload.catalog_item_id && i.unit === payload.unit,
        )
      ) {
        return "Destino duplicado: ese producto y unidad ya están en la lista.";
      }
      return null;
    }
    case "replace_product": {
      if (payload.kind !== "replace_product") return "Payload no coincide con el tipo.";
      if (!catalogById(payload.catalog_item_id)) return "Producto de reemplazo inexistente.";
      return null;
    }
    case "change_quantity":
      if (payload.kind !== "change_quantity") return "Payload no coincide con el tipo.";
      return payload.quantity > 0 ? null : "Cantidad no positiva.";
    case "change_priority":
      return payload.kind === "change_priority" ? null : "Payload no coincide con el tipo.";
    case "remove_product":
      return payload.kind === "remove_product" ? null : "Payload no coincide con el tipo.";
  }
}

type ApplyResult =
  | { items: SelectionItem[]; before: unknown; after: unknown }
  | { error: string; code: ErrorCode };

function applyPayload(cr: ChangeRequest, state: NexusState): ApplyResult {
  const items = state.selection_items;
  const payload = cr.requested_value;

  if (payload.kind === "add_product") {
    if (
      items.some(
        (i) => i.catalog_item_id === payload.catalog_item_id && i.unit === payload.unit,
      )
    ) {
      return { error: "Destino duplicado.", code: "validation" };
    }
    const base: SelectionItem = {
      id: uuid(),
      selection_id: state.selection!.id,
      catalog_item_id: payload.catalog_item_id,
      requirement_ids: payload.requirement_ids,
      quantity: payload.quantity,
      unit: payload.unit,
      priority: payload.priority,
      compatibility_score: 0,
      match_reasons: [],
      review_status: "needs_review",
      review_note: null,
      resolved_by: null,
      resolved_by_role: null,
      created_at: now(),
      updated_at: now(),
    };
    const scored = { ...base, ...rescore({ ...state, selection_items: [] }, base) };
    return { items: [...items, scored], before: null, after: scored };
  }

  // resto requiere ítem objetivo vivo
  const target = cr.selection_item_id ? items.find((i) => i.id === cr.selection_item_id) : undefined;
  if (!target) {
    return {
      error: "El ítem objetivo del ticket fue eliminado; el ticket no es aceptable.",
      code: "not_found",
    };
  }

  switch (payload.kind) {
    case "remove_product":
      return {
        items: items.filter((i) => i.id !== target.id),
        before: target,
        after: null,
      };
    case "change_quantity": {
      const updated = { ...target, quantity: payload.quantity, updated_at: now() };
      return {
        items: items.map((i) => (i.id === target.id ? updated : i)),
        before: { quantity: target.quantity },
        after: { quantity: updated.quantity },
      };
    }
    case "change_priority": {
      const updated = { ...target, priority: payload.priority, updated_at: now() };
      return {
        items: items.map((i) => (i.id === target.id ? updated : i)),
        before: { priority: target.priority },
        after: { priority: updated.priority },
      };
    }
    case "replace_product": {
      const cat = catalogById(payload.catalog_item_id);
      if (!cat) return { error: "Producto de reemplazo inexistente.", code: "not_found" };
      if (
        items.some(
          (i) =>
            i.id !== target.id &&
            i.catalog_item_id === payload.catalog_item_id &&
            i.unit === target.unit,
        )
      ) {
        return { error: "Destino duplicado.", code: "validation" };
      }
      // conserva cantidad/unidad/prioridad/refs; recalcula score y revisión
      const replaced: SelectionItem = {
        ...target,
        catalog_item_id: payload.catalog_item_id,
        updated_at: now(),
      };
      const scored = { ...replaced, ...rescore({ ...state, selection_items: [] }, replaced) };
      return {
        items: items.map((i) => (i.id === target.id ? scored : i)),
        before: { catalog_item_id: target.catalog_item_id },
        after: { catalog_item_id: scored.catalog_item_id },
      };
    }
    default:
      return { error: "Tipo de ticket no soportado.", code: "validation" };
  }
}

// re-export util para la UI
export { norm };
