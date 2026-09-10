import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./store.ts";
import { DEMO_REQUIREMENTS, CATALOG } from "./fixtures.ts";
import { buildProposal } from "./matching.ts";
import type { NexusState } from "./types.ts";
import * as svc from "./service.ts";

let idc = 0;
const rid = () => `req-${++idc}`;

function seed(): NexusState {
  const base = initialState();
  const requirements = DEMO_REQUIREMENTS.map((r, i) => ({
    ...r,
    id: `req-demo-${i + 1}`,
    project_id: base.project.id,
    document_id: "doc-1",
  }));
  const proposal = buildProposal(requirements, CATALOG, base.project.id, "doc-1");
  return { ...base, requirements, proposal };
}

function designer() {
  return { actor: "designer-demo", role: "project_designer" as const, requestId: rid() };
}
function logistics() {
  return { actor: "logistics-demo", role: "logistics" as const, requestId: rid() };
}

function mustOk(r: svc.ServiceResult): NexusState {
  assert.equal(r.ok, true, r.ok ? "" : `esperaba ok, obtuve ${r.code}: ${r.error}`);
  return (r as { state: NexusState }).state;
}

test("flujo cantidad 20 -> ticket 25 -> aceptar -> 25, versión+1, idempotente", () => {
  let st = seed();
  st = mustOk(svc.createSelection(designer(), st));
  assert.equal(st.selection!.version, 1);

  const inodoros = st.selection_items.find((i) => i.quantity === 20)!;
  assert.ok(inodoros, "debe existir un ítem con cantidad 20");

  // Logística pide 25
  const crCmd = { ...logistics(), type: "change_quantity" as const, payload: { kind: "change_quantity" as const, quantity: 25 }, itemId: inodoros.id, reason: "obra creció", baseVersion: 1 };
  st = mustOk(svc.createChangeRequest(crCmd, st));
  assert.equal(st.selection_items.find((i) => i.id === inodoros.id)!.quantity, 20, "sigue 20");
  assert.equal(st.selection!.version, 1, "versión intacta");
  const cr = st.change_requests[0];
  assert.equal(cr.status, "pending");

  // Proyectista acepta
  const acceptCmd = { ...designer(), expectedVersion: 1, changeRequestId: cr.id };
  st = mustOk(svc.acceptChangeRequest(acceptCmd, st));
  assert.equal(st.selection_items.find((i) => i.id === inodoros.id)!.quantity, 25);
  assert.equal(st.selection!.version, 2);
  assert.equal(st.change_requests[0].status, "accepted");

  // Repetir la MISMA aceptación (mismo requestId) no cambia nada
  const before = JSON.stringify(st);
  const replay = svc.acceptChangeRequest(acceptCmd, st);
  assert.equal(replay.ok, true);
  assert.equal(JSON.stringify(mustOk(replay)), before, "replay idempotente");
});

test("rechazar un ticket conserva ítems y versión", () => {
  let st = seed();
  st = mustOk(svc.createSelection(designer(), st));
  const item = st.selection_items[0];
  st = mustOk(
    svc.createChangeRequest(
      { ...logistics(), type: "change_priority", payload: { kind: "change_priority", priority: "high" }, itemId: item.id, reason: "urgente", baseVersion: 1 },
      st,
    ),
  );
  const cr = st.change_requests[0];
  const versionBefore = st.selection!.version;
  st = mustOk(svc.rejectChangeRequest({ ...designer(), changeRequestId: cr.id, note: "sin sustento" }, st));
  assert.equal(st.change_requests[0].status, "rejected");
  assert.equal(st.change_requests[0].resolution_note, "sin sustento");
  assert.equal(st.selection!.version, versionBefore);
  assert.equal(st.selection_items[0].priority, item.priority);
});

test("ticket sobre versión obsoleta -> conflicto y sigue pending", () => {
  let st = seed();
  st = mustOk(svc.createSelection(designer(), st));
  const item = st.selection_items[0];

  // ticket creado sobre v1
  st = mustOk(
    svc.createChangeRequest(
      { ...logistics(), type: "change_quantity", payload: { kind: "change_quantity", quantity: 9 }, itemId: item.id, reason: "ajuste", baseVersion: 1 },
      st,
    ),
  );
  const cr = st.change_requests[0];

  // el Proyectista edita: la versión sube a 2
  st = mustOk(svc.editItem({ ...designer(), expectedVersion: 1, itemId: item.id, patch: { priority: "medium" } }, st));
  assert.equal(st.selection!.version, 2);

  // aceptar el ticket viejo -> conflicto
  const res = svc.acceptChangeRequest({ ...designer(), expectedVersion: 2, changeRequestId: cr.id }, st);
  assert.equal(res.ok, false);
  assert.equal((res as { code: string }).code, "conflict");
  assert.equal(st.change_requests[0].status, "pending");
});

test("aceptar con expectedVersion equivocada -> conflicto sin mutación", () => {
  let st = seed();
  st = mustOk(svc.createSelection(designer(), st));
  const item = st.selection_items.find((i) => i.quantity === 20)!;
  st = mustOk(
    svc.createChangeRequest(
      { ...logistics(), type: "change_quantity", payload: { kind: "change_quantity", quantity: 25 }, itemId: item.id, reason: "x", baseVersion: 1 },
      st,
    ),
  );
  const cr = st.change_requests[0];
  const res = svc.acceptChangeRequest({ ...designer(), expectedVersion: 99, changeRequestId: cr.id }, st);
  assert.equal(res.ok, false);
  assert.equal((res as { code: string }).code, "conflict");
});

test("finalizar bloqueado con ticket pending; se desbloquea al resolver todo", () => {
  let st = seed();
  st = mustOk(svc.createSelection(designer(), st));

  // resolver cualquier revisión pendiente
  for (const it of st.selection_items.filter((i) => i.review_status === "needs_review")) {
    st = mustOk(
      svc.resolveReview({ ...designer(), expectedVersion: st.selection!.version, itemId: it.id, note: "uso demostrativo" }, st),
    );
  }

  // un ticket pending bloquea
  st = mustOk(
    svc.createChangeRequest(
      { ...logistics(), type: "change_quantity", payload: { kind: "change_quantity", quantity: 21 }, itemId: st.selection_items[0].id, reason: "x", baseVersion: st.selection!.version },
      st,
    ),
  );
  let res = svc.finalizeSelection({ ...designer(), expectedVersion: st.selection!.version }, st);
  assert.equal(res.ok, false);
  assert.ok((res as { blockers: string[] }).blockers.some((b) => b.includes("ticket")));

  // rechazar el ticket y finalizar
  st = mustOk(svc.rejectChangeRequest({ ...designer(), changeRequestId: st.change_requests[0].id, note: "no" }, st));
  res = svc.finalizeSelection({ ...designer(), expectedVersion: st.selection!.version }, st);
  st = mustOk(res);
  assert.equal(st.selection!.status, "finalized");
  assert.equal(st.selection!.finalized_by_role, "project_designer");
});
