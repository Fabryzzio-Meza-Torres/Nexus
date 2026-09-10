"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Check,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type {
  NexusState,
  Role,
  Requirement,
  ChangeRequestType,
  ChangeRequestPayload,
  Priority,
  MatchCandidate,
} from "@/lib/types";
import { CATALOG, catalogById } from "@/lib/fixtures";
import { loadState, saveState, resetState } from "@/lib/store";
import { buildProposal, withDistances, rankRecommended, rankNearest } from "@/lib/matching";
import * as svc from "@/lib/service";
import { haversineKm, formatKm } from "@/lib/distance";
import { AnalysisOverlay, ANALYSIS_TOTAL_MS } from "@/components/AnalysisOverlay";

// ---------------------------------------------------------------------------
const ACTORS: Record<Role, string> = {
  logistics: "logistics-demo",
  project_designer: "designer-demo",
  site_resident: "resident-demo",
};
const ROLE_LABEL: Record<Role, string> = {
  logistics: "Logística",
  project_designer: "Proyectista",
  site_resident: "Residente",
};
const TICKET_LABEL: Record<ChangeRequestType, string> = {
  add_product: "Agregar producto",
  remove_product: "Eliminar producto",
  replace_product: "Reemplazar producto",
  change_quantity: "Cambiar cantidad",
  change_priority: "Cambiar prioridad",
};
// El contrato interno usa high|medium|normal; en pantalla se muestra Alta|Media|Baja.
const PRIO_ORDER: Priority[] = ["high", "medium", "normal"];
const PRIO_LABEL: Record<Priority, string> = { high: "Alta", medium: "Media", normal: "Baja" };
const STAGES = ["Documento", "Propuesta", "Lista oficial", "Finalizada"] as const;

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Run = <C>(
  fn: (cmd: C & svc.CmdBase, st: NexusState) => svc.ServiceResult,
  cmd: C,
) => svc.ServiceResult;

function compatClass(s: number) {
  return s >= 80 ? "hi" : s >= 60 ? "mid" : "lo";
}

// Qué "pide" la revisión técnica para un ítem (simulado, determinista por id).
function reviewSuggestion(it: NexusState["selection_items"][number]): {
  label: string;
  patch: { quantity: number } | { priority: Priority } | null;
  note: string;
} {
  const seed = it.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const kind = seed % 3;
  if (kind === 0) {
    const target = Math.max(it.quantity + 5, Math.ceil((it.quantity * 1.25) / 5) * 5);
    return {
      label: `La revisión recomienda ajustar la cantidad de ${it.quantity} a ${target} ${it.unit} por merma de obra y repuestos.`,
      patch: { quantity: target },
      note: `Cantidad ajustada a ${target} ${it.unit} por recomendación de revisión técnica.`,
    };
  }
  if (kind === 1) {
    const next: Priority = it.priority === "normal" ? "medium" : "high";
    return {
      label: `La revisión recomienda subir la prioridad a ${PRIO_LABEL[next]}: el ítem está en la ruta crítica de la instalación.`,
      patch: { priority: next },
      note: `Prioridad elevada a ${PRIO_LABEL[next]} por revisión técnica.`,
    };
  }
  return {
    label: `La revisión pide que el Proyectista confirme el uso demostrativo de las especificaciones. No cambia el producto.`,
    patch: null,
    note: `Uso demostrativo de las especificaciones confirmado por el Proyectista.`,
  };
}

// ===========================================================================
export default function DemoPage() {
  const [state, setState] = useState<NexusState | null>(null);
  const [role, setRole] = useState<Role>("logistics");
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [docName, setDocName] = useState("");
  const [ranking, setRanking] = useState<"recommended" | "nearest">("recommended");
  const [catFilter, setCatFilter] = useState("");
  const [supFilter, setSupFilter] = useState("");

  useEffect(() => setState(loadState()), []);

  if (!state) {
    return (
      <div className="wrap" style={{ paddingTop: 48 }}>
        <div className="skeleton" style={{ width: 220 }} />
        <div className="skeleton" style={{ width: "55%" }} />
      </div>
    );
  }
  const s = state;
  const persist = (n: NexusState) => {
    setState(n);
    saveState(n);
  };

  const run: Run = (fn, cmd) => {
    const res = fn({ actor: ACTORS[role], role, requestId: uuid(), ...cmd } as never, s);
    if (res.ok) {
      persist(res.state);
      setError(null);
      setBlockers([]);
    } else {
      setError(res.error);
      setBlockers(res.blockers ?? []);
    }
    return res;
  };

  const version = s.selection?.version ?? 0;
  const projLoc = s.project.project_location;

  async function analyze(payload: { file?: File; text?: string; example?: boolean }) {
    setError(null);
    setAnalyzing(true);
    setDocName(
      payload.file?.name ??
        (payload.example ? "Expediente técnico de ejemplo" : "Contenido pegado"),
    );
    const form = new FormData();
    if (payload.file) form.append("file", payload.file);
    if (payload.text) form.append("text", payload.text);
    if (payload.example) form.append("example", "true");
    const t0 = Date.now();
    try {
      const r = await fetch("/api/extract", { method: "POST", body: form });
      const data = await r.json();
      const left = ANALYSIS_TOTAL_MS - (Date.now() - t0);
      if (left > 0) await sleep(left);
      if (!r.ok) {
        setError(data.error ?? "No se pudo analizar el documento.");
        return;
      }
      const reqs: Requirement[] = data.requirements ?? [];
      const proposal =
        reqs.length > 0
          ? buildProposal(reqs, CATALOG, s.project.id, reqs[0].document_id)
          : null;
      persist({
        ...s,
        requirements: reqs,
        proposal,
        extraction_source:
          data.source === "gemini"
            ? "gemini"
            : data.source === "demo"
              ? "demo"
              : payload.example
                ? "ejemplo"
                : "parser",
        extraction_notice: data.notice ?? null,
      });
    } catch {
      setError("Error de red al analizar. Puedes reintentar.");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    const fresh = resetState();
    setState(fresh);
    setError(null);
    setBlockers([]);
  }

  // Resuelve la revisión técnica en un clic. apply=true aplica lo que "pide" la
  // revisión simulada (ajusta cantidad/prioridad); apply=false la desestima sin
  // cambiar el ítem. Operaciones atómicas encadenadas sobre el estado nuevo.
  function resolveReviewAction(item: NexusState["selection_items"][number], apply: boolean) {
    const sug = reviewSuggestion(item);
    const base = { actor: ACTORS[role], role };
    let st = s;
    if (apply && sug.patch) {
      const r = svc.editItem(
        { ...base, requestId: uuid(), expectedVersion: st.selection!.version, itemId: item.id, patch: sug.patch },
        st,
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      st = r.state;
    }
    const note = apply
      ? sug.note
      : "Revisión desestimada por el Proyectista: el ítem se mantiene como está.";
    const r2 = svc.resolveReview(
      { ...base, requestId: uuid(), expectedVersion: st.selection!.version, itemId: item.id, note },
      st,
    );
    if (!r2.ok) {
      setError(r2.error);
      return;
    }
    persist(r2.state);
    setError(null);
    setBlockers([]);
  }

  const stage: (typeof STAGES)[number] = s.selection
    ? s.selection.status === "finalized"
      ? "Finalizada"
      : "Lista oficial"
    : s.requirements.length > 0
      ? "Propuesta"
      : "Documento";
  const stageIdx = STAGES.indexOf(stage);

  const candDist = s.proposal ? withDistances(s.proposal.candidates, CATALOG, projLoc) : [];

  // ---- pantalla de carga ----
  if (s.requirements.length === 0 && !analyzing) {
    return (
      <div className="page">
        <AnalysisOverlay open={analyzing} docName={docName} />
        <div className="wrap">
          <div className="appbar" style={{ position: "static", background: "transparent", border: 0 }}>
            <div className="row">
              <div className="brand">
                <span className="mark">N</span>
                <div>
                  <div className="name">Nexus</div>
                  <div className="sub">Expediente → decisión de compra</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="screen">
          <div className="screen-inner">
            <p className="kicker">Paso 1 de 3 · Carga del expediente</p>
            <h2 style={{ maxWidth: "15em", marginBottom: 10 }}>
              Sube el expediente técnico y Nexus identifica qué hay que cotizar.
            </h2>
            <p className="muted" style={{ maxWidth: "42em", marginBottom: 26 }}>
              La IA interpreta la obra; Nexus busca esos requerimientos contra productos que
              existen en su catálogo, con proveedor y distancia. Tú decides qué comprar.
            </p>

            {role !== "logistics" && (
              <div className="callout">
                <Info size={15} />
                En el flujo real, Logística carga el expediente. Aquí puedes hacerlo desde cualquier rol para probar la demo.
              </div>
            )}
            <UploadZone analyzing={analyzing} onAnalyze={analyze} />

            <div className="tagrow">
              <span className="tag tag-neutral">Catálogo activo · {CATALOG.length} ofertas</span>
              <span className="tag tag-neutral">60 tipos · 3 marcas por tipo</span>
              <span className="tag tag-neutral">3 proveedores demo con ubicación</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const openCount = s.selection_items.filter((i) => i.review_status === "needs_review").length;
  const readyCount = s.selection_items.length - openCount;

  return (
    <div className="page">
      <AnalysisOverlay open={analyzing} docName={docName} />

      <header className="appbar">
        <div className="wrap">
          <div className="row">
            <div className="brand">
              <span className="mark">N</span>
              <div>
                <div className="name">Nexus</div>
                <div className="sub">{s.project.is_demo_data ? "Demo" : "Proyecto"}</div>
              </div>
            </div>
            <div className="docref">
              <FileText size={14} />
              <span>
                {s.project.name} ·{" "}
                {projLoc ? `${projLoc.district ?? projLoc.city}, ${projLoc.city}` : "sin ubicación"}
              </span>
            </div>
            <div className="inline">
              <span className="muted" style={{ fontSize: 12 }}>Viendo como</span>
              <div className="seg" role="group" aria-label="Rol activo">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <button
                    key={r}
                    aria-pressed={role === r}
                    onClick={() => {
                      setRole(r);
                      setError(null);
                      setBlockers([]);
                    }}
                  >
                    {ROLE_LABEL[r]}
                    {r === "project_designer" && openCount > 0 && (
                      <span className="tag tag-accent" style={{ padding: "1px 6px" }}>{openCount}</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                title="Borra el estado guardado en este navegador y empieza de cero"
                onClick={() => {
                  if (confirm("¿Reiniciar la demo? Se borra el estado guardado en este navegador (no el catálogo).")) reset();
                }}
              >
                <RotateCcw size={13} /> Reiniciar demo
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ paddingBottom: 70 }}>
        <div className="stepper" aria-label="Etapas del flujo">
          {STAGES.map((st, i) => (
            <div key={st} className={`st ${i < stageIdx ? "done" : ""} ${i === stageIdx ? "active" : ""}`}>
              <span className="n">{i < stageIdx ? "✓" : i + 1}</span>
              {st}
            </div>
          ))}
        </div>

        <div className="cols">
          <div>
            {error && (
              <div className="callout danger">
                <AlertTriangle size={15} />
                <div>
                  {error}
                  {blockers.length > 0 && (
                    <ul className="blockers">
                      {blockers.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {s.selection?.status === "finalized" && (
              <div className="banner">
                <Check size={18} /> Aceptada por Proyectista · Lista lista para cotizar
              </div>
            )}

            {s.selection && (
              <div className="panel">
                <div className="pb">
                  <div className="statband">
                    <div className="s">
                      <div className="big-num">{s.requirements.length}</div>
                      <div className="lbl">partidas leídas</div>
                    </div>
                    <div className="s">
                      <div className="big-num">
                        {s.requirements.length - (s.proposal?.unmatched_requirement_ids.length ?? 0)}
                      </div>
                      <div className="lbl">con match</div>
                    </div>
                    <div className="s">
                      <div className="big-num ok">{readyCount}</div>
                      <div className="lbl">listos para cotizar</div>
                    </div>
                    <div className="s">
                      <div className="big-num accent">{openCount}</div>
                      <div className="lbl">en revisión técnica</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DocumentPanel state={s} analyzing={analyzing} onAnalyze={analyze} onReset={reset} />

            {s.selection && (
              <OfficialListPanel state={s} role={role} version={version} run={run} resolveReviewAction={resolveReviewAction} />
            )}

            {s.requirements.length > 0 && s.selection?.status !== "finalized" && (
              <ProposalPanel
                state={s}
                role={role}
                candDist={candDist}
                ranking={ranking}
                setRanking={setRanking}
                catFilter={catFilter}
                setCatFilter={setCatFilter}
                supFilter={supFilter}
                setSupFilter={setSupFilter}
                hasProjLoc={!!projLoc}
                onCreateAll={() => run(svc.createSelection, {} as Record<string, never>)}
                onPick={(reqId, itemId) => {
                  if (!s.selection) {
                    run(svc.createSelection, {
                      catalogItemIdsByRequirement: { [reqId]: itemId },
                      onlyRequirementIds: [reqId],
                    });
                    return;
                  }
                  const existing = s.selection_items.find((i) => i.requirement_ids.includes(reqId));
                  if (existing) {
                    run(svc.editItem, {
                      expectedVersion: version,
                      itemId: existing.id,
                      patch: { catalog_item_id: itemId },
                    });
                  } else {
                    const req = s.requirements.find((r) => r.id === reqId);
                    run(svc.addItem, {
                      expectedVersion: version,
                      catalog_item_id: itemId,
                      requirement_ids: [reqId],
                      quantity: req?.quantity && req.quantity > 0 ? req.quantity : 1,
                      unit: req?.unit ?? "unidad",
                      priority: "normal" as Priority,
                    });
                  }
                }}
              />
            )}
          </div>

          <aside className="aside">
            {role === "project_designer" && s.selection?.status === "draft" && (
              <>
                <TicketTray state={s} version={version} run={run} />
                <FinalizePanel state={s} version={version} run={run} />
              </>
            )}
            {role !== "project_designer" && s.selection && s.change_requests.length > 0 && (
              <TicketTrayReadonly state={s} />
            )}
            <ProjectLocationPanel state={s} role={role} run={run} />
            <ActivityFeed state={s} />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ===========================================================================
function UploadZone({
  analyzing,
  onAnalyze,
}: {
  analyzing: boolean;
  onAnalyze: (p: { file?: File; text?: string; example?: boolean }) => void;
}) {
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <div
        className={`dropzone ${over ? "over" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onAnalyze({ file: f });
        }}
      >
        <div className="icon">
          <Upload size={22} />
        </div>
        <div className="t">Arrastra el expediente aquí</div>
        <div className="s">PDF, Markdown o TXT · hasta 10 MB · o haz clic para elegir</div>
        <span className="btn btn-primary">Seleccionar archivo</span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.md,.markdown,.txt,.text"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAnalyze({ file: f });
            e.target.value = "";
          }}
        />
      </div>

      <div className="inline" style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" disabled={analyzing} onClick={() => setShowPaste((v) => !v)}>
          Pegar contenido
        </button>
        <button className="btn btn-secondary btn-sm" disabled={analyzing} onClick={() => onAnalyze({ example: true })}>
          Usar expediente de ejemplo
        </button>
      </div>

      {showPaste && (
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Pega aquí el texto de la ficha técnica o del expediente…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="inline end" style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={analyzing || !paste.trim()}
              onClick={() => onAnalyze({ text: paste })}
            >
              Analizar texto <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ===========================================================================
function DocumentPanel({
  state,
  analyzing,
  onAnalyze,
  onReset,
}: {
  state: NexusState;
  analyzing: boolean;
  onAnalyze: (p: { file?: File; text?: string; example?: boolean }) => void;
  onReset: () => void;
}) {
  const src = state.extraction_source === "gemini" ? "IA · Gemini" : "Análisis del expediente";
  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Resultado del match</div>
        <h3>Requerimientos identificados en el expediente</h3>
        <p>
          Cada fila es una necesidad de compra extraída del documento: qué producto, cuánto y con
          qué especificaciones. El texto exacto del expediente está en «Detalle».
        </p>
      </div>
      <div className="pb" style={{ paddingBottom: 0 }}>
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={analyzing}
          onClick={onReset}
          style={{ justifyContent: "center", gap: 9 }}
        >
          <RotateCcw size={17} /> Cargar otro expediente
        </button>
      </div>
      <div className="pb" style={{ paddingBottom: 0 }}>
        {state.extraction_notice && (
          <div className="callout info">
            <Info size={15} />
            {state.extraction_notice}
          </div>
        )}
        <div className="inline" style={{ marginBottom: 12 }}>
          <span className="tag tag-outline dot">Fuente: {src}</span>
        </div>
      </div>
      <RequirementsTable state={state} />
    </div>
  );
}

function RequirementsTable({ state }: { state: NexusState }) {
  const [open, setOpen] = useState<string | null>(null);
  const covered = new Set<string>();
  for (const it of state.selection_items) for (const r of it.requirement_ids) covered.add(r);
  const unmatched = new Set(state.proposal?.unmatched_requirement_ids ?? []);
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Partida</th>
            <th className="r">Cantidad</th>
            <th>Especificaciones pedidas</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {state.requirements.map((r) => {
            const isOpen = open === r.id;
            return (
              <FragmentReq
                key={r.id}
                r={r}
                isOpen={isOpen}
                onToggle={() => setOpen(isOpen ? null : r.id)}
                unmatched={unmatched.has(r.id)}
                selectionExists={!!state.selection}
                covered={covered.has(r.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentReq({
  r,
  isOpen,
  onToggle,
  unmatched,
  selectionExists,
  covered,
}: {
  r: Requirement;
  isOpen: boolean;
  onToggle: () => void;
  unmatched: boolean;
  selectionExists: boolean;
  covered: boolean;
}) {
  const specs = Object.entries(r.specifications);
  return (
    <>
      <tr className="data">
        <td className="prime">
          {r.type_name}
          <small>{r.category}</small>
        </td>
        <td className="r num">{r.quantity === null ? "—" : `${r.quantity} ${r.unit ?? ""}`}</td>
        <td className="muted">
          {specs.length ? specs.map(([k, v]) => `${k}: ${v}`).join(" · ") : "—"}
        </td>
        <td>
          {unmatched ? (
            <span className="tag tag-review dot">Sin coincidencia</span>
          ) : selectionExists ? (
            covered ? (
              <span className="tag tag-ok dot">En la lista</span>
            ) : (
              <span className="tag tag-neutral dot">Fuera de la lista</span>
            )
          ) : (
            <span className="tag tag-neutral dot">Con candidatos</span>
          )}
        </td>
        <td className="r">
          <button className="link" aria-expanded={isOpen} onClick={onToggle}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Detalle
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="detail">
          <td colSpan={5}>
            <div>
              <strong>Extracto del expediente</strong>
            </div>
            <div className="excerpt">{r.source_excerpt || "(sin texto asociado)"}</div>
            <div style={{ marginTop: 6, color: "var(--text-55)" }}>
              Confianza de la extracción: {r.confidence === null ? "—" : `${Math.round(r.confidence * 100)}%`}
              {r.keywords.length > 0 && ` · palabras clave: ${r.keywords.join(", ")}`}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
function ProposalPanel(props: {
  state: NexusState;
  role: Role;
  candDist: MatchCandidate[];
  ranking: "recommended" | "nearest";
  setRanking: (r: "recommended" | "nearest") => void;
  catFilter: string;
  setCatFilter: (v: string) => void;
  supFilter: string;
  setSupFilter: (v: string) => void;
  hasProjLoc: boolean;
  onCreateAll: () => void;
  onPick: (reqId: string, itemId: string) => void;
}) {
  const {
    state,
    role,
    candDist,
    ranking,
    setRanking,
    catFilter,
    setCatFilter,
    supFilter,
    setSupFilter,
    hasProjLoc,
    onCreateAll,
    onPick,
  } = props;
  const canPick = role === "project_designer";
  const pickedByReq: Record<string, string> = {};
  for (const it of state.selection_items)
    for (const r of it.requirement_ids) pickedByReq[r] = it.catalog_item_id;
  const categories = [...new Set(state.requirements.map((r) => r.category))];
  const suppliers = [...new Set(CATALOG.map((c) => c.supplier_name))];
  const reqs = state.requirements.filter((r) => !catFilter || r.category === catFilter);

  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Propuesta global</div>
        <h3>Elige el producto para cada requerimiento</h3>
        <p>
          {canPick
            ? "Pulsa «Elegir» y el producto pasa a la lista oficial. Ahí puedes editarlo y finalizarla."
            : "Consulta. El Proyectista elige los productos; tú puedes solicitar cambios en la lista."}
        </p>
      </div>

      <div className="pb" style={{ paddingBottom: 8 }}>
        <div className="inline between">
          <div className="seg" role="group" aria-label="Orden">
            <button aria-pressed={ranking === "recommended"} onClick={() => setRanking("recommended")}>
              Recomendados
            </button>
            <button aria-pressed={ranking === "nearest"} disabled={!hasProjLoc} onClick={() => setRanking("nearest")}>
              Más cercanos
            </button>
          </div>
          <div className="inline">
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Categoría">
              <option value="">Toda categoría</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={supFilter} onChange={(e) => setSupFilter(e.target.value)} aria-label="Proveedor">
              <option value="">Todo proveedor</option>
              {suppliers.map((sp) => (
                <option key={sp}>{sp}</option>
              ))}
            </select>
          </div>
        </div>
        {!hasProjLoc && (
          <div className="callout review" style={{ marginTop: 10 }}>
            <AlertTriangle size={14} />
            «Más cercanos» está deshabilitado: el Proyectista debe fijar la ubicación del proyecto.
          </div>
        )}
      </div>

      <div className="legend">
        <span>
          <b>Compatibilidad</b> = ajuste técnico (0–100).
        </span>
        <span>
          <b>Distancia</b> = cercanía logística aproximada.
        </span>
        <span>Criterios independientes.</span>
      </div>

      <div className="pb">
        {reqs.map((req) => {
          let rows = candDist.filter((c) => c.requirement_ids.includes(req.id));
          if (supFilter) rows = rows.filter((c) => catalogById(c.catalog_item_id)?.supplier_name === supFilter);
          const ranked = (ranking === "recommended" ? rankRecommended(rows) : rankNearest(rows)).slice(0, 4);
          const isUnmatched = state.proposal?.unmatched_requirement_ids.includes(req.id);
          return (
            <div key={req.id} className={`rgroup ${isUnmatched ? "unmatched" : ""}`}>
              <div className="rh">
                <h4>{req.type_name}</h4>
                <span className="note">
                  {req.category} · {req.quantity ?? "?"} {req.unit ?? ""}
                  {Object.keys(req.specifications).length > 0 &&
                    ` · pide ${Object.entries(req.specifications).map(([k, v]) => `${k} ${v}`).join(", ")}`}
                </span>
              </div>
              {ranked.length === 0 ? (
                <p className="empty">Sin coincidencia. Queda pendiente; no se sustituye por otro producto.</p>
              ) : (
                <CandidateTable
                  rows={ranked}
                  canPick={canPick}
                  pickedId={pickedByReq[req.id]}
                  onPick={(itemId) => onPick(req.id, itemId)}
                />
              )}
            </div>
          );
        })}
      </div>

      {canPick && !state.selection && (
        <div className="pb" style={{ borderTop: "1px solid var(--divider)" }}>
          <button className="btn btn-secondary" onClick={onCreateAll}>
            Elegir el sugerido de cada requerimiento <ArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function CandidateTable({
  rows,
  canPick,
  pickedId,
  onPick,
}: {
  rows: MatchCandidate[];
  canPick: boolean;
  pickedId?: string;
  onPick: (itemId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Marca / producto</th>
            <th>Proveedor</th>
            <th className="r">Distancia</th>
            <th className="r">Compatibilidad</th>
            <th>Alertas</th>
            <th />
            {canPick && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const item = catalogById(c.catalog_item_id);
            if (!item) return null;
            const isOpen = open === c.catalog_item_id;
            return (
              <FragmentCand
                key={c.catalog_item_id}
                item={item}
                c={c}
                best={i === 0}
                isOpen={isOpen}
                canPick={canPick}
                picked={pickedId === c.catalog_item_id}
                onPick={() => onPick(c.catalog_item_id)}
                onToggle={() => setOpen(isOpen ? null : c.catalog_item_id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentCand({
  item,
  c,
  best,
  isOpen,
  canPick,
  picked,
  onPick,
  onToggle,
}: {
  item: NonNullable<ReturnType<typeof catalogById>>;
  c: MatchCandidate;
  best: boolean;
  isOpen: boolean;
  canPick: boolean;
  picked: boolean;
  onPick: () => void;
  onToggle: () => void;
}) {
  const cc = compatClass(c.compatibility_score);
  const colspan = canPick ? 7 : 6;
  return (
    <>
      <tr className={`data ${best ? "best" : ""}`} style={picked ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)" } : undefined}>
        <td className="prime">
          {item.brand}
          {best && <span className="tag tag-accent" style={{ marginLeft: 6 }}>Sugerido</span>}
          {picked && <span className="tag tag-ok" style={{ marginLeft: 6 }}>En la lista</span>}
          <small>{item.name}</small>
        </td>
        <td>
          {item.supplier_name}
          <br />
          <span style={{ color: "var(--text-40)", fontSize: 12 }}>
            {item.supplier_location.district}
          </span>
        </td>
        <td className="r">
          <span className="metric">{formatKm(c.distance_km)}</span>
        </td>
        <td className="r">
          <span className={`compat ${cc}`}>
            <span className="bar">
              <i style={{ width: `${c.compatibility_score}%` }} />
            </span>
            <span className="v">{c.compatibility_score}</span>
          </span>
        </td>
        <td>
          {c.needs_review ? (
            <span className="tag tag-review dot">Revisar</span>
          ) : (
            <span className="tag tag-ok dot">OK</span>
          )}
        </td>
        <td className="r">
          <button className="link" aria-expanded={isOpen} onClick={onToggle}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Detalle
          </button>
        </td>
        {canPick && (
          <td className="r">
            <button
              className={picked ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
              onClick={onPick}
              disabled={picked}
            >
              {picked ? "Elegido" : "Elegir"}
            </button>
          </td>
        )}
      </tr>
      {isOpen && (
        <tr className="detail">
          <td colSpan={colspan}>
            <div>
              <strong>SKU</strong> {item.sku} · <strong>tipo</strong> {item.type_name} ·{" "}
              <strong>specs</strong>{" "}
              {Object.entries(item.specifications)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ") || "sin datos"}
            </div>
            <div style={{ marginTop: 4, color: "var(--text-55)" }}>
              Especificaciones sintéticas de demostración, sin verificación técnica.
            </div>
            {c.reasons.length > 0 && (
              <ul>
                {c.reasons.map((rr, i) => (
                  <li key={i}>{rr}</li>
                ))}
              </ul>
            )}
            {c.unknown_fields.length > 0 && (
              <div style={{ marginTop: 4 }}>Datos desconocidos: {c.unknown_fields.join(", ")}</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
function OfficialListPanel({
  state,
  role,
  version,
  run,
  resolveReviewAction,
}: {
  state: NexusState;
  role: Role;
  version: number;
  run: Run;
  resolveReviewAction: (it: NexusState["selection_items"][number], apply: boolean) => void;
}) {
  const draft = state.selection?.status === "draft";
  const canEdit = draft && role === "project_designer";
  const canRequest = draft && role === "logistics";

  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Lista oficial</div>
        <div className="inline">
          <h3>{state.selection_items.length} ítems</h3>
          <span className={`tag ${draft ? "tag-neutral" : "tag-ok"} dot`}>{draft ? "borrador" : "finalizada"}</span>
        </div>
        <p>Creada por el Proyectista desde la propuesta. Es la única lista del proyecto.</p>
      </div>

      {!draft && (
        <div className="pb" style={{ paddingBottom: 0 }}>
          <div className="callout ok">
            <Check size={15} /> Lista finalizada e inmutable. Ningún rol edita ni abre solicitudes.
          </div>
        </div>
      )}

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Marca / producto</th>
              <th>Proveedor</th>
              <th className="r">Distancia</th>
              <th className="r">Compat.</th>
              <th className="r">Cantidad</th>
              <th>Prioridad</th>
              <th>Revisión</th>
              {(canEdit || canRequest) && <th />}
            </tr>
          </thead>
          <tbody>
            {state.selection_items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <p className="empty">La lista está vacía.</p>
                </td>
              </tr>
            )}
            {state.selection_items.map((it) => {
              const item = catalogById(it.catalog_item_id);
              if (!item) return null;
              const dist = state.project.project_location
                ? haversineKm(state.project.project_location, item.supplier_location)
                : null;
              const pending = state.change_requests.find(
                (c) => c.selection_item_id === it.id && c.status === "pending",
              );
              return (
                <ItemRow
                  key={it.id}
                  state={state}
                  it={it}
                  item={item}
                  dist={dist}
                  pending={pending}
                  canEdit={canEdit}
                  canRequest={canRequest}
                  version={version}
                  run={run}
                  resolveReviewAction={resolveReviewAction}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pb" style={{ borderTop: "1px solid var(--divider)" }}>
        {canEdit && <AddItemForm state={state} version={version} run={run} />}
        {canRequest && <RequestForm state={state} itemId={null} version={version} run={run} addOnly />}
        {role === "site_resident" && (
          <div className="callout">
            <Info size={14} /> Vista de consulta. El Residente no edita, no resuelve tickets ni finaliza.
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  state,
  it,
  item,
  dist,
  pending,
  canEdit,
  canRequest,
  version,
  run,
  resolveReviewAction,
}: {
  state: NexusState;
  it: NexusState["selection_items"][number];
  item: NonNullable<ReturnType<typeof catalogById>>;
  dist: number | null;
  pending: NexusState["change_requests"][number] | undefined;
  canEdit: boolean;
  canRequest: boolean;
  version: number;
  run: Run;
  resolveReviewAction: (it: NexusState["selection_items"][number], apply: boolean) => void;
}) {
  const [expand, setExpand] = useState(false);
  const cc = compatClass(it.compatibility_score);
  return (
    <>
      <tr className="data">
        <td className="prime">
          {item.brand}
          <small>{item.name}</small>
        </td>
        <td>
          {item.supplier_name}
          <br />
          <span style={{ color: "var(--text-40)", fontSize: 12 }}>{item.supplier_location.district}</span>
        </td>
        <td className="r">
          <span className="metric">{formatKm(dist)}</span>
        </td>
        <td className="r">
          <span className={`compat ${cc}`}>
            <span className="bar">
              <i style={{ width: `${it.compatibility_score}%` }} />
            </span>
            <span className="v">{it.compatibility_score}</span>
          </span>
        </td>
        <td className="r num">
          {it.quantity} {it.unit}
        </td>
        <td>
          <span
            className={`tag ${it.priority === "high" ? "tag-danger" : it.priority === "medium" ? "tag-review" : "tag-neutral"}`}
          >
            {PRIO_LABEL[it.priority]}
          </span>
        </td>
        <td>
          <span
            className={`tag dot ${
              it.review_status === "resolved" ? "tag-ok" : it.review_status === "needs_review" ? "tag-review" : "tag-neutral"
            }`}
          >
            {it.review_status === "needs_review"
              ? "requiere revisión"
              : it.review_status === "resolved"
                ? "resuelta"
                : "sin alertas"}
          </span>
        </td>
        {(canEdit || canRequest) && (
          <td className="r">
            <button className="link" onClick={() => setExpand((v) => !v)} aria-expanded={expand}>
              {expand ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {canEdit ? "Editar" : "Solicitar"}
            </button>
          </td>
        )}
      </tr>

      {pending && (
        <tr className="detail">
          <td colSpan={8}>
            <span className="tag tag-accent">Solicitud pendiente · {TICKET_LABEL[pending.type]}</span>{" "}
            <span className="diffline">
              actual <span className="was">{ticketDiff(pending, it)?.from ?? "—"}</span>
              <span className="arrow">→</span>
              solicitado <span className="now">{ticketDiff(pending, it)?.to ?? "—"}</span>
            </span>
            <div style={{ marginTop: 3, color: "var(--text-55)" }}>
              La lista no cambia hasta que el Proyectista acepte.
            </div>
          </td>
        </tr>
      )}

      {canEdit && it.review_status === "needs_review" && (
        <tr className="detail">
          <td colSpan={8}>
            <div className="callout review" style={{ marginBottom: 0, flexWrap: "wrap", alignItems: "center" }}>
              <AlertTriangle size={15} />
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>{reviewSuggestion(it).label}</div>
              <div className="inline" style={{ flex: "0 0 auto" }}>
                <button className="btn btn-primary btn-sm" onClick={() => resolveReviewAction(it, true)}>
                  Aplicar y resolver
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => resolveReviewAction(it, false)}
                  title="Desestimar la recomendación y mantener el ítem"
                >
                  Rechazar revisión
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {expand && canEdit && (
        <tr className="detail">
          <td colSpan={8}>
            <DesignerItemActions item={it} version={version} run={run} />
          </td>
        </tr>
      )}
      {expand && canRequest && (
        <tr className="detail">
          <td colSpan={8}>
            <RequestForm state={state} itemId={it.id} version={version} run={run} />
          </td>
        </tr>
      )}
    </>
  );
}

function ticketDiff(
  cr: NexusState["change_requests"][number],
  it: NexusState["selection_items"][number] | null | undefined,
): { from: string; to: string } | null {
  const v = cr.requested_value;
  if (v.kind === "change_quantity")
    return { from: `${it?.quantity ?? "?"} ${it?.unit ?? ""}`, to: `${v.quantity} ${it?.unit ?? ""}` };
  if (v.kind === "change_priority") return { from: PRIO_LABEL[it?.priority ?? "normal"], to: PRIO_LABEL[v.priority] };
  if (v.kind === "remove_product") return { from: "en la lista", to: "eliminar" };
  if (v.kind === "replace_product") {
    const from = it ? catalogById(it.catalog_item_id)?.brand ?? "?" : "?";
    return { from, to: catalogById(v.catalog_item_id)?.brand ?? v.catalog_item_id };
  }
  if (v.kind === "add_product")
    return { from: "no está", to: `${catalogById(v.catalog_item_id)?.brand ?? "?"} · ${v.quantity} ${v.unit}` };
  return null;
}

function DesignerItemActions({
  item,
  version,
  run,
}: {
  item: NexusState["selection_items"][number];
  version: number;
  run: Run;
}) {
  const [qty, setQty] = useState(item.quantity);
  const [prio, setPrio] = useState<Priority>(item.priority);
  const [replaceId, setReplaceId] = useState("");
  const [note, setNote] = useState("");
  const alts = CATALOG.filter(
    (c) => c.type_name === catalogById(item.catalog_item_id)?.type_name && c.id !== item.catalog_item_id,
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <fieldset>
        <legend>Editar ítem</legend>
        <div className="editgrid">
          <div className="ig">
            <label>Cantidad ({item.unit})</label>
            <div className="row2">
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              <button
                className="btn btn-secondary btn-sm"
                disabled={qty === item.quantity || !(qty > 0)}
                onClick={() => run(svc.editItem, { expectedVersion: version, itemId: item.id, patch: { quantity: qty } })}
              >
                Guardar
              </button>
            </div>
          </div>

          <div className="ig">
            <label>Prioridad</label>
            <div className="row2">
              <select value={prio} onChange={(e) => setPrio(e.target.value as Priority)}>
                {PRIO_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIO_LABEL[p]}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                disabled={prio === item.priority}
                onClick={() => run(svc.editItem, { expectedVersion: version, itemId: item.id, patch: { priority: prio } })}
              >
                Guardar
              </button>
            </div>
          </div>

          {alts.length > 0 && (
            <div className="ig span-all">
              <label>Reemplazar por otra marca del mismo tipo</label>
              <div className="row2">
                <select value={replaceId} onChange={(e) => setReplaceId(e.target.value)}>
                  <option value="">Elegir marca…</option>
                  {alts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.brand} — {a.supplier_name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={!replaceId}
                  onClick={() =>
                    run(svc.editItem, { expectedVersion: version, itemId: item.id, patch: { catalog_item_id: replaceId } })
                  }
                >
                  Reemplazar
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-danger btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => run(svc.removeItem, { expectedVersion: version, itemId: item.id })}
        >
          Eliminar ítem de la lista
        </button>
      </fieldset>

      {item.review_status === "needs_review" && (
        <fieldset>
          <legend>Resolver revisión técnica con nota propia</legend>
          <div className="row2">
            <input
              type="text"
              placeholder="Nota de resolución"
              value={note}
              style={{ flex: "1 1 180px", minWidth: 0 }}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={!note.trim()}
              onClick={() => run(svc.resolveReview, { expectedVersion: version, itemId: item.id, note })}
            >
              Marcar resuelta
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function RequestForm({
  state,
  itemId,
  version,
  run,
  addOnly,
}: {
  state: NexusState;
  itemId: string | null;
  version: number;
  run: Run;
  addOnly?: boolean;
}) {
  const [openF, setOpenF] = useState(!!itemId);
  const [type, setType] = useState<ChangeRequestType>(addOnly ? "add_product" : "change_quantity");
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState(1);
  const [prio, setPrio] = useState<Priority>("normal");
  const [prodId, setProdId] = useState("");
  void state;

  if (!openF) {
    return (
      <button className="btn btn-secondary btn-sm" onClick={() => setOpenF(true)}>
        {addOnly ? "Solicitar agregar un producto" : "Solicitar cambio"}
      </button>
    );
  }

  const types: ChangeRequestType[] = addOnly
    ? ["add_product"]
    : ["change_quantity", "change_priority", "remove_product", "replace_product"];

  const payload = (): ChangeRequestPayload => {
    switch (type) {
      case "change_quantity":
        return { kind: "change_quantity", quantity: qty };
      case "change_priority":
        return { kind: "change_priority", priority: prio };
      case "remove_product":
        return { kind: "remove_product" };
      case "replace_product":
        return { kind: "replace_product", catalog_item_id: prodId };
      case "add_product":
        return { kind: "add_product", catalog_item_id: prodId, quantity: qty, unit: "unidad", priority: prio, requirement_ids: [] };
    }
  };

  return (
    <fieldset>
      <legend>Solicitar cambio (Logística) — no modifica la lista</legend>
      <div className="editgrid">
        <div className="ig">
          <label>Tipo de solicitud</label>
          <select value={type} onChange={(e) => setType(e.target.value as ChangeRequestType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {TICKET_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {(type === "change_quantity" || type === "add_product") && (
          <div className="ig">
            <label>Cantidad</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
        )}
        {(type === "change_priority" || type === "add_product") && (
          <div className="ig">
            <label>Prioridad</label>
            <select value={prio} onChange={(e) => setPrio(e.target.value as Priority)}>
              {PRIO_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIO_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        )}
        {(type === "replace_product" || type === "add_product") && (
          <div className="ig span-all">
            <label>Producto del catálogo</label>
            <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
              <option value="">Elegir producto…</option>
              {CATALOG.slice(0, 90).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type_name} · {c.brand} · {c.supplier_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <textarea
        placeholder="Motivo (obligatorio) — p. ej. «hay un proveedor 6 km más cerca»"
        value={reason}
        style={{ marginTop: 8 }}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="inline end" style={{ marginTop: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setOpenF(false)}>
          Cancelar
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!reason.trim() || ((type === "replace_product" || type === "add_product") && !prodId)}
          onClick={() => {
            const res = run(svc.createChangeRequest, {
              type,
              payload: payload(),
              itemId: type === "add_product" ? null : itemId,
              reason,
              baseVersion: version,
            });
            if (res.ok) {
              setReason("");
              if (addOnly) setOpenF(false);
            }
          }}
        >
          Enviar solicitud
        </button>
      </div>
    </fieldset>
  );
}

function AddItemForm({ state, version, run }: { state: NexusState; version: number; run: Run }) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState(1);
  void state;
  return (
    <fieldset>
      <legend>Agregar ítem directo (Proyectista)</legend>
      <div className="inline">
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">producto del catálogo…</option>
          {CATALOG.slice(0, 90).map((c) => (
            <option key={c.id} value={c.id}>
              {c.type_name} · {c.brand} · {c.supplier_name}
            </option>
          ))}
        </select>
        <input type="number" min={1} value={qty} style={{ width: 80 }} onChange={(e) => setQty(Number(e.target.value))} />
        <button
          className="btn btn-secondary btn-sm"
          disabled={!id}
          onClick={() =>
            run(svc.addItem, {
              expectedVersion: version,
              catalog_item_id: id,
              requirement_ids: [],
              quantity: qty,
              unit: "unidad",
              priority: "normal" as Priority,
            })
          }
        >
          Agregar a la lista
        </button>
      </div>
    </fieldset>
  );
}

// ===========================================================================
function TicketTray({ state, version, run }: { state: NexusState; version: number; run: Run }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = state.change_requests.filter((c) => c.status === "pending");
  const resolved = state.change_requests.filter((c) => c.status !== "pending");
  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Bandeja del Proyectista</div>
        <div className="inline">
          <h3>Solicitudes de Logística</h3>
          {pending.length > 0 && <span className="tag tag-accent">{pending.length} pendientes</span>}
        </div>
        <p>Aceptar aplica el cambio a la lista una sola vez. Rechazar la conserva.</p>
      </div>
      <div className="pb" style={{ display: "grid", gap: 10 }}>
        {state.change_requests.length === 0 && <p className="empty">Sin solicitudes.</p>}
        {pending.map((cr) => {
          const target = cr.selection_item_id
            ? state.selection_items.find((i) => i.id === cr.selection_item_id)
            : cr.target_snapshot;
          const d = ticketDiff(cr, target);
          return (
            <div key={cr.id} className="callout info" style={{ display: "block" }}>
              <div className="inline between">
                <strong>{TICKET_LABEL[cr.type]}</strong>
                <span className="tag tag-neutral">sobre v{cr.base_selection_version}</span>
              </div>
              <div className="diffline" style={{ marginTop: 4 }}>
                <span className="was">{d?.from ?? "—"}</span>
                <span className="arrow">→</span>
                <span className="now">{d?.to ?? "—"}</span>
              </div>
              <div style={{ margin: "4px 0", color: "var(--text-70)" }}>«{cr.reason}»</div>
              <div className="inline" style={{ marginTop: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => run(svc.acceptChangeRequest, { expectedVersion: version, changeRequestId: cr.id })}
                >
                  Aceptar solicitud
                </button>
              </div>
              <div className="inline" style={{ marginTop: 6 }}>
                <input
                  type="text"
                  aria-label="Motivo del rechazo"
                  placeholder="Motivo del rechazo"
                  value={notes[cr.id] ?? ""}
                  style={{ flex: 1, minWidth: 130 }}
                  onChange={(e) => setNotes({ ...notes, [cr.id]: e.target.value })}
                />
                <button
                  className="btn btn-danger btn-sm"
                  disabled={!(notes[cr.id] ?? "").trim()}
                  onClick={() => run(svc.rejectChangeRequest, { changeRequestId: cr.id, note: notes[cr.id] ?? "" })}
                >
                  Rechazar
                </button>
              </div>
            </div>
          );
        })}
        {resolved.map((cr) => (
          <div key={cr.id} className="callout" style={{ fontSize: 12, marginBottom: 0 }}>
            <span className={`tag ${cr.status === "accepted" ? "tag-ok" : "tag-danger"}`}>
              {cr.status === "accepted" ? "aceptada" : "rechazada"}
            </span>{" "}
            {TICKET_LABEL[cr.type]} · «{cr.reason}»
            {cr.resolution_note && <div className="muted">nota: {cr.resolution_note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketTrayReadonly({ state }: { state: NexusState }) {
  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Solicitudes</div>
        <h3>Historial de cambios</h3>
      </div>
      <div className="pb" style={{ display: "grid", gap: 8 }}>
        {state.change_requests.map((cr) => (
          <div key={cr.id} className="callout" style={{ fontSize: 12, marginBottom: 0 }}>
            <span
              className={`tag ${
                cr.status === "accepted" ? "tag-ok" : cr.status === "rejected" ? "tag-danger" : "tag-accent"
              }`}
            >
              {cr.status}
            </span>{" "}
            {TICKET_LABEL[cr.type]} · «{cr.reason}»
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalizePanel({ state, version, run }: { state: NexusState; version: number; run: Run }) {
  const blockers = svc.finalizeBlockers(state);
  const covered = new Set<string>();
  for (const i of state.selection_items) for (const r of i.requirement_ids) covered.add(r);
  const resolvedCov = new Set(state.selection!.coverage_resolutions.map((r) => r.requirement_id));
  const missing = state.requirements.filter((r) => !covered.has(r.id) && !resolvedCov.has(r.id));
  const [reasons, setReasons] = useState<Record<string, string>>({});

  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Cierre</div>
        <h3>Finalizar la lista</h3>
      </div>
      <div className="pb">
        {missing.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p className="muted" style={{ fontSize: 12 }}>
              Requerimientos sin cubrir — excluye con justificación:
            </p>
            {missing.map((m) => (
              <div key={m.id} className="inline" style={{ marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder={`Excluir ${m.type_name}: motivo`}
                  value={reasons[m.id] ?? ""}
                  style={{ flex: 1, minWidth: 150 }}
                  onChange={(e) => setReasons({ ...reasons, [m.id]: e.target.value })}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={!(reasons[m.id] ?? "").trim()}
                  onClick={() =>
                    run(svc.resolveCoverage, { expectedVersion: version, requirementId: m.id, reason: reasons[m.id] ?? "" })
                  }
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
        {blockers.length > 0 ? (
          <ul className="blockers">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : (
          <div className="callout ok" style={{ marginBottom: 10 }}>
            <Check size={14} /> Sin pendientes. Puedes finalizar.
          </div>
        )}
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={blockers.length > 0}
          onClick={() => run(svc.finalizeSelection, { expectedVersion: version })}
        >
          Aceptar y finalizar lista
        </button>
      </div>
    </div>
  );
}

const LOCS = [
  { d: "Miraflores", lat: -12.1211, lon: -77.0298 },
  { d: "San Isidro", lat: -12.0977, lon: -77.0365 },
  { d: "San Juan de Lurigancho", lat: -11.9756, lon: -77.0056 },
  { d: "Surco", lat: -12.145, lon: -76.9905 },
];
// caja aprox. de Lima metropolitana para proyectar lat/lon a un mini-mapa
const BOX = { latN: -11.94, latS: -12.26, lonW: -77.09, lonE: -76.88 };
function toXY(lat: number, lon: number) {
  const x = ((lon - BOX.lonW) / (BOX.lonE - BOX.lonW)) * 100;
  const y = ((BOX.latN - lat) / (BOX.latN - BOX.latS)) * 100;
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) };
}

function ProjectLocationPanel({ state, role, run }: { state: NexusState; role: Role; run: Run }) {
  const loc = state.project.project_location;
  const finalized = state.selection?.status === "finalized";
  const suppliers = [
    ...new Map(
      CATALOG.map((c) => [c.supplier_name, c.supplier_location]),
    ).entries(),
  ];
  const proj = loc ? toXY(loc.latitude, loc.longitude) : null;
  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Ubicación</div>
        <h3>Proyecto y proveedores</h3>
      </div>
      <div className="pb">
        <div
          style={{
            position: "relative",
            aspectRatio: "4 / 3",
            borderRadius: "var(--radius-sm)",
            background:
              "repeating-linear-gradient(0deg, var(--surface-2), var(--surface-2) 13px, var(--surface-3) 13px, var(--surface-3) 14px), repeating-linear-gradient(90deg, transparent, transparent 13px, var(--surface-3) 13px, var(--surface-3) 14px)",
            border: "1px solid var(--divider)",
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {suppliers.map(([name, sl]) => {
            const p = toXY(sl.latitude, sl.longitude);
            return (
              <div
                key={name}
                title={`${name} · ${sl.district}`}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: "translate(-50%,-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--text-55)" }} />
                <span style={{ fontSize: 9, color: "var(--text-55)", whiteSpace: "nowrap" }}>{name}</span>
              </div>
            );
          })}
          {proj && (
            <div
              style={{
                position: "absolute",
                left: `${proj.x}%`,
                top: `${proj.y}%`,
                transform: "translate(-50%,-100%)",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50% 50% 50% 0",
                  transform: "rotate(-45deg)",
                  background: "var(--accent)",
                  boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--accent-hi)",
                  whiteSpace: "nowrap",
                }}
              >
                Obra
              </span>
            </div>
          )}
        </div>

        <div className="metric" style={{ fontSize: 12.5 }}>
          {loc
            ? `${loc.district ?? ""} · ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
            : "sin ubicación"}
        </div>

        {role === "project_designer" ? (
          <>
            <p className="muted" style={{ fontSize: 11, margin: "8px 0 5px" }}>Editar ubicación de la obra:</p>
            <div className="inline">
              {LOCS.map((o) => (
                <button
                  key={o.d}
                  className={`btn btn-sm ${loc?.district === o.d ? "btn-primary" : "btn-secondary"}`}
                  disabled={finalized}
                  onClick={() =>
                    run(svc.setProjectLocation, {
                      location: { city: "Lima", district: o.d, country: "PE", latitude: o.lat, longitude: o.lon },
                    })
                  }
                >
                  {o.d}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Solo el Proyectista cambia la ubicación.
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityFeed({ state }: { state: NexusState }) {
  return (
    <div className="panel">
      <div className="ph">
        <div className="k">Trazabilidad</div>
        <h3>Actividad</h3>
      </div>
      <div className="pb">
        {state.activity_log.length === 0 && <p className="empty">Sin eventos.</p>}
        <ul className="timeline">
          {[...state.activity_log].reverse().map((e) => (
            <li key={e.id}>
              <span className="who">{ROLE_LABEL[e.actor_role]}</span> {humanAction(e)}
              <div className="when">{new Date(e.created_at).toLocaleTimeString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function humanAction(e: NexusState["activity_log"][number]): string {
  const b = e.before as Record<string, unknown> | null;
  const a = e.after as Record<string, unknown> | null;
  if (e.action === "selection.create") return `creó la lista oficial (${a?.items} ítems)`;
  if (e.action.startsWith("ticket.create"))
    return `solicitó un cambio (${TICKET_LABEL[e.action.split(".").pop() as ChangeRequestType] ?? ""})`;
  if (e.action.startsWith("ticket.accept.change_quantity")) return `aceptó: ${b?.quantity} → ${a?.quantity}`;
  if (e.action.startsWith("ticket.accept")) return `aceptó una solicitud`;
  if (e.action.startsWith("ticket.reject")) return `rechazó una solicitud`;
  if (e.action === "review.resolve") return `resolvió una revisión técnica`;
  if (e.action === "coverage.resolve") return `excluyó un requerimiento con justificación`;
  if (e.action === "selection.finalize") return `finalizó la lista (v${a?.version})`;
  if (e.action === "item.edit") return `editó un ítem`;
  if (e.action === "item.add") return `agregó un ítem`;
  if (e.action === "item.remove") return `eliminó un ítem`;
  if (e.action === "project.location") return `cambió la ubicación del proyecto`;
  return e.action;
}
