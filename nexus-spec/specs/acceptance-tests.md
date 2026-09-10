# Nexus — Pruebas de aceptación de implementación
1. Ejecutar importador dos veces: JSON idéntico, 60 filas, 180 asociaciones/ofertas, SKU/ID únicos, proveedores/ubicaciones en todos; ninguna lectura de fichas.
2. Analizar documento como Logística: hay propuesta, no selections/selection_items. Crear lista falla para Logística/Residente y funciona una vez para Proyectista.
3. Intentar add/remove/replace/quantity/priority/resolve/finalize directamente en servicio con roles no permitidos: se rechazan sin mutación.
4. Con lista draft cantidad 20, Logística pide 25: sigue 20/versión original y ticket pending. Proyectista acepta: 25, accepted, versión+1, evento; repetir aceptación no cambia de nuevo.
5. Rechazar otro ticket: conserva ítems y versión; registra rol/razón/instante.
6. Editar lista después de ticket: aceptar ticket viejo responde conflicto, sigue pending, no muta. Probar objetivo eliminado y producto inexistente/duplicado; se rechazan.
7. Forzar fallo al aceptar: ni ítems ni ticket/log quedan parcialmente aplicados; probar dos aceptaciones simultáneas.
8. Misma compatibilidad: proveedor más cercano primero. Menor compatibilidad y más cerca: primero solo en Más cercanos. Incompatible nunca elegible. Distancia desconocida al final; sin proyecto deshabilitar Más cercanos. Mismo punto=0 y un grado en ecuador≈111.195 km.
9. Filtrar/ordenar no cambia contenido ni prioridad oficial. Refrescar/cambiar rol conserva lista, tickets e historial.
10. Datos técnicos ausentes muestran incertidumbre y revisión; familia/marca no confirman equivalencia. Reanálisis no modifica lista ni duplica requerimientos.
11. Cierre bloqueado con ticket pending, needs_review, lista vacía o cobertura faltante. Resolver cada pendiente y finalizar como Proyectista: finalized con sello y banner. Ningún rol muta finalized ni crea tickets allí.
12. Falla de IA muestra error/fallback rotulado. Fixture devuelve seis requerimientos sin inventar modelos. Claves no aparecen en bundle del cliente.
13. typecheck, lint, build; ensayo guion demo. Registrar resultado real, no marcar tests de app como pasados por existir esta especificación.
