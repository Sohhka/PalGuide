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

// ---- Graphe de reproduction : chargé à la demande (fichier volumineux) ----
export interface BreedingGraph {
  /** enfant -> liste de paires [parent1Id, parent2Id] */
  childToParents: Map<number, [number, number][]>
  /** clé "min-max" de paire ordonnée -> enfant */
  pairToChild: Map<string, number>
  /** parent -> ensemble des enfants atteignables directement */
  parentToChildren: Map<number, Set<number>>
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
