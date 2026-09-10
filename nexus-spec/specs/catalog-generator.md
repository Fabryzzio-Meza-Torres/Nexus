# Nexus — Importación del catálogo CSV
## Input y alcance real
data/source/catalogo-marcas-por-tipo.csv: UTF-8, separador coma, seis encabezados exactos: Especialidad, Tipo, Marca 1, Marca 2, Marca 3, Confianza. Hay comas entrecomilladas en Confianza; usar parser CSV, nunca split(',').
60 filas: Sanitaria 20, Eléctrica 20, Mecánica 20. Tres marcas por fila → 180 asociaciones. Este archivo es una clasificación tipo/marca; no acredita ofertas comprables ni proveedores reales.
## Dos salidas distintas
catalog-taxonomy.json conserva asociaciones y procedencia del CSV. catalog.json convierte cada asociación en una oferta DEMO sintética explícita: nombre/SKU ficticios, proveedor DEMO, ubicación demo y specifications={}. No inventar atributos técnicos como si estuvieran en la fuente. Marca no es proveedor.
Todo catalog item generado tiene provenance_type=synthetic, is_demo_data=true y field_provenance. source_confidence conserva texto del autor del CSV, no es aprobación propia ni compatibility_score. Mantener source_row (registro CSV contando encabezado como 1) y source_brand_column.
## Ejecutar
Desde raíz: `python scripts/catalog/import_catalog.py`. No requiere paquetes, red, IA ni fichas. Regenera data/catalog-taxonomy.json, data/catalog.json, data/import-report.json, data/demo-requirements.json, data/demo-project.json, data/demo-document.md y CATALOG-REPORT.md.
Conservar CSV original en data/source/; normalizar espacios externos/NFC en JSON. Expandir columnas de marca no vacías. Deduplicar especialidad+tipo+marca normalizados casefold; no fusionar mismo brand entre tipos distintos. IDs y SKU SHA256 deterministas; orden de fuente reproducible. Encabezados inválidos/filas incompletas fallan explícitamente.
Validar >=30 ofertas, IDs/SKU únicos, proveedor/ubicación válidos y >=3 familias con varios proveedores. Las 180 ofertas cubren los 60 tipos del CSV; no limitar arbitrariamente a 30–50 perdiendo cobertura. Agrupar por familia no prueba equivalencia.
## Ubicaciones
Tres proveedores ficticios Centro/Este/Sur, con coordenadas aproximadas demo en Lima. No son direcciones ni sucursales verificadas de las marcas. No geocodificar marcas como si fueran tiendas. La UI debe mostrar demo.
## Seed
Usar catalog.json como seed en repositorio local o upsert servidor por id en Supabase según supabase/README.md. No borrar productos referenciados al reimportar. No se entregan ventas, precios ni stock verificados.
## Fichas
Las fichas técnicas solo entran en el flujo de consulta/Requirement[] para probar matching; el importador no las abre. Si faltan datos técnicos, el resultado exige revisión del Proyectista, no enriquecimiento desde esas fichas.
