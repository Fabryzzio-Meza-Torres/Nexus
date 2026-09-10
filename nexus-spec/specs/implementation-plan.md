# Nexus — Plan de 150 minutos
| Tiempo | Trabajo | Salida verificable |
|---|---|---|
| 0–10 | Leer contrato, app monorepo, importar CSV/fixtures | App abre; catálogo con proveedores y ubicaciones |
| 10–40 | Flujo mock: propuesta separada, crear lista como Proyectista, roles, tickets, aceptación/rechazo, cierre | Demo completa local con guardas |
| 40–65 | Matching explicable, revisión, distancia, rankings y filtros | Ningún incompatible se recomienda por cercanía |
| 65–90 | Supabase: seed y persistencia transaccional mínima | Refresh conserva lista/tickets/log; fallback listo |
| 90–110 | Gemini + Zod, carga PDF/MD, fallback explícito | Documento produce propuesta sin alterar lista |
| 110–130 | UX, conflictos y criterios de aceptación | Permisos, revisión y cierre verificados |
| 130–150 | Freeze, build/typecheck/lint y ensayo | Guion completo con fallback preparado |
Si una integración consume >10 min sin avance, volver a local/mock y documentar limitación. P1 solo con P0 estable. No sacrificar creación/cierre por Proyectista, tickets atómicos, proveedor, ubicación, ranking o persistencia.
El apoyo de catálogo puede trabajar aisladamente según agent-parallel-plan.md; el principal integra. El seed ya incluido evita esperar al apoyo.
