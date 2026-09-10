# Feature — Aceptar y finalizar
Solo Proyectista puede pulsar «Aceptar y finalizar lista». Se aplica a la lista que creó el Proyectista simulado del proyecto.
Precondiciones dentro de la operación: lista draft no vacía; ningún ticket pending; ningún ítem needs_review; cantidades/unidades válidas; todos los requerimientos cubiertos o excluidos con justificación del Proyectista; catálogo/proveedor válidos.
Revisión técnica resuelta no equivale a cierre. Verificar versión esperada y registrar finalized_by, finalized_by_role=project_designer, finalized_at, versión y evento.
Estado final único: finalized. UI: «Aceptada por Proyectista · Lista lista para cotizar».
Todos consultan. Ningún rol puede editar o abrir tickets sobre finalized en P0. No existe reapertura automática. Residente aporta consulta contextual y no participa del cierre.
