import { useEffect, useState } from 'react'
import { loadBreedingGraph, type BreedingGraph } from '../data'

export function useBreedingGraph(): BreedingGraph | null {
  const [graph, setGraph] = useState<BreedingGraph | null>(null)
  useEffect(() => {
    let alive = true
    loadBreedingGraph().then((g) => {
      if (alive) setGraph(g)
    })
    return () => {
      alive = false
    }
  }, [])
  return graph
}
