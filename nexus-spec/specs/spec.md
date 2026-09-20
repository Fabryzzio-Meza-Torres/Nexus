# Nexus — Especificación de producto
Versión CSV + roles, 10 de septiembre de 2026. Actualiza el paquete nexus-hackathon-2h30-final.zip.
## Problema y cliente
Las constructoras necesitan convertir listas de requerimientos fragmentadas en una decisión trazable de qué producto cotizar y con qué proveedor, considerando compatibilidad y cercanía para evaluar logística de flete.
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

## P0
Importador reproducible; catálogo demo >=30 ofertas; extracción PDF/MD real o fixture; una propuesta global con cobertura de requerimientos; lista oficial persistente creada por Proyectista; tickets y revisión técnica; cierre exclusivo; proveedor/ubicación/distancia; dos rankings; filtros por especialidad/proveedor; trazabilidad visible.
## P1
Realtime, comparador lateral, búsqueda manual mejorada y exportación de la lista final. No bloquear P0 con estas mejoras.
## Fuera de alcance
Auth/RBAC real, inventario/precios verificados, cotización automática, pagos, ERP/BIM, voz y embeddings obligatorios. Distancia es aproximación geográfica, no ruta, tarifa ni cálculo de flete.
## Aceptación
Aplicar specs/acceptance-tests.md. Mantener una propuesta independiente de la lista oficial incluso al reanalizar documentos.
