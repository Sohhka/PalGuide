import type { BreedingGraph } from '../data'

export type Pair = [number, number]

/** Toutes les paires de parents donnant cet enfant (combos directs). */
export function combosForChild(graph: BreedingGraph, childId: number): Pair[] {
  return graph.childToParents.get(childId) ?? []
}

/** Enfant produit par parent1 + parent2 (ordre indifférent). */
export function childForPair(graph: BreedingGraph, aId: number, bId: number): number | null {
  const lo = Math.min(aId, bId)
  const hi = Math.max(aId, bId)
  const c = graph.pairToChild.get(`${lo}-${hi}`)
  return c ?? null
}

// ------------------------------------------------------------------ //
//  Path finder : plus court chemin d'élevage depuis les Pals possédés //
// ------------------------------------------------------------------ //

export interface StepMap {
  dist: Map<number, number> // pal -> nb minimal d'élevages
  best: Map<number, Pair> // pal -> meilleure recette
}

/**
 * Nombre minimal d'élevages pour obtenir chaque Pal à partir de `owned`.
 * Relaxation type Bellman-Ford sur l'hypergraphe (recette = 2 parents -> 1 enfant).
 */
export function computeShortestSteps(graph: BreedingGraph, owned: Set<number>): StepMap {
  const dist = new Map<number, number>()
  const best = new Map<number, Pair>()
  for (const id of owned) dist.set(id, 0)

  // Liste plate des recettes pour itérer efficacement
  const recipes: [number, number, number][] = []
  for (const [child, parents] of graph.childToParents) {
    for (const [a, b] of parents) recipes.push([a, b, child])
  }

  let changed = true
  let guard = 0
  const maxPasses = 64
  while (changed && guard++ < maxPasses) {
    changed = false
    for (const [a, b, child] of recipes) {
      const da = dist.get(a)
      const db = dist.get(b)
      if (da === undefined || db === undefined) continue
      const cand = da + db + 1
      const cur = dist.get(child)
      if (cur === undefined || cand < cur) {
        dist.set(child, cand)
        best.set(child, [a, b])
        changed = true
      }
    }
  }
  return { dist, best }
}

export interface TreeNode {
  palId: number
  owned: boolean
  steps: number
  children: [TreeNode, TreeNode] | null
}

/** Reconstruit l'arbre d'élevage optimal vers `target` à partir d'une StepMap. */
export function buildOptimalTree(
  { dist, best }: StepMap,
  target: number,
  owned: Set<number>,
): TreeNode | null {
  if (!dist.has(target)) return null
  const visiting = new Set<number>()
  function build(id: number): TreeNode {
    const steps = dist.get(id) ?? 0
    if (owned.has(id) || !best.has(id) || visiting.has(id)) {
      return { palId: id, owned: owned.has(id), steps, children: null }
    }
    visiting.add(id)
    const [a, b] = best.get(id)!
    const node: TreeNode = {
      palId: id,
      owned: false,
      steps,
      children: [build(a), build(b)],
    }
    visiting.delete(id)
    return node
  }
  return build(target)
}

/** Aplati l'arbre en liste d'étapes ordonnées (parents d'abord, enfant ensuite). */
export function treeToSteps(tree: TreeNode): { childId: number; a: number; b: number }[] {
  const steps: { childId: number; a: number; b: number }[] = []
  const seen = new Set<string>()
  function walk(node: TreeNode) {
    if (!node.children) return
    const [a, b] = node.children
    walk(a)
    walk(b)
    const key = [a.palId, b.palId, node.palId].sort().join('-')
    if (!seen.has(key)) {
      seen.add(key)
      steps.push({ childId: node.palId, a: a.palId, b: b.palId })
    }
  }
  walk(tree)
  return steps
}
