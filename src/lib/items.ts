import { pals, palByKey, schematics, type ItemCatalogEntry, type RecipeMat } from '../data'
import type { Pal } from './types'

export interface ItemSource {
  pal: Pal
  quantity: string | null
  rate: string | null
  rateNum: number
  levelGate: number | null
}

/** Droppeur d'un plan : Pal de base résolu (pour l'icône) + nom d'affichage du boss. */
export interface SchematicDropper {
  pal: Pal | null
  bossName: string
}

/** Infos spécifiques aux « plans » (schematics) : rareté, coffre, boss droppeurs. */
export interface SchematicInfo {
  rarity: number | null
  treasureBox: boolean
  droppers: SchematicDropper[]
}

export interface ItemEntry {
  key: string
  name: string
  iconUrl: string | null
  sources: ItemSource[]
  /** meilleur taux de drop de base (hors paliers de boss) */
  bestRate: number
  /** présent si l'objet est un plan de fabrication lâché par un boss/Pal */
  schematic?: SchematicInfo
  // --- infos du catalogue complet (page Objets) ---
  nameEn?: string
  rarity?: number
  cat?: string
  desc?: string
  price?: number
  recipe?: RecipeMat[]
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

  // Plans (schematics) : objets à part entière, « lâchés par » des boss/Pals.
  for (const s of schematics) {
    if (byKey.has(s.slug)) continue
    byKey.set(s.slug, {
      key: s.slug,
      name: s.name,
      iconUrl: 'img/items/T_itemicon_Material_Blueprint.webp', // icône générique de plan
      sources: [],
      bestRate: 0,
      schematic: {
        rarity: s.rarity,
        treasureBox: s.treasureBox,
        droppers: s.droppers.map((d) => ({ pal: (d.palKey && palByKey.get(d.palKey)) || null, bossName: d.name })),
      },
    })
  }

  cache = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return cache
}

/**
 * Index COMPLET pour la page Objets : tous les items du catalogue (2400+) enrichis
 * des Pals qui les lâchent (drops) et des infos de plans (schematics).
 */
let fullCache: ItemEntry[] | null = null
export function buildFullItemIndex(catalog: ItemCatalogEntry[]): ItemEntry[] {
  if (fullCache) return fullCache
  const drops = getItemIndex() // drops de Pals + plans
  const byKey = new Map<string, ItemEntry>()

  // 1) base : tout le catalogue
  for (const c of catalog) {
    byKey.set(c.id, {
      key: c.id, name: c.name, nameEn: c.nameEn, iconUrl: c.icon,
      sources: [], bestRate: 0, rarity: c.rarity, cat: c.cat, desc: c.desc,
      price: c.price, recipe: c.recipe,
    })
  }
  const idByName = new Map<string, string>()
  for (const c of catalog) if (!idByName.has(c.name.toLowerCase())) idByName.set(c.name.toLowerCase(), c.id)

  // 2) fusionne drops + plans
  for (const e of drops) {
    if (e.schematic) { byKey.set(e.key, e); continue } // plans = entrées à part
    let target = byKey.get(e.key) ?? (idByName.has(e.name.toLowerCase()) ? byKey.get(idByName.get(e.name.toLowerCase())!) : undefined)
    if (target) {
      target.sources = e.sources
      target.bestRate = e.bestRate
      if (!target.iconUrl) target.iconUrl = e.iconUrl
    } else {
      byKey.set(e.key, e) // objet lâché absent du catalogue -> ajouté
    }
  }
  fullCache = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return fullCache
}

const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function itemMatches(entry: ItemEntry, query: string): boolean {
  const q = stripDiacritics(query.trim())
  if (!q) return true
  return stripDiacritics(entry.name).includes(q) || (!!entry.nameEn && stripDiacritics(entry.nameEn).includes(q))
}
