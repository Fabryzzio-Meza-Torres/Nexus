// Recorre el guion de specs/demo-plan.md de principio a fin contra el servicio
// real y la persistencia local (en memoria aquí). Imprime el log de actividad.
// Ejecutar: node --experimental-strip-types scripts/demo-e2e.ts
// polyfill mínimo de localStorage para probar la persistencia fuera del navegador
const mem = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
};

import { initialState, saveState, loadState } from "../src/lib/store.ts";
import { DEMO_REQUIREMENTS, CATALOG, catalogById } from "../src/lib/fixtures.ts";
import { buildProposal, withDistances, rankRecommended } from "../src/lib/matching.ts";
import * as svc from "../src/lib/service.ts";
import type { NexusState } from "../src/lib/types.ts";

let seq = 0;
const rid = () => `e2e-${++seq}`;
const D = { actor: "designer-demo", role: "project_designer" as const };
const L = { actor: "logistics-demo", role: "logistics" as const };

function ok(r: svc.ServiceResult, label: string): NexusState {
  if (!r.ok) throw new Error(`${label} FALLÓ (${r.code}): ${r.error}`);
  console.log(`  ✓ ${label}`);
  return r.state;
}
function expectFail(r: svc.ServiceResult, label: string) {
  if (r.ok) throw new Error(`${label} debía fallar y no lo hizo`);
  console.log(`  ✓ ${label} -> rechazado (${r.code})`);
}

let st = initialState();

// 0:00 — Logística analiza el documento demo
const reqs = DEMO_REQUIREMENTS.map((r, i) => ({
  ...r,
  id: `req-demo-${i + 1}`,
  project_id: st.project.id,
  document_id: "doc-e2e",
}));
st = { ...st, requirements: reqs, proposal: buildProposal(reqs, CATALOG, st.project.id, "doc-e2e") };
console.log(`\n[Documento] ${reqs.length} requerimientos, ${st.proposal!.candidates.length} candidatos, ${st.proposal!.unmatched_requirement_ids.length} sin coincidencia`);

// 0:30 — propuesta global con proveedor y distancia
const ranked = rankRecommended(withDistances(st.proposal!.candidates, CATALOG, st.project.project_location));
const top = ranked[0];
console.log(`[Propuesta] top: ${catalogById(top.catalog_item_id)!.name} · ${catalogById(top.catalog_item_id)!.supplier_name} · ${top.distance_km?.toFixed(1)} km · score ${top.compatibility_score}`);

// 1:05 — Proyectista crea la lista oficial
expectFail(svc.createSelection({ ...L, requestId: rid() }, st), "Logística NO puede crear lista");
st = ok(svc.createSelection({ ...D, requestId: rid() }, st), "Proyectista crea lista oficial (v1)");
const inodoros = st.selection_items.find((i) => i.quantity === 20)!;

// 1:05 — resolver revisiones pendientes
for (const it of st.selection_items.filter((i) => i.review_status === "needs_review")) {
  st = ok(
    svc.resolveReview({ ...D, requestId: rid(), expectedVersion: st.selection!.version, itemId: it.id, note: "uso demostrativo" }, st),
    `resolver revisión de ${catalogById(it.catalog_item_id)!.type_name}`,
  );
}

// 1:30 — Logística pide 20 -> 25; la lista no cambia
st = ok(
  svc.createChangeRequest(
    { ...L, requestId: rid(), type: "change_quantity", payload: { kind: "change_quantity", quantity: 25 }, itemId: inodoros.id, reason: "la obra creció", baseVersion: st.selection!.version },
    st,
  ),
  "Logística solicita 25 unidades (ticket pending)",
);
console.log(`  · lista sigue en ${st.selection_items.find((i) => i.id === inodoros.id)!.quantity}, versión ${st.selection!.version}`);
const cr1 = st.change_requests[0];

// Proyectista acepta -> 25, mutación única
st = ok(svc.acceptChangeRequest({ ...D, requestId: rid(), expectedVersion: st.selection!.version, changeRequestId: cr1.id }, st), "Proyectista acepta el ticket");
console.log(`  · ahora ${st.selection_items.find((i) => i.id === inodoros.id)!.quantity}, versión ${st.selection!.version}`);

// Segundo ticket rechazado -> conserva contenido
st = ok(
  svc.createChangeRequest(
    { ...L, requestId: rid(), type: "change_priority", payload: { kind: "change_priority", priority: "high" }, itemId: inodoros.id, reason: "prioridad", baseVersion: st.selection!.version },
    st,
  ),
  "Logística solicita prioridad alta",
);
const cr2 = st.change_requests.find((c) => c.id !== cr1.id)!;
const vBefore = st.selection!.version;
st = ok(svc.rejectChangeRequest({ ...D, requestId: rid(), changeRequestId: cr2.id, note: "sin sustento técnico" }, st), "Proyectista rechaza el segundo ticket");
console.log(`  · versión intacta: ${st.selection!.version === vBefore}, prioridad intacta: ${st.selection_items.find((i) => i.id === inodoros.id)!.priority}`);

// 2:35 — Proyectista finaliza
expectFail(svc.finalizeSelection({ ...L, requestId: rid(), expectedVersion: st.selection!.version }, st), "Logística NO puede finalizar");
st = ok(svc.finalizeSelection({ ...D, requestId: rid(), expectedVersion: st.selection!.version }, st), "Proyectista finaliza la lista");
console.log(`[Finalizada] status=${st.selection!.status}, sello=${st.selection!.finalized_by_role}`);

// Inmutable para todos
expectFail(
  svc.editItem({ ...D, requestId: rid(), expectedVersion: st.selection!.version, itemId: inodoros.id, patch: { quantity: 1 } }, st),
  "editar lista finalizada",
);

// Persistencia: guardar y recargar
saveState(st);
const reloaded = loadState();
console.log(`[Persistencia] recarga conserva lista=${!!reloaded.selection} tickets=${reloaded.change_requests.length} log=${reloaded.activity_log.length}`);

console.log("\n--- Actividad ---");
for (const e of st.activity_log) {
  console.log(`  ${e.actor_role.padEnd(16)} ${e.action.padEnd(28)} ${JSON.stringify(e.after ?? {})}`);
}
console.log("\nOK: guion de demo completo sin errores.");
