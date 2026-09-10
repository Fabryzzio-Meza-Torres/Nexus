import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogItem, Requirement } from "./types.ts";
import {
  isEligible,
  candidatesFor,
  rankRecommended,
  rankNearest,
  type Rankable,
} from "./matching.ts";

function item(over: Partial<CatalogItem>): CatalogItem {
  return {
    id: "x",
    sku: "X",
    product_family_key: "f",
    name: "n",
    category: "Sanitaria",
    type_name: "Inodoros",
    brand: "b",
    description: "",
    specifications: {},
    supplier_name: "Proveedor DEMO Centro",
    supplier_logo_url: null,
    supplier_location: { city: "Lima", country: "PE", latitude: -12, longitude: -77 },
    provenance_type: "synthetic",
    is_demo_data: true,
    source_file: "f",
    source_row: 2,
    source_brand_column: "Marca 1",
    source_confidence: "",
    field_provenance: {
      category: "csv",
      type_name: "csv",
      brand: "csv",
      supplier_name: "synthetic",
      supplier_location: "synthetic",
      specifications: "unknown",
    },
    ...over,
  };
}

const req: Requirement = {
  id: "r1",
  project_id: "p",
  document_id: "d",
  category: "Sanitaria",
  type_name: "Inodoros",
  quantity: 20,
  unit: "unidad",
  specifications: {},
  keywords: ["Inodoros"],
  source_excerpt: "20 unidades de Inodoros",
  confidence: 1,
};

test("un incompatible (otra categoría) nunca es elegible", () => {
  const elec = item({ id: "e1", category: "Eléctrica", type_name: "Tomacorrientes" });
  assert.equal(isEligible(req, elec), false);
  assert.equal(candidatesFor(req, [elec]).length, 0);
});

test("a igual compatibilidad gana el proveedor más cercano en Recomendados", () => {
  const rows: Rankable[] = [
    { catalog_item_id: "a", compatibility_score: 60, distance_km: 14 },
    { catalog_item_id: "b", compatibility_score: 60, distance_km: 8 },
  ];
  assert.equal(rankRecommended(rows)[0].catalog_item_id, "b");
});

test("menos compatible y más cerca: primero solo en Más cercanos", () => {
  const rows: Rankable[] = [
    { catalog_item_id: "far-good", compatibility_score: 60, distance_km: 20 },
    { catalog_item_id: "near-weak", compatibility_score: 30, distance_km: 3 },
  ];
  assert.equal(rankRecommended(rows)[0].catalog_item_id, "far-good");
  assert.equal(rankNearest(rows)[0].catalog_item_id, "near-weak");
});

test("distancia null se ordena al final", () => {
  const rows: Rankable[] = [
    { catalog_item_id: "nd", compatibility_score: 60, distance_km: null },
    { catalog_item_id: "d10", compatibility_score: 60, distance_km: 10 },
  ];
  assert.equal(rankNearest(rows)[0].catalog_item_id, "d10");
  assert.equal(rankRecommended(rows)[0].catalog_item_id, "d10");
});

test("sin criterios de especificación: cat+tipo+keyword = 60, va a revisión (< 70)", () => {
  const cands = candidatesFor(req, [item({ name: "Inodoros — Trébol — Variante DEMO 1" })]);
  assert.equal(cands[0].compatibility_score, 60);
  assert.equal(cands[0].needs_review, true);
});

test("con especificaciones coincidentes el score sube por encima del umbral", () => {
  const specReq = { ...req, specifications: { montaje: "piso", material: "porcelana" } };
  const good = candidatesFor(specReq, [
    item({ name: "Inodoros A", specifications: { montaje: "piso", material: "porcelana", alto: "78 cm" } }),
  ]);
  assert.ok(good[0].compatibility_score >= 70, `esperado >=70, fue ${good[0].compatibility_score}`);
  assert.equal(good[0].needs_review, false);

  const partial = candidatesFor(specReq, [
    item({ name: "Inodoros B", specifications: { montaje: "pared", material: "acero" } }),
  ]);
  assert.ok(partial[0].compatibility_score < good[0].compatibility_score);
});
