// ------------------------------------------------------------------ //
//  Étoiles (condensation 0..4) — facteurs de boost                     //
// ------------------------------------------------------------------ //
// En jeu, condenser un Pal (0 → 4 étoiles) renforce nettement l'effet
// de son PARTNER SKILL (≈ ×2 entre 0 et 4★) et, plus modestement, ses
// stats. On modélise les deux séparément.

/** Facteur appliqué à la contribution du PARTNER SKILL (la valeur stockée
 *  = effet au rang max 4★, donc 0★ ≈ moitié). */
export const STAR_SKILL_FACTOR = [0.5, 0.625, 0.75, 0.875, 1.0] as const

/** Facteur (plus doux) appliqué aux STATS — la condensation ajoute ~+25 % au total. */
export const STAR_STAT_FACTOR = [1.0, 1.06, 1.12, 1.18, 1.25] as const

const clampStar = (s: number) => Math.max(0, Math.min(4, Math.round(s)))

export function starSkillFactor(stars: number): number {
  return STAR_SKILL_FACTOR[clampStar(stars)]
}

export function starStatFactor(stars: number): number {
  return STAR_STAT_FACTOR[clampStar(stars)]
}
