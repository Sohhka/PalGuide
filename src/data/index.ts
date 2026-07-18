import type { Pal, ElementInfo, PassiveInfo, Meta } from '../lib/types'
import palsData from './pals.json'
import elementsData from './elements.json'
import passivesData from './passives.json'
import workData from './work.json'
import metaData from './meta.json'

export const pals = palsData as unknown as Pal[]
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
