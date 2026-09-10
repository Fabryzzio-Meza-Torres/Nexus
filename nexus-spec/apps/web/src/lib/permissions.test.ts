import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./store.ts";
import { DEMO_REQUIREMENTS, CATALOG } from "./fixtures.ts";
import { buildProposal } from "./matching.ts";
import type { NexusState, Role } from "./types.ts";
import * as svc from "./service.ts";

let n = 0;
const rid = () => `p-${++n}`;

function baseState(): NexusState {
  const b = initialState();
  const requirements = DEMO_REQUIREMENTS.map((r, i) => ({
    ...r,
    id: `req-demo-${i + 1}`,
    project_id: b.project.id,
    document_id: "doc-1",
  }));
  return { ...b, requirements, proposal: buildProposal(requirements, CATALOG, b.project.id, "doc-1") };
}

function withSelection(): NexusState {
  const st = baseState();
  const r = svc.createSelection(
    { actor: "designer-demo", role: "project_designer", requestId: rid() },
    st,
  );
  assert.equal(r.ok, true);
  return (r as { state: NexusState }).state;
}

const OTHER_ROLES: Record<string, Role[]> = {
  createSelection: ["logistics", "site_resident"],
  editItem: ["logistics", "site_resident"],
  addItem: ["logistics", "site_resident"],
  removeItem: ["logistics", "site_resident"],
  createChangeRequest: ["project_designer", "site_resident"],
  acceptChangeRequest: ["logistics", "site_resident"],
  rejectChangeRequest: ["logistics", "site_resident"],
  resolveReview: ["logistics", "site_resident"],
  finalizeSelection: ["logistics", "site_resident"],
  setProjectLocation: ["logistics", "site_resident"],
};

test("cada comando rechaza los roles no autorizados sin mutar el estado", () => {
  const st = withSelection();
  const snapshot = JSON.stringify(st);
  const item = st.selection_items[0];

  const calls: Record<string, (role: Role) => svc.ServiceResult> = {
    createSelection: (role) => svc.createSelection({ actor: "a", role, requestId: rid() }, st),
    editItem: (role) =>
      svc.editItem({ actor: "a", role, requestId: rid(), expectedVersion: 1, itemId: item.id, patch: { quantity: 5 } }, st),
    addItem: (role) =>
      svc.addItem({ actor: "a", role, requestId: rid(), expectedVersion: 1, catalog_item_id: CATALOG[0].id, requirement_ids: [], quantity: 1, unit: "unidad", priority: "normal" }, st),
    removeItem: (role) =>
      svc.removeItem({ actor: "a", role, requestId: rid(), expectedVersion: 1, itemId: item.id }, st),
    createChangeRequest: (role) =>
      svc.createChangeRequest({ actor: "a", role, requestId: rid(), type: "change_quantity", payload: { kind: "change_quantity", quantity: 3 }, itemId: item.id, reason: "x", baseVersion: 1 }, st),
    acceptChangeRequest: (role) =>
      svc.acceptChangeRequest({ actor: "a", role, requestId: rid(), expectedVersion: 1, changeRequestId: "nope" }, st),
    rejectChangeRequest: (role) =>
      svc.rejectChangeRequest({ actor: "a", role, requestId: rid(), changeRequestId: "nope", note: "x" }, st),
    resolveReview: (role) =>
      svc.resolveReview({ actor: "a", role, requestId: rid(), expectedVersion: 1, itemId: item.id, note: "x" }, st),
    finalizeSelection: (role) =>
      svc.finalizeSelection({ actor: "a", role, requestId: rid(), expectedVersion: 1 }, st),
    setProjectLocation: (role) =>
      svc.setProjectLocation({ actor: "a", role, requestId: rid(), location: { city: "Lima", country: "PE", latitude: -12, longitude: -77 } }, st),
  };

  for (const [name, fn] of Object.entries(calls)) {
    for (const role of OTHER_ROLES[name]) {
      const res = fn(role);
      assert.equal(res.ok, false, `${name} debería rechazar a ${role}`);
      assert.equal((res as { code: string }).code, "forbidden", `${name}/${role} -> forbidden`);
    }
  }

  assert.equal(JSON.stringify(st), snapshot, "el estado no cambió");
});
