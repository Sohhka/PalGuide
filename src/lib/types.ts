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
