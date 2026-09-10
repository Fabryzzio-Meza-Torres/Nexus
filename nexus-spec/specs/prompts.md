# Nexus — Prompts para copiar en orden
## 1. Arranque y flujo completo
```text
Lee START-HERE.md, CLAUDE.md, specs/spec.md, roles-requirements-matrix.md, data-model.md y implementation-plan.md dentro de specs donde corresponda. Implementa /demo con fixtures del paquete. Matching produce propuesta separada; Proyectista crea y es único editor de la lista oficial. Logística pide tickets sin mutarla; Proyectista acepta aplicando cambio atómico o rechaza conservándola; solo Proyectista finaliza. Residente consulta. Muestra proveedor, ubicación, distancia y dos rankings. No implementes Auth real. Prueba flujo completo local antes de integrar servicios.
```
## 2. Apoyo de catálogo
```text
Lee specs/catalog-generator.md y specs/data-model.md. Ejecuta scripts/catalog/import_catalog.py usando data/source/catalogo-marcas-por-tipo.csv. Verifica 60 filas de clasificación, 180 asociaciones y ofertas demo con proveedor/ubicación/SKU/procedencia. El CSV no acredita modelos ni ventas. No uses fichas técnicas para construir ni enriquecer catálogo. Entrega datos, fixtures y CATALOG-REPORT.md; no cambies UI, Supabase ni package.json.
```
## 3. Matching y revisión
```text
Implementa specs/features/global-matching.md y technical-review.md. Respeta unknown_fields, no inventes atributos; score explicable, Haversine, ranking recomendado y solo cercanía. Propuesta no muta lista. Prueba incompatibles, distancia faltante y desempates.
```
## 4. Persistencia y tickets
```text
Lee specs/data-model.md, specs/technical-architecture.md y specs/features/change-requests.md. En el proyecto Supabase de desarrollo configura tablas y RPC atómica para aceptar ticket/finalizar, generando migración y tipos. Conserva guardas en servicio, seed idempotente y fallback local. Prueba doble aceptación, versión obsoleta, rol no permitido y rollback. No expongas service-role al navegador.
```
## 5. Extracción
```text
Implementa specs/ai-spec.md y features/document-processing.md. Gemini solo extrae Requirement[], valida datos y ofrece fixture explícito en fallos. Fichas son consultas de prueba, nunca fuente del catálogo. Reanalizar no sobrescribe lista oficial.
```
## 6. Validación y cierre
```text
Ejecuta specs/acceptance-tests.md, typecheck, lint y build. Ensaya specs/demo-plan.md. Corrige contradicciones con CLAUDE.md y permisos. Reporta pruebas realizadas y pendientes; no añadas features P1 antes de completar P0.
```
