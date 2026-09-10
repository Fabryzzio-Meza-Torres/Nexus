# Feature — Tickets de Logística
Precondición: lista oficial existente en draft. Logística solicita add/remove/replace/quantity/priority con payload validado, motivo y versión de la lista.
UI mantiene cantidad/producto actuales y muestra petición pendiente aparte. Bandeja de Proyectista muestra antes/después, actor, razón y botones Aceptar/Rechazar.
Aceptar es una operación atómica: validar rol, draft, pending, versión actual, referencia y compatibilidad → aplicar cambio → incrementar versión → accepted y resolved_by/at → activity_log. Si falla, nada cambia.
Rechazar requiere motivo, marca rejected y registra resolución; conserva contenido y versión oficial. Doble clic no repite el cambio. Ticket obsoleto recibe conflicto y permanece pending hasta rechazo y nueva solicitud; jamás aplicar silenciosamente a otra versión.
Eliminar/reemplazar un ítem no transfiere tickets automáticamente a otro producto. Nuevos datos técnicos generan revisión cuando corresponda. No hay aceptación masiva en P0.
Ejemplo: cantidad 20 → Logística pide 25 → sigue 20/pending → Proyectista acepta → 25/accepted. Otro ticket rechazado conserva 25.
