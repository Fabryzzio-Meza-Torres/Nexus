import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG } from "./fixtures.ts";
import { extractRequirementsFromText, toRequirements } from "./extract.ts";

const demoDoc = readFileSync(
  new URL("../../../../data/demo-document.md", import.meta.url),
  "utf8",
);

test("el texto real del documento de ejemplo produce 6 requisitos con cantidades", () => {
  const raws = extractRequirementsFromText(demoDoc, CATALOG);
  assert.equal(raws.length, 6);
  const inodoros = raws.find((r) => r.type_name === "Inodoros");
  assert.ok(inodoros);
  assert.equal(inodoros!.quantity, 20);
  assert.equal(inodoros!.category, "Sanitaria");
  assert.ok(raws.every((r) => r.quantity === null || r.quantity > 0));
});

test("texto sin tipos conocidos -> sin requisitos (no se inventa nada)", () => {
  const raws = extractRequirementsFromText(
    "Reunión de obra el martes. Pendiente revisar el cronograma y el acta.",
    CATALOG,
  );
  assert.deepEqual(raws, []);
});

test("texto pegado libre: detecta tipo y cantidad", () => {
  const raws = extractRequirementsFromText(
    "Se requieren 24 tomacorrientes dobles 220V para el tercer piso.",
    CATALOG,
  );
  const t = raws.find((r) => r.type_name === "Tomacorrientes");
  assert.ok(t, "debe detectar Tomacorrientes");
  assert.equal(t!.quantity, 24);
  assert.equal(t!.category, "Eléctrica");
  assert.equal(t!.specifications["tension"], "220V");
});

test("texto libre con varios ítems en una frase", () => {
  const raws = extractRequirementsFromText(
    "Necesitamos 30 inodoros, 12 luminarias interiores LED y 8 urinarios para el bloque B.",
    CATALOG,
  );
  const byType = Object.fromEntries(raws.map((r) => [r.type_name, r.quantity]));
  assert.equal(byType["Inodoros"], 30);
  assert.equal(byType["Luminarias interiores LED"], 12);
  assert.equal(byType["Urinarios"], 8);
});

test("toRequirements asigna IDs estables y no crea productos", () => {
  const raws = extractRequirementsFromText(demoDoc, CATALOG);
  const reqs = toRequirements(raws, "project-demo", "doc-x");
  assert.equal(reqs[0].id, "req-doc-x-1");
  assert.equal(reqs[0].project_id, "project-demo");
  assert.ok(!("sku" in reqs[0]) && !("catalog_item_id" in reqs[0]));
});
