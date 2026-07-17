import type { Pal, RarityTier } from './types'

// ---- Rareté (calibré sur les captures : Azurobe 7=Rare, Aegidron 8=Épique, Anubis 10=Épique, légendaires=20) ----
export function rarityTier(rarity: number): RarityTier {
  if (rarity >= 11) return 'legendary'
  if (rarity >= 8) return 'epic'
  if (rarity >= 5) return 'rare'
  return 'common'
}

export const RARITY_LABEL: Record<RarityTier, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
}

export const RARITY_COLOR: Record<RarityTier, string> = {
  common: 'var(--rar-common)',
  rare: 'var(--rar-rare)',
  epic: 'var(--rar-epic)',
  legendary: 'var(--rar-legendary)',
}

export const SIZE_LABEL: Record<string, string> = {
  XS: 'Très petit',
  S: 'Petit',
  M: 'Moyen',
  L: 'Grand',
  XL: 'Très grand',
}

export function palDexLabel(pal: Pal): string {
  if (pal.dex == null) return '—'
  return `N°${String(pal.dex).padStart(3, '0')}${pal.variant ? 'B' : ''}`
}

// Niveau d'aptitude de travail formaté
export function workLevel(pal: Pal, key: string): number {
  return pal.work[key] ?? 0
}

// Somme des aptitudes de travail (pour tri "meilleur travailleur")
export function totalWork(pal: Pal): number {
  return Object.values(pal.work).reduce((a, b) => a + b, 0)
}

// Probabilité de genre lisible
export function genderText(maleProbability: number): string {
  if (maleProbability === 100) return '100 % ♂'
  if (maleProbability === 0) return '100 % ♀'
  return `${maleProbability} % ♂ / ${100 - maleProbability} % ♀`
}

const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Recherche tolérante (accents/casse) sur nom FR + EN + n° dex. */
export function palMatches(pal: Pal, query: string): boolean {
  const q = stripDiacritics(query.trim())
  if (!q) return true
  if (stripDiacritics(pal.name).includes(q)) return true
  if (stripDiacritics(pal.nameEn).includes(q)) return true
  if (pal.dex != null && String(pal.dex).includes(q)) return true
  return false
}

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}
