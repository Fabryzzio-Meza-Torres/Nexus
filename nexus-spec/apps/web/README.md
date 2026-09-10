# Nexus — app web

Una app Next.js (App Router) + TypeScript. Slice P0 completo con fixtures y
persistencia local; Supabase y Gemini quedan detrás de la misma firma para
sumarse sin romper el fallback.

## Ejecutar

```
pnpm install          # desde la raíz del monorepo (nexus-spec/)
pnpm dev              # o: pnpm --filter web dev
```

Abre http://localhost:3000 → redirige a `/demo`.

`pnpm typecheck` · `pnpm lint` · `pnpm build` · `pnpm test`

`node --experimental-strip-types apps/web/scripts/demo-e2e.ts` recorre el guion
de `specs/demo-plan.md` de principio a fin.

## Estructura

| Archivo | Rol |
|---|---|
| `src/lib/types.ts` | Contratos de `specs/data-model.md`. No cambiar nombres de campo. |
| `src/lib/fixtures.ts` | Carga `data/catalog.json`, requerimientos y proyecto demo. |
| `src/lib/store.ts` | Persistencia en `localStorage`, clave versionada, escritura única. |
| `src/lib/distance.ts` | Haversine (R=6371). `null` si falta cualquier coordenada. |
| `src/lib/matching.ts` | Scoring 45/30/15/10, candidatos y los dos rankings. |
| `src/lib/review.ts` | Reglas de `needs_review` (umbral 70, empate top-2). |
| `src/lib/matching.ts` | Scoring 45/30/15/10, candidatos por tipo exacto, dos rankings. |
| `src/lib/extract.ts` | Analizador determinista del texto + camino Gemini con timeout. |
| `src/lib/service.ts` | Servicio único de comandos: permisos + estado + versión antes de mutar. |
| `src/app/demo/page.tsx` | Pantalla única. Filtros/orden son estado de vista, nunca tocan el store. |
| `src/app/api/extract/route.ts` | Subida PDF/MD/TXT/pegado → texto real → `Requirement[]`. |
| `src/components/AnalysisOverlay.tsx` | Overlay de análisis (simulación de presentación, tiempos configurables). |

## Desviaciones deliberadas (acordadas con el usuario)

- **Especificaciones sintéticas**: `specs/catalog-generator.md` dice `specifications: {}`.
  El importador genera specs técnicas demo por tipo, deterministas y rotuladas
  (`field_provenance.specifications: "synthetic"`), para que la compatibilidad varíe
  (≈60–100). No acreditan desempeño; la UI las marca como demo.
- **Overlay de análisis**: la secuencia animada «la IA interpreta la obra» es teatro
  de presentación con duración controlada. La extracción bajo ese overlay es real
  (texto del documento subido). Ver `ANALYSIS_STEPS` en `AnalysisOverlay.tsx`.
- **Supabase**: fuera de alcance por tiempo; persistencia en `localStorage`.

## Gemini (opcional)

Por defecto Nexus usa el analizador determinista (real, offline, instantáneo).
Para Gemini: en `.env.local` pon `USE_AI_MOCK=false` y `GEMINI_API_KEY=...`
(opcional `GEMINI_MODEL=gemini-2.0-flash`). La clave nunca llega al cliente y hay
timeout de 7 s con caída al analizador.
