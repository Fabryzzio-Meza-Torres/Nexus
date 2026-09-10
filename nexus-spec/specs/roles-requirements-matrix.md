# Nexus — Matriz de permisos
| Acción | Logística | Proyectista | Residente | Requisito |
|---|---|---|---|---|
| Cargar/analizar documentos | Sí | Consulta | Consulta | FR-003/004 |
| Ver propuesta/lista/actividad | Sí | Sí | Sí | FR-005/009/017 |
| Crear lista oficial | No | Sí | No | FR-023 |
| Agregar/eliminar/reemplazar | Solicitar | Editar | No | FR-010/021 |
| Cambiar cantidad/prioridad oficial | Solicitar | Editar | No | FR-010/021 |
| Ordenar/filtrar vista | Sí | Sí | Sí | FR-019/020/024 |
| Cambiar ubicación del proyecto | No | Sí | No | FR-002 |
| Ver proveedor/distancia | Sí | Sí | Sí | FR-012/018 |
| Crear ticket | Sí | No | No | FR-021 |
| Aceptar/rechazar ticket | No | Sí | No | FR-022 |
| Resolver ambigüedad | No | Sí | No | FR-014 |
| Finalizar lista | No | Sí | No | FR-015 |
| Preparar lista final para cotizar | Sí | Consulta | Consulta | FR-016 |
Aplicar las restricciones tanto en UI como en servicio/repository. Una lista finalized es inmutable para todos en P0.
