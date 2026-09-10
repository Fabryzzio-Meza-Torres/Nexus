# Nexus — Empieza aquí
Paquete para 150 minutos. Lee CLAUDE.md → specs/spec.md → specs/implementation-plan.md → specs/roles-requirements-matrix.md → specs/data-model.md → specs/catalog-generator.md → specs/ai-spec.md → specs/ux.md.
## Primer paso
Desde la raíz del paquete, ejecuta `python scripts/catalog/import_catalog.py` (Python 3, solo biblioteca estándar). En Windows también puedes usar `py`.
Ya se incluyen catálogo y fixtures generados; no necesitas ejecutar Python durante la demo.
## Contrato vigente
- El CSV `data/source/catalogo-marcas-por-tipo.csv` es el input principal del catálogo. Contiene clasificación y marcas, no ofertas verificadas.
- Las fichas técnicas son exclusivamente documentos de prueba para extraer requerimientos y buscar/matchear contra el catálogo. Nunca alimentan su construcción ni enriquecimiento.
- La IA produce `Requirement[]`. El matching produce una propuesta global separada; no escribe la lista oficial.
- Proyectista (`project_designer`) crea la lista oficial desde la propuesta, es su único editor directo, resuelve revisiones y acepta/finaliza la lista.
- Logística (`logistics`) carga documentos, consulta, ordena/filtra y solicita cambios mediante tickets. Sus solicitudes no mutan la lista.
- Al aceptar un ticket, el Proyectista aplica su cambio y registra la aceptación en una única operación atómica. Rechazar conserva la lista.
- Residente (`site_resident`) consulta y revisa contexto. No edita, resuelve tickets ni finaliza.
- Cada oferta tiene proveedor obligatorio y ubicación. Marca y proveedor son campos distintos. Los proveedores/coordenadas ficticios llevan etiqueta visible de demo.
- Ranking Recomendados: compatibilidad descendente, luego distancia ascendente. Más cercanos: distancia ascendente, manteniendo visible la compatibilidad y las alertas.
- Una lista por proyecto; cambiar rol o filtros no cambia su contenido ni prioridad oficial. Roles simulados, sin Auth/RBAC real; validar acciones en el servicio además de la UI.

## Flujo
Documento → requerimientos → propuesta con productos/proveedores → Proyectista crea lista oficial → Logística solicita → Proyectista acepta/rechaza → Proyectista finaliza → Lista lista para cotizar.
Arranca con /demo y persistencia local. Reemplaza después por Supabase y extracción Gemini sin romper el fallback.
