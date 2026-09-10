// Reglas de revisión técnica en un solo lugar.
//
// specs/features/technical-review.md define needs_review cuando:
//   (a) diferencia top2 <= 5, (b) score < 70, o (c) falta evidencia técnica crítica.
//
// El seed ahora genera especificaciones sintéticas por tipo, así que la
// compatibilidad varía (≈60–100) y estas reglas ya discriminan de verdad.
// Se aplican los valores de la especificación:
//   - REVIEW_SCORE_MIN = 70
//   - TOP2_DELTA_RULE activa (marca si top1 - top2 <= 5: alternativas equivalentes)
//   - (c): requerimiento con criterios de especificación frente a ítem sin datos
//     de esa especificación -> revisión.
// La incertidumbre del dato NO se oculta: toda fila muestra «Datos demo» y
// «Especificaciones por verificar» aunque el ítem no bloquee.
export const REVIEW_CONFIG = {
  REVIEW_SCORE_MIN: 70,
  TOP2_DELTA_RULE: true,
  TOP2_DELTA: 5,
} as const;

export function computeNeedsReview(params: {
  score: number;
  ambiguousTopPick: boolean;
  requirementHasSpecCriteria: boolean;
  itemHasSpecs: boolean;
}): boolean {
  const { score, ambiguousTopPick, requirementHasSpecCriteria, itemHasSpecs } = params;

  if (score < REVIEW_CONFIG.REVIEW_SCORE_MIN) return true;

  // (b) los dos mejores candidatos están a <= delta: elección ambigua
  if (REVIEW_CONFIG.TOP2_DELTA_RULE && ambiguousTopPick) return true;

  // (c) evidencia técnica crítica ausente
  if (requirementHasSpecCriteria && !itemHasSpecs) return true;

  return false;
}
