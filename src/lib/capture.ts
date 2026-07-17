import type { Pal } from './types'

// ------------------------------------------------------------------ //
//  Estimation du taux de capture.
//  La formule native de Palworld n'est pas officiellement documentée ;
//  ce modèle est CALIBRÉ sur les valeurs de référence (paldb.cc / palworld.gg)
//  — il reproduit exactement les valeurs sans bonus de la référence Chikipi
//  (niv 1, 100 % PV : Sphère Pal 14,9 %, Méga 58,6 %, Giga+ 100 %).
//  Les facteurs PV / niveau restent des approximations (à considérer comme
//  des estimations, l'affichage en jeu faisant foi).
// ------------------------------------------------------------------ //

export interface Sphere {
  key: string
  name: string
  power: number
  color: string
}

export const SPHERES: Sphere[] = [
  { key: 'pal', name: 'Sphère Pal', power: 7, color: '#8ea2c0' },
  { key: 'mega', name: 'Méga Sphère', power: 14, color: '#5fd1ff' },
  { key: 'giga', name: 'Giga Sphère', power: 20, color: '#ffd23f' },
  { key: 'hyper', name: 'Hyper Sphère', power: 26, color: '#ff8f5f' },
  { key: 'ultra', name: 'Ultra Sphère', power: 32, color: '#ff5f8f' },
  { key: 'legendary', name: 'Sphère légendaire', power: 37, color: '#b06bff' },
  { key: 'ultimate', name: 'Sphère ultime', power: 43, color: '#22d3ee' },
]

// Constantes calibrées (voir en-tête)
const BASE = 0.001455
const EXP = 1.97
const BACK_BONUS = 0.2324 // ajout de probabilité (dos)

export interface CaptureInput {
  level: number
  hpPercent: number // 1..100
  capturePower: number // rang "Puissance de capture" (effigies), 1..
  spherePower: number
}

function hpFactor(hpPercent: number): number {
  const h = Math.min(100, Math.max(1, hpPercent)) / 100
  // 100 % -> 1 ; 0 % -> ~4
  return 1 + (1 - h) * 3
}

function levelFactor(level: number): number {
  // niv 1 -> 1 ; décroît avec le niveau
  return Math.min(1, Math.max(0.1, 1 - (level - 1) * 0.009))
}

function effigyFactor(capturePower: number): number {
  return 1 + Math.max(0, capturePower - 1) * 0.05
}

/** Probabilité de capture (0..1) sans/avec bonus dans le dos. */
export function captureProbability(
  pal: Pal,
  input: CaptureInput,
): { base: number; back: number; effectivePower: number } {
  const P =
    input.spherePower *
    (pal.captureRateCorrect || 1) *
    hpFactor(input.hpPercent) *
    levelFactor(input.level) *
    effigyFactor(input.capturePower)

  let base = BASE * Math.pow(P, EXP)
  base = Math.min(1, Math.max(0, base))
  const back = Math.min(1, base + BACK_BONUS * (1 - base))
  return { base, back, effectivePower: P }
}

export function captureForAllSpheres(pal: Pal, input: Omit<CaptureInput, 'spherePower'>) {
  return SPHERES.map((s) => {
    const { base, back } = captureProbability(pal, { ...input, spherePower: s.power })
    return { sphere: s, base, back }
  })
}
