import { pals } from '../data'
import type { Pal } from './types'

export interface ItemSource {
  pal: Pal
  quantity: string | null
  rate: string | null
  rateNum: number
  levelGate: number | null
}

export interface ItemEntry {
  key: string
  name: string
  iconUrl: string | null
  sources: ItemSource[]
  /** meilleur taux de drop de base (hors paliers de boss) */
  bestRate: number
}

function parseRate(rate: string | null): number {
  if (!rate) return 0
  const m = rate.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : 0
}

let cache: ItemEntry[] | null = null

/** Construit (et mémorise) l'index inversé : objet -> Pals qui le lâchent. */
export function getItemIndex(): ItemEntry[] {
  if (cache) return cache
  const byKey = new Map<string, ItemEntry>()

  for (const pal of pals) {
    for (const d of pal.drops || []) {
      const key = d.item || d.name
      if (!key) continue
      let entry = byKey.get(key)
      if (!entry) {
        entry = { key, name: d.name, iconUrl: d.iconUrl, sources: [], bestRate: 0 }
        byKey.set(key, entry)
      }
      if (!entry.iconUrl && d.iconUrl) entry.iconUrl = d.iconUrl
      const rateNum = parseRate(d.rate)
      entry.sources.push({
        pal,
        quantity: d.quantity,
        rate: d.rate,
        rateNum,
        levelGate: d.levelGate ?? null,
      })
      if (d.levelGate == null) entry.bestRate = Math.max(entry.bestRate, rateNum)
    }
  }

  // Tri des sources de chaque objet : drops de base d'abord, puis meilleur taux
  for (const entry of byKey.values()) {
    entry.sources.sort((a, b) => {
      const ga = a.levelGate ?? -1
      const gb = b.levelGate ?? -1
      if (ga !== gb) return ga - gb // base (-1) en premier, puis Niv.70, Niv.80…
      return b.rateNum - a.rateNum
    })
  }

  cache = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return cache
}

const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function itemMatches(entry: ItemEntry, query: string): boolean {
  const q = stripDiacritics(query.trim())
  if (!q) return true
  return stripDiacritics(entry.name).includes(q)
}
