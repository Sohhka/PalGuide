import { palByKey } from '../data'
import type { ImportedPal, ImportedSave, PalLocation } from './types'

const LOCATION_ORDER: Record<PalLocation, number> = { party: 0, palbox: 1, base: 2 }

export const LOCATION_LABEL: Record<PalLocation, string> = {
  party: 'Équipe',
  palbox: 'Boîte à Pals',
  base: 'Base',
}

interface RawImport {
  meta: { world: string; palCount: number }
  players: { uid: string; name: string; palCount: number }[]
  pals: {
    instanceId: string | null
    species: string
    isBoss: boolean
    gender: 'male' | 'female' | null
    level: number
    stars?: number
    nickname: string | null
    iv: { hp: number; melee: number; shot: number; defense: number }
    passives: string[]
    location: PalLocation
    ownerUid: string | null
  }[]
}

/** Transforme la sortie brute de l'import en ImportedSave (résout espèces -> clés, filtre humains). */
export function resolveImport(raw: RawImport): ImportedSave {
  const pals: ImportedPal[] = raw.pals
    .map((p) => ({
      ...p,
      stars: typeof p.stars === 'number' ? Math.max(0, Math.min(4, p.stars)) : 0,
      palKey: palByKey.has(p.species) ? p.species : null,
    }))
    // On ne garde que les vrais Pals (les humains/NPC capturés ont palKey = null)
    .filter((p) => p.palKey !== null)
    .sort(
      (a, b) =>
        LOCATION_ORDER[a.location] - LOCATION_ORDER[b.location] ||
        b.level - a.level ||
        (palByKey.get(a.palKey!)?.name || '').localeCompare(palByKey.get(b.palKey!)?.name || ''),
    )

  return {
    world: raw.meta.world,
    importedAt: Date.now(),
    players: raw.players,
    pals,
  }
}

/** Pals de la save, filtrés sur un personnage (uid) si fourni. */
export function palsOfPlayer(save: ImportedSave | null, ownerUid?: string | null): ImportedPal[] {
  if (!save) return []
  if (!ownerUid) return save.pals
  return save.pals.filter((p) => p.ownerUid === ownerUid)
}

/** Clés distinctes des Pals possédés (pour un personnage donné). */
export function ownedKeysFromImport(save: ImportedSave | null, ownerUid?: string | null): string[] {
  return [...new Set(palsOfPlayer(save, ownerUid).map((p) => p.palKey).filter((k): k is string => !!k))]
}

/** Regroupe les instances importées par espèce (clé), pour un personnage donné. */
export function importByKey(save: ImportedSave | null, ownerUid?: string | null): Map<string, ImportedPal[]> {
  const m = new Map<string, ImportedPal[]>()
  for (const p of palsOfPlayer(save, ownerUid)) {
    if (!p.palKey) continue
    if (!m.has(p.palKey)) m.set(p.palKey, [])
    m.get(p.palKey)!.push(p)
  }
  return m
}

export function ivTotal(iv: { hp: number; shot: number; defense: number }): number {
  return iv.hp + iv.shot + iv.defense
}
