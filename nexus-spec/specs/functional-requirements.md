# Nexus — Requisitos funcionales

Todos los siguientes son P0.

| ID | Acción | Actor | Aceptación |
|---|---|---|---|
| FR-001 | Seleccionar rol | Todos | Selector logistics/project_designer/site_resident; no crea otra lista. |
| FR-002 | Abrir proyecto | Todos | Proyecto demo con ubicación editable solo por Proyectista; crear lista requiere Proyectista. |
| FR-003 | Cargar documento | Logística | PDF/MD/fixture para consulta; no altera catálogo/lista. |
| FR-004 | Analizar | Logística | Requirement[] validado; fallo ofrece fixture identificado como demo. |
| FR-005 | Consultar requerimientos | Todos | Mostrar cantidad/unidad y datos desconocidos sin inventarlos. |
| FR-006 | Importar catálogo | Preparación | CSV → taxonomía y ofertas demo >=30; proveedor/ubicación/procedencia obligatorios. |
| FR-007 | Matching | Sistema | Solo IDs del catálogo; incompatibles excluidos y desconocidos a revisión. |
| FR-008 | Propuesta global | Sistema | Consolidar candidatos sin mutar selección; conservar cobertura y faltantes. |
| FR-009 | Tarjetas | Todos | Producto, marca, proveedor, lugar, distancia, compatibilidad y etiqueta demo. |
| FR-010 | Editar lista oficial | Proyectista | Solo él agrega/elimina/reemplaza/cambia cantidad o prioridad en draft. |
| FR-011 | Persistencia | Todos | Lista, tickets y actividad sobreviven refresh y cambio de rol. |
| FR-012 | Proveedor | Todos | Nombre obligatorio y logo o monograma. |
| FR-013 | Alternativas | Todos | Al menos tres familias con varios proveedores; no asumir equivalencia técnica por familia. |
| FR-014 | Resolver revisión | Proyectista | Nota de justificación y estado resolved; cambio técnico invalida revisión anterior. |
| FR-015 | Finalizar | Proyectista | Finaliza lista no vacía, sin tickets/revisiones ni cobertura pendientes. |
| FR-016 | Lista para cotizar | Todos | Banner derivado de finalized; Logística puede consultar/preparar salida. |
| FR-017 | Trazabilidad | Todos | Actor/id/rol, acción, antes/después, instante y ticket relacionado. |
| FR-018 | Ubicación | Todos | Proveedor con lugar y coordenadas; distancia nula si ubicación del proyecto desconocida. |
| FR-019 | Recomendados | Todos | Compatibilidad DESC, distancia ASC, ID ASC para desempate. |
| FR-020 | Más cercanos | Todos | Distancia ASC, ID ASC; compatibilidad visible, incompatibles fuera. |
| FR-021 | Ticket | Logística | Crear pending no altera lista ni versión; requiere lista draft existente. |
| FR-022 | Resolver ticket | Proyectista | Aceptar aplica y registra atómicamente una vez; rechazar no altera ítems. |
| FR-023 | Crear lista oficial | Proyectista | Confirmación explícita de propuesta actual o selección manual; una por proyecto. |
| FR-024 | Ordenar/filtrar | Todos | Estado visual local por especialidad/proveedor; nunca persiste prioridad oficial. |

P1: FR-101 Realtime; FR-102 comparador lateral; FR-103 búsqueda manual avanzada. No retrasan P0.
