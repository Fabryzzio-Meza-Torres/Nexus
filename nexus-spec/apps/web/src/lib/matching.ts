// Matching global y rankings — specs/features/global-matching.md.
// Produce una propuesta consultable; NUNCA escribe la lista oficial.
// Solo IDs existentes del catálogo. Incompatibles (categoría distinta) excluidos.
import type {
  CatalogItem,
  Requirement,
  MatchCandidate,
  MatchProposal,
} from "./types.ts";
import { haversineKm } from "./distance.ts";
import { computeNeedsReview } from "./review.ts";

export function norm(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(s: string): string[] {
  return norm(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

// ---- Pesos del scoring (NO cambiar: contrato del proyecto) ----
const W_CATEGORY = 15;
const W_TYPE = 30;
const W_SPECS = 30; // especificaciones no dimensionales
const W_KEYWORDS = 15;
const W_DIMENSIONS = 10;

const DIMENSION_KEYS = new Set([
  "largo",
  "ancho",
  "alto",
  "diametro",
  "diámetro",
  "profundidad",
  "espesor",
  "peso",
  "length",
  "width",
  "height",
  "depth",
  "weight",
  "diameter",
]);

/** Un ítem es elegible para un requerimiento solo si la categoría coincide.
 * Categoría distinta = incompatible: nunca entra a ningún ranking. */
export function isEligible(req: Requirement, item: CatalogItem): boolean {
  return norm(req.category) === norm(item.category);
}

function typeTokenOverlap(req: Requirement, item: CatalogItem): number {
  const reqT = tokens(req.type_name);
  if (reqT.length === 0) return 0;
  const itemT = new Set(tokens(item.type_name));
  return reqT.filter((t) => itemT.has(t)).length / reqT.length;
}

/** Un ítem es candidato si es de la misma categoría y el tipo coincide exacto.
 * Solo cuando NINGÚN ítem coincide exacto (p. ej. un tipo difuso de la IA) se
 * admite un solapamiento de tokens alto como aproximación. Un ítem de otro tipo
 * de la misma categoría no es una alternativa. */
function isExactType(req: Requirement, item: CatalogItem): boolean {
  return isEligible(req, item) && norm(req.type_name) === norm(item.type_name);
}
function isFuzzyType(req: Requirement, item: CatalogItem): boolean {
  return isEligible(req, item) && typeTokenOverlap(req, item) >= 0.6;
}

type Scored = {
  score: number;
  reasons: string[];
  unknown_fields: string[];
  secondGroupHits: number;
};

function scoreItem(req: Requirement, item: CatalogItem): Scored {
  const reasons: string[] = [];
  const unknown: string[] = [];

  // Grupo categoría/tipo (45)
  let catType = 0;
  if (norm(req.category) === norm(item.category)) {
    catType += W_CATEGORY;
    reasons.push(`Categoría coincide: ${item.category}`);
  }
  if (norm(req.type_name) === norm(item.type_name)) {
    catType += W_TYPE;
    reasons.push(`Tipo coincide: ${item.type_name}`);
  } else {
    const reqT = tokens(req.type_name);
    const itemT = new Set(tokens(item.type_name));
    const hit = reqT.filter((t) => itemT.has(t)).length;
    if (reqT.length > 0 && hit > 0) {
      const prop = hit / reqT.length;
      catType += W_TYPE * prop;
      reasons.push(`Tipo parcialmente relacionado: ${item.type_name}`);
    }
  }

  // Grupo especificaciones no dimensionales (30)
  const reqSpecKeys = Object.keys(req.specifications ?? {});
  const nonDimKeys = reqSpecKeys.filter((k) => !DIMENSION_KEYS.has(norm(k)));
  const dimKeys = reqSpecKeys.filter((k) => DIMENSION_KEYS.has(norm(k)));
  let specScore = 0;
  if (nonDimKeys.length > 0) {
    let matched = 0;
    for (const k of nonDimKeys) {
      const iv = (item.specifications ?? {})[k];
      if (iv === undefined) {
        unknown.push(k);
      } else if (norm(String(iv)) === norm(String(req.specifications[k]))) {
        matched += 1;
      }
    }
    specScore = W_SPECS * (matched / nonDimKeys.length);
    if (matched > 0) reasons.push(`Especificaciones coincidentes: ${matched}/${nonDimKeys.length}`);
  }
  // Si no hay criterios, aporta 0 y NO se redistribuye su peso.

  // Grupo keywords (15)
  const reqKw = tokens((req.keywords ?? []).join(" ") || req.type_name);
  let kwScore = 0;
  if (reqKw.length > 0) {
    const haystack = new Set(
      tokens(`${item.name} ${item.type_name} ${item.brand} ${item.description}`),
    );
    const present = reqKw.filter((t) => haystack.has(t));
    kwScore = W_KEYWORDS * (present.length / reqKw.length);
    if (present.length > 0) reasons.push(`Coincidencia de palabras clave: ${present.join(", ")}`);
  }

  // Grupo dimensiones (10)
  let dimScore = 0;
  if (dimKeys.length > 0) {
    let matched = 0;
    for (const k of dimKeys) {
      const iv = (item.specifications ?? {})[k];
      if (iv === undefined) unknown.push(k);
      else if (norm(String(iv)) === norm(String(req.specifications[k]))) matched += 1;
    }
    dimScore = W_DIMENSIONS * (matched / dimKeys.length);
  }

  const score = Math.round(catType + specScore + kwScore + dimScore);
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    unknown_fields: unknown,
    secondGroupHits: nonDimKeys.length + dimKeys.length,
  };
}

export function requirementHasSpecCriteria(req: Requirement): boolean {
  return Object.keys(req.specifications ?? {}).length > 0;
}

/** Candidatos ordenados por score para un requerimiento (mejor primero). */
export function candidatesFor(
  req: Requirement,
  catalog: CatalogItem[],
): MatchCandidate[] {
  let eligible = catalog.filter((c) => isExactType(req, c));
  if (eligible.length === 0) eligible = catalog.filter((c) => isFuzzyType(req, c));
  const scored = eligible.map((item) => ({ item, ...scoreItem(req, item) }));
  scored.sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : 1));
  // Empate en la cúspide: si los dos mejores están a ≤ delta, la elección es
  // ambigua y esos dos van a revisión (no el resto de alternativas).
  const topTie =
    scored.length > 1 && scored[0].score - scored[1].score <= 0
      ? false
      : scored.length > 1 && scored[0].score - scored[1].score <= 5;

  return scored.map((s, idx) => ({
    requirement_ids: [req.id],
    catalog_item_id: s.item.id,
    compatibility_score: s.score,
    reasons: s.reasons,
    unknown_fields: dedupe([
      ...s.unknown_fields,
      ...(requirementHasSpecCriteria(req) && Object.keys(s.item.specifications ?? {}).length === 0
        ? ["specifications"]
        : []),
    ]),
    needs_review: computeNeedsReview({
      score: s.score,
      ambiguousTopPick: idx < 2 && topTie,
      requirementHasSpecCriteria: requirementHasSpecCriteria(req),
      itemHasSpecs: Object.keys(s.item.specifications ?? {}).length > 0,
    }),
    distance_km: null,
  }));
}

function dedupe<T>(a: T[]): T[] {
  return [...new Set(a)];
}

/**
 * Propuesta global: un bloque de candidatos por requerimiento.
 * Requerimientos idénticos (misma categoría+tipo+unidad) se fusionan sumando
 * cantidad conocida. No escribe selección.
 */
export function buildProposal(
  requirements: Requirement[],
  catalog: CatalogItem[],
  projectId: string,
  documentId: string,
): MatchProposal {
  const groups = new Map<string, Requirement[]>();
  for (const r of requirements) {
    const key = `${norm(r.category)}|${norm(r.type_name)}|${norm(r.unit ?? "")}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }

  const candidates: MatchCandidate[] = [];
  const unmatched: string[] = [];

  for (const reqs of groups.values()) {
    const head = reqs[0];
    const merged: Requirement =
      reqs.length === 1
        ? head
        : {
            ...head,
            quantity: reqs.every((r) => r.quantity !== null)
              ? reqs.reduce((s, r) => s + (r.quantity ?? 0), 0)
              : null,
          };
    const reqIds = reqs.map((r) => r.id);
    const cands = candidatesFor(merged, catalog).map((c) => ({
      ...c,
      requirement_ids: reqIds,
    }));
    if (cands.length === 0) {
      unmatched.push(...reqIds);
    } else {
      candidates.push(...cands);
    }
  }

  return {
    id: `proposal-${Date.now().toString(36)}`,
    project_id: projectId,
    document_id: documentId,
    created_at: new Date().toISOString(),
    candidates,
    unmatched_requirement_ids: unmatched,
  };
}

// ---------------- Rankings ----------------

export type Rankable = {
  catalog_item_id: string;
  compatibility_score: number;
  distance_km: number | null;
};

function byDistanceThenId(a: Rankable, b: Rankable): number {
  if (a.distance_km === null && b.distance_km === null) return cmpId(a, b);
  if (a.distance_km === null) return 1;
  if (b.distance_km === null) return -1;
  return a.distance_km - b.distance_km || cmpId(a, b);
}

function cmpId(a: Rankable, b: Rankable): number {
  return a.catalog_item_id < b.catalog_item_id ? -1 : a.catalog_item_id > b.catalog_item_id ? 1 : 0;
}

/** Recomendados: compatibility DESC → distance ASC → id ASC. */
export function rankRecommended<T extends Rankable>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => b.compatibility_score - a.compatibility_score || byDistanceThenId(a, b),
  );
}

/** Más cercanos: distance ASC → id ASC. Compatibilidad visible; sin incompatibles. */
export function rankNearest<T extends Rankable>(rows: T[]): T[] {
  return [...rows].sort(byDistanceThenId);
}

/** Rellena distance_km de cada candidato contra la ubicación del proyecto. */
export function withDistances(
  candidates: MatchCandidate[],
  catalog: CatalogItem[],
  projectLoc: { latitude: number; longitude: number } | null,
): MatchCandidate[] {
  return candidates.map((c) => {
    const item = catalog.find((x) => x.id === c.catalog_item_id);
    return {
      ...c,
      distance_km: item && projectLoc ? haversineKm(projectLoc, item.supplier_location) : null,
    };
  });
}
