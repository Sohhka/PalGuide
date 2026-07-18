import type { Pal, ElementInfo, PassiveInfo, Meta } from '../lib/types'
import palsData from './pals.json'
import elementsData from './elements.json'
import passivesData from './passives.json'
import workData from './work.json'
import metaData from './meta.json'
import schematicsData from './schematics.json'

export const pals = palsData as unknown as Pal[]

// ---- Plans (schematics) d'armes/armures lâchés par des boss/Pals ----
export interface SchematicDropper {
  /** nom d'affichage du droppeur (souvent un boss, ex. « Tyran du Purgatoire Blazamut ») */
  name: string
  /** clé du Pal de base correspondant (pour l'icône/la fiche), null pour un raid boss sans Pal de base */
  palKey: string | null
}
export interface Schematic {
  slug: string
  name: string
  icon: string | null
  /** rareté 0-4 (Commun→Légendaire), null si inconnue */
  rarity: number | null
  droppers: SchematicDropper[]
  /** aussi trouvable dans un coffre au trésor */
  treasureBox: boolean
}
export const schematics = schematicsData as unknown as Schematic[]
export const elements = elementsData as ElementInfo[]
export const passives = passivesData as Record<string, PassiveInfo>
export const meta = metaData as Meta
export const workLabels = (workData as { labels: Record<string, string> }).labels
export const workIcons = (workData as { icons: Record<string, string> }).icons

// ---- Index rapides ----
export const palByKey = new Map<string, Pal>(pals.map((p) => [p.key, p]))
export const palById = new Map<number, Pal>(pals.map((p) => [p.id, p]))
export const elementByKey = new Map<string, ElementInfo>(elements.map((e) => [e.key, e]))

export const palsSortedByDex = [...pals].sort(
  (a, b) => (a.dex ?? 9999) - (b.dex ?? 9999) || a.name.localeCompare(b.name),
)

// Passifs « standard » (breedables/affichés en jeu), pour le planificateur de talents.
export interface PassiveOption extends PassiveInfo {
  key: string
}
export const standardPassives: PassiveOption[] = Object.entries(passives)
  .filter(([, v]) => v.standard)
  .map(([key, v]) => ({ key, ...v }))
  .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))

// ---- Graphe de reproduction : chargé à la demande (fichier volumineux) ----
export interface BreedingGraph {
  /** enfant -> liste de paires [parent1Id, parent2Id] */
  childToParents: Map<number, [number, number][]>
  /** clé "min-max" de paire ordonnée -> enfant */
  pairToChild: Map<string, number>
  /** parent -> ensemble des enfants atteignables directement */
  parentToChildren: Map<number, Set<number>>
}

// ---- Équipement (armes/armures/planeurs/accessoires) : chargé à la demande ----
export interface EquipVariant {
  rarity: number
  attack?: number
  defense?: number
  durability?: number
  weight?: number
  gold?: number
  magazine?: number
  hp?: number
}
export interface EquipItem {
  slug: string
  name: string
  category: string
  icon: string | null
  rank?: number
  variants: EquipVariant[]
  materials: { name: string; icon: string }[]
}
export interface EquipData {
  categories: { id: string; label: string }[]
  items: EquipItem[]
}
let equipPromise: Promise<EquipData> | null = null
export function loadEquipment(): Promise<EquipData> {
  if (!equipPromise) {
    equipPromise = import('./equipment.json').then((mod) => mod.default as unknown as EquipData)
  }
  return equipPromise
}

// ---- Catalogue d'items (éditeur d'inventaire) : chargé à la demande ----
export interface ItemCatalogEntry {
  id: string // StaticId (= asset) tel que stocké dans la save
  name: string // nom (français si dispo, sinon anglais)
  nameEn?: string // nom anglais (pour la recherche), si différent du FR
  icon: string | null
  rarity: number // 0-4
  cat: string // catégorie d'affichage
  stack: boolean // empilable (sinon équipement à données dynamiques)
  sort: number
}
let itemsCatalogPromise: Promise<ItemCatalogEntry[]> | null = null
export function loadItemsCatalog(): Promise<ItemCatalogEntry[]> {
  if (!itemsCatalogPromise) {
    itemsCatalogPromise = import('./items-catalog.json').then((mod) => mod.default as unknown as ItemCatalogEntry[])
  }
  return itemsCatalogPromise
}

// ---- Catalogue de compétences actives (éditeur de Pals) : chargé à la demande ----
export interface SkillEntry { id: string; name: string; element: string; power: number }
export interface SkillsCatalog { skills: SkillEntry[]; learn: Record<string, string[]> }
let skillsCatalogPromise: Promise<SkillsCatalog> | null = null
export function loadSkillsCatalog(): Promise<SkillsCatalog> {
  if (!skillsCatalogPromise) {
    skillsCatalogPromise = import('./skills-catalog.json').then((mod) => mod.default as unknown as SkillsCatalog)
  }
  return skillsCatalogPromise
}

// ---- Apparitions de Pals (spawns) : chargé à la demande (~1 Mo) ----
export type SpawnData = Record<string, [number, number][]>
let spawnPromise: Promise<SpawnData> | null = null
export function loadSpawns(): Promise<SpawnData> {
  if (!spawnPromise) {
    spawnPromise = import('./spawns.json').then((mod) => mod.default as unknown as SpawnData)
  }
  return spawnPromise
}

let breedingPromise: Promise<BreedingGraph> | null = null

export function loadBreedingGraph(): Promise<BreedingGraph> {
  if (!breedingPromise) {
    breedingPromise = import('./breeding.json').then((mod) => {
      const pairs = (mod.default as { pairs: number[][] }).pairs
      const childToParents = new Map<number, [number, number][]>()
      const pairToChild = new Map<string, number>()
      const parentToChildren = new Map<number, Set<number>>()
      for (const [a, b, child] of pairs) {
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        pairToChild.set(`${lo}-${hi}`, child)
        if (!childToParents.has(child)) childToParents.set(child, [])
        childToParents.get(child)!.push([a, b])
        for (const parent of a === b ? [a] : [a, b]) {
          if (!parentToChildren.has(parent)) parentToChildren.set(parent, new Set())
          parentToChildren.get(parent)!.add(child)
        }
      }
      return { childToParents, pairToChild, parentToChildren }
    })
  }
  return breedingPromise
}
