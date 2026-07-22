export type ElementKey =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Leaf'
  | 'Electricity'
  | 'Ice'
  | 'Earth'
  | 'Dark'
  | 'Dragon'

export interface ElementInfo {
  key: string
  name: string
  color: string
  iconUrl: string | null
}

export interface ActiveSkill {
  level: number | null
  key: string
  name: string | null
  element: string | null
  power: number | null
  cooldown: number | null
  rangeMin: number | null
  rangeMax: number | null
  hasSkillFruit: boolean
  canInherit: boolean | null
}

export interface PartnerEffect {
  key: string
  value: number
}

export interface PartnerSkill {
  title: string
  description: string
  noStack: boolean
  effects: PartnerEffect[]
  maxRank: number | null
  iconUrl: string | null
}

export interface Drop {
  item: string | null
  name: string
  iconUrl: string | null
  quantity: string | null
  rate: string | null
  levelGate: number | null
}

export interface PalStats {
  hp: number
  meleeAttack: number
  shotAttack: number
  defense: number
  stamina: number
  craftSpeed: number
  food: number
}

export interface PalSpeeds {
  walk: number
  run: number
  rideSprint: number
  transport: number
}

export interface Pal {
  id: number
  dex: number | null
  variant: boolean
  key: string
  name: string
  nameEn: string
  elements: string[]
  rarity: number
  size: string
  genus: string | null
  genusKey: string | null
  nocturnal: boolean
  predator: boolean
  price: number
  minLevel: number | null
  maxLevel: number | null
  maleProbability: number
  breedingPower: number
  breedingPriority: number
  stats: PalStats
  speeds: PalSpeeds
  work: Record<string, number>
  captureRateCorrect: number
  partnerSkill: PartnerSkill | null
  activeSkills: ActiveSkill[]
  guaranteedPassives: string[]
  drops: Drop[]
  description: string | null
  iconUrl: string
}

export interface PassiveInfo {
  name: string
  description: string | null
  rank: number
  standard?: boolean
  inheritable?: boolean
}

export interface Meta {
  gameVersion: string
  dbVersion: string
  generatedAt: string
  palCount: number
  breedingPairs: number
  sources: string[]
}

export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary'

export type PalLocation = 'party' | 'palbox' | 'base'

export interface ImportedPal {
  instanceId: string | null
  species: string
  palKey: string | null // clé PalGuide résolue (null = humain/inconnu)
  isBoss: boolean
  gender: 'male' | 'female' | null
  level: number
  stars: number // rang de condensation 0..4 (0 si save importée avant cette version)
  nickname: string | null
  iv: { hp: number; melee: number; shot: number; defense: number }
  souls?: { hp: number; atk: number; def: number; work: number } // âmes (Statue du Pouvoir), 0..20
  passives: string[]
  activeSkills?: string[] // compétences actives équipées (assets, ex. "PowerBall")
  location: PalLocation
  ownerUid: string | null
}

export interface SaveBase {
  x: number
  y: number
  z: number
  group: string | null // GUID de la guilde propriétaire
}

export interface SavePlayer {
  uid: string
  name: string
  palCount: number
  fastTravel?: string[] // GUIDs (minuscule, sans tiret) des points de voyage rapide débloqués
  // --- champs éditables (Phase 2) ---
  instanceId?: string | null // InstanceId de l'entrée joueur dans CharacterSaveParameterMap
  level?: number
  exp?: number
  statusPoints?: Record<string, number> // clé = nom japonais on-disk -> points alloués
  techPoint?: number | null
  bossTechPoint?: number | null
  palboxId?: string | null // GUID du conteneur boîte à Pals (pour créer des Pals)
}

export interface ImportedSave {
  world: string
  importedAt: number
  players: SavePlayer[]
  pals: ImportedPal[]
  bases?: SaveBase[]
  /** chemin du Level.sav source (pour l'éditeur ; app de bureau uniquement) */
  levelPath?: string
}
