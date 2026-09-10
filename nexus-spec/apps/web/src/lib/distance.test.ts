import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm } from "./distance.ts";

test("mismo punto = 0 km", () => {
  const p = { latitude: -12.1211, longitude: -77.0298 };
  assert.equal(haversineKm(p, p), 0);
});

test("un grado en el ecuador ≈ 111.195 km", () => {
  const d = haversineKm(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
  );
  assert.ok(d !== null);
  assert.ok(Math.abs(d! - 111.195) < 0.05, `esperado ~111.195, obtuve ${d}`);
});

test("coordenada faltante -> null (nunca 0)", () => {
  assert.equal(haversineKm(null, { latitude: 0, longitude: 0 }), null);
  assert.equal(
    haversineKm(
      { latitude: 0, longitude: 0 },
      { latitude: Number.NaN, longitude: 0 },
    ),
    null,
  );
});
