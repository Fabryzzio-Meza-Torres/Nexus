// Persistencia local. Una lectura, cálculo del estado siguiente COMPLETO, una
// escritura. Nunca estado parcial. Clave versionada: si cambia la forma, se
// descarta en vez de corromper. specs/technical-architecture.md (repo local).
import type { NexusState } from "./types.ts";
import { DEMO_PROJECT } from "./fixtures.ts";

// Clave versionada: al subirla, cualquier estado guardado de una versión
// anterior de la demo se ignora y se arranca limpio.
const KEY = "nexus.state.v2";
const STALE_KEYS = ["nexus.state.v1"];

export function initialState(): NexusState {
  return {
    schema_version: 1,
    project: DEMO_PROJECT,
    requirements: [],
    proposal: null,
    extraction_source: "parser",
    extraction_notice: null,
    selection: null,
    selection_items: [],
    change_requests: [],
    activity_log: [],
    processed_request_ids: [],
  };
}

export function loadState(): NexusState {
  if (typeof window === "undefined") return initialState();
  try {
    for (const k of STALE_KEYS) window.localStorage.removeItem(k);
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as NexusState;
    if (parsed.schema_version !== 1) return initialState();
    return parsed;
  } catch {
    return initialState();
  }
}

/** Borra todo rastro de la demo en este navegador. */
export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  for (const k of STALE_KEYS) window.localStorage.removeItem(k);
}

export function saveState(next: NexusState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function resetState(): NexusState {
  const fresh = initialState();
  saveState(fresh);
  return fresh;
}
