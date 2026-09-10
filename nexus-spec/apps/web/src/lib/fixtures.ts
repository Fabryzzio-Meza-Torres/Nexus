// Carga de datos generados por el importador (scripts/catalog/import_catalog.py).
// El catálogo viene del CSV; los requerimientos y el documento demo son fixtures
// de consulta. Ninguna ficha técnica alimenta esto.
import catalogJson from "../../../../data/catalog.json" with { type: "json" };
import requirementsJson from "../../../../data/demo-requirements.json" with { type: "json" };
import projectJson from "../../../../data/demo-project.json" with { type: "json" };
import type { CatalogItem, Requirement, Project } from "./types.ts";

export const CATALOG = catalogJson as unknown as CatalogItem[];

export const DEMO_REQUIREMENTS = requirementsJson as unknown as Requirement[];

const rawProject = projectJson as unknown as {
  id: string;
  name: string;
  project_location: Project["project_location"];
  is_demo_data?: boolean;
};

export const DEMO_PROJECT: Project = {
  id: rawProject.id,
  name: rawProject.name,
  project_location: rawProject.project_location,
  created_at: "2026-09-10T00:00:00.000Z",
  is_demo_data: rawProject.is_demo_data ?? true,
};

export function catalogById(id: string): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}
