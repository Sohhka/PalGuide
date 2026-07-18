import { palByKey } from '../data'
import type { ImportedPal, ImportedSave, PalLocation, SaveBase, SavePlayer } from './types'

const LOCATION_ORDER: Record<PalLocation, number> = { party: 0, palbox: 1, base: 2 }

export const LOCATION_LABEL: Record<PalLocation, string> = {
  party: 'Équipe',
  palbox: 'Boîte à Pals',
  base: 'Base',
}

/** Points de statut du joueur : nom on-disk (japonais) -> libellé FR. */
export const STATUS_LABEL_FR: Record<string, string> = {
  最大HP: 'PV max',
  最大SP: 'Endurance max',
  攻撃力: 'Attaque',
  所持重量: 'Poids porté',
  捕獲率: 'Taux de capture',
  作業速度: 'Vitesse de travail',
  移動速度アップ: 'Vitesse de déplacement',
  泳ぎ速度: 'Vitesse de nage',
  滑空速度: 'Vitesse de planeur',
  崖登り速度: "Vitesse d'escalade",
  ジャンプ力: 'Puissance de saut',
  経験値ボーナス: "Bonus d'expérience",
  状態異常耐性: 'Résistance aux altérations',
  空腹率低減: 'Réduction de la faim',
  食料腐敗低減: 'Conservation des aliments',
  スタミナ消費軽減: 'Réduction conso. endurance',
  パルスフィアホーミング: 'Guidage des sphères',
  虹パッシブ率: 'Taux de passif arc-en-ciel',
}
/** Ordre d'affichage prioritaire des points de statut (les principaux d'abord). */
export const STATUS_ORDER = ['最大HP', '最大SP', '攻撃力', '所持重量', '捕獲率', '作業速度']
export const statusLabel = (jp: string) => STATUS_LABEL_FR[jp] ?? jp

interface RawImport {
  meta: { world: string; palCount: number }
  players: SavePlayer[]
  bases?: SaveBase[]
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
    activeSkills?: string[]
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
    bases: Array.isArray(raw.bases) ? raw.bases : [],
  }
}

/** Bases de la save (positions monde), filtrées sur la guilde du personnage si connue. */
export function basesFromImport(save: ImportedSave | null): SaveBase[] {
  return save?.bases ?? []
}

/** GUIDs (minuscule, sans tiret) des points de voyage rapide débloqués par le personnage. */
export function fastTravelUnlocked(save: ImportedSave | null, ownerUid?: string | null): Set<string> {
  if (!save) return new Set()
  const player = ownerUid
    ? save.players.find((p) => p.uid === ownerUid)
    : [...save.players].sort((a, b) => b.palCount - a.palCount)[0]
  return new Set(player?.fastTravel ?? [])
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
