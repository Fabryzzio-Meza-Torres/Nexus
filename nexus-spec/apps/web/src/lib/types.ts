// Contratos de datos — transcripción literal de specs/data-model.md.
// Estas formas y nombres de campo NO deben cambiar: todo el servicio, el matching
// y la persistencia dependen de ellos.

export type Role = "logistics" | "project_designer" | "site_resident";

export type Location = {
  district?: string;
  city: string;
  region?: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type CatalogItem = {
  id: string;
  sku: string;
  product_family_key: string;
  name: string;
  category: string;
  type_name: string;
  brand: string;
  description: string;
  specifications: Record<string, unknown>;
  supplier_name: string;
  supplier_logo_url: string | null;
  supplier_location: Location;
  provenance_type: "synthetic";
  is_demo_data: true;
  source_file: string;
  source_row: number;
  source_brand_column: string;
  source_confidence: string;
  field_provenance: {
    category: "csv";
    type_name: "csv";
    brand: "csv";
    supplier_name: "synthetic";
    supplier_location: "synthetic";
    // El seed genera specs sintéticas rotuladas; "unknown" queda para datos sin generar.
    specifications: "synthetic" | "unknown";
  };
};

export type Project = {
  id: string;
  name: string;
  project_location: Location | null;
  created_at: string;
  is_demo_data?: boolean;
};

export type Requirement = {
  id: string;
  project_id: string;
  document_id: string;
  category: string;
  type_name: string;
  quantity: number | null;
  unit: string | null;
  specifications: Record<string, unknown>;
  keywords: string[];
  source_excerpt: string;
  confidence: number | null;
};

export type MatchCandidate = {
  requirement_ids: string[];
  catalog_item_id: string;
  compatibility_score: number;
  reasons: string[];
  unknown_fields: string[];
  needs_review: boolean;
  distance_km: number | null;
};

export type MatchProposal = {
  id: string;
  project_id: string;
  document_id: string;
  created_at: string;
  candidates: MatchCandidate[];
  unmatched_requirement_ids: string[];
};

export type SelectionStatus = "draft" | "finalized";

export type CoverageResolution = {
  requirement_id: string;
  reason: string;
  resolved_by: string;
  resolved_at: string;
};

export type Selection = {
  id: string;
  project_id: string;
  status: SelectionStatus;
  version: number;
  created_by: string;
  created_by_role: "project_designer";
  created_at: string;
  finalized_by: string | null;
  finalized_by_role: "project_designer" | null;
  finalized_at: string | null;
  coverage_resolutions: CoverageResolution[];
};

export type Priority = "high" | "medium" | "normal";
export type ReviewStatus = "clear" | "needs_review" | "resolved";

export type SelectionItem = {
  id: string;
  selection_id: string;
  catalog_item_id: string;
  requirement_ids: string[];
  quantity: number;
  unit: string;
  priority: Priority;
  compatibility_score: number;
  match_reasons: string[];
  review_status: ReviewStatus;
  review_note: string | null;
  resolved_by: string | null;
  resolved_by_role: "project_designer" | null;
  created_at: string;
  updated_at: string;
};

export type ChangeRequestType =
  | "add_product"
  | "remove_product"
  | "replace_product"
  | "change_quantity"
  | "change_priority";

export type ChangeRequestPayload =
  | { kind: "add_product"; catalog_item_id: string; quantity: number; unit: string; priority: Priority; requirement_ids: string[] }
  | { kind: "remove_product" }
  | { kind: "replace_product"; catalog_item_id: string }
  | { kind: "change_quantity"; quantity: number }
  | { kind: "change_priority"; priority: Priority };

export type ChangeRequestStatus = "pending" | "accepted" | "rejected";

export type ChangeRequest = {
  id: string;
  selection_id: string;
  selection_item_id: string | null;
  requested_by: string;
  requested_by_role: "logistics";
  type: ChangeRequestType;
  requested_value: ChangeRequestPayload;
  reason: string;
  status: ChangeRequestStatus;
  base_selection_version: number;
  resolved_by: string | null;
  resolved_by_role: "project_designer" | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  // snapshot del ítem objetivo, para que un ticket cuyo destino se eliminó siga siendo legible
  target_snapshot: SelectionItem | null;
};

export type ActivityLog = {
  id: string;
  project_id: string;
  selection_id: string | null;
  actor_id: string;
  actor_role: Role;
  action: string;
  entity_id: string;
  request_id: string | null;
  before: unknown | null;
  after: unknown | null;
  created_at: string;
};

// Estado completo persistido en localStorage bajo una clave versionada.
export type NexusState = {
  schema_version: 1;
  project: Project;
  requirements: Requirement[];
  proposal: MatchProposal | null;
  extraction_source: "parser" | "gemini" | "ejemplo" | "demo";
  extraction_notice: string | null;
  selection: Selection | null;
  selection_items: SelectionItem[];
  change_requests: ChangeRequest[];
  activity_log: ActivityLog[];
  processed_request_ids: string[];
};
