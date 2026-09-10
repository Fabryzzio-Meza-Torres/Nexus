# Cambios — 10 septiembre 2026
Base: nexus-hackathon-2h30-final.zip localizado en Descargas. Se mantienen alcance 2h30, app única/monorepo, Supabase mínimo, Gemini/mock y fallback.
1. CSV adjunto incorporado sin modificar como fuente principal; importación ejecutable reproducible con taxonomía, catálogo demo y seed JSON.
2. Fichas relegadas exclusivamente a documentos de búsqueda/matching. Actualizados README de fichas y scripts, generador y reparto de agentes.
3. Proyectista crea/controla/resuelve/finaliza lista. Logística consulta/ordena/filtra y solicita; Residente consulta. Reescritos contratos, requisitos, matriz, UX, prompts y demo.
4. Propuesta automática separada de lista oficial. Modelo incorpora selections, match_proposals, tickets, versión, cierre y trazabilidad.
5. Aceptación de ticket atómica/idempotente y rechazo sin mutación. Conflictos de versión, bloqueo de cierre y finalizada inmutable definidos.
6. Proveedor obligatorio distinto de marca; ubicación y Haversine; dos rankings con incertidumbre y datos faltantes explícitos.
7. 180 ofertas ficticias derivadas de 180 asociaciones del CSV; no se inventan especificaciones, proveedores oficiales o stock. Fixtures para seis requerimientos.
8. Nuevos criterios de aceptación y verificación; se actualizan también approval, document-processing, ai-spec, technical-architecture y guías Supabase.

## Implementación — app en apps/web
- App Next.js + TS con el flujo P0 completo sobre fixtures y `localStorage`; servicio de comandos centralizado (permisos/versión/atomicidad/idempotencia), matching determinista con Haversine y dos rankings, 20 pruebas + recorrido e2e.
- Subida real de documentos (PDF vía `unpdf`, MD, TXT, texto pegado) con analizador determinista del texto; Gemini opcional detrás de la misma firma con timeout. El importador del catálogo sigue sin leer documentos.
- Especificaciones sintéticas por tipo en el importador (deterministas, rotuladas) para que la compatibilidad varíe (≈60–100). Umbral de revisión = 70.
- UI rediseñada según specs/ux.md § Contrato de diseño: shell con identidad, stepper del flujo, tablas comparables, overlay de análisis simulado.
- Fuera de alcance por tiempo: Supabase (paso 5) — queda documentado en el plan.

## Iteración de UI + documentos reales
- Rediseño visual completo (negro / naranja / blanco, tipografía Inter, iconos lucide) inspirado en el prototipo de hackathon: pantalla de carga, overlay de análisis animado, header con banda de estadísticas, tablas comparables con el extracto en un botón «Detalle».
- Extracción de documentos: IA (Gemini `gemini-3.6-flash`) → analizador determinista del texto → conjunto de partidas de demostración. El resultado de la IA se reconcilia con el vocabulario del catálogo. La demo del jurado nunca se queda sin propuesta.
- Prioridad se muestra como Alta / Media / Baja (el contrato interno sigue high/medium/normal).
- Umbral de revisión = 70; con las specs sintéticas la compatibilidad varía ≈60–100 y algunos ítems quedan en revisión, así el cierre está gated.
