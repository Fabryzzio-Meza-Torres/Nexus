# Nexus — Usuarios
## Proyectista · project_designer
Crea la lista oficial y mantiene control técnico. Puede agregar, eliminar, sustituir, cambiar cantidad/prioridad, resolver ambigüedades, aceptar/rechazar tickets y finalizar. En P0 existe un único Proyectista simulado por proyecto; su identidad se conserva en created_by/finalized_by.
## Logística · logistics
Carga y analiza documentos, consulta propuesta/lista/requerimientos, compara proveedores y ordena/filtra. Solicita adición, eliminación, reemplazo, cantidad o prioridad mediante tickets; ve su estado. Prepara para cotización la lista finalizada. No cambia la lista oficial ni la finaliza.
## Residente · site_resident
Consulta lista, cobertura, proveedores, decisiones y actividad para revisión contextual. No tiene acciones de edición, resolución ni cierre. No es un paso obligatorio del flujo.
## Simulación
Selector de rol visible, una sola lista persistente. La simulación demuestra reglas de negocio; no equivale a autenticación o seguridad de producción.
