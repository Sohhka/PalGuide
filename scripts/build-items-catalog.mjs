// Génère src/data/items-catalog.json (catalogue d'items pour l'éditeur d'inventaire)
// + copie les icônes d'items dans public/img/items/.
// Source items/icônes : PalworldSaveTools (MIT). Noms FR : paldb.cc (pages /fr/Items + /en/Items).
//   node scripts/build-items-catalog.mjs
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PST = join(ROOT, 'data', '_sources', 'PalworldSaveTools', 'resources', 'game_data')
const SRC_ICONS = join(PST, 'icons', 'items')
const DEST_ICONS = join(ROOT, 'public', 'img', 'items')
const CACHE = join(ROOT, 'data', '_cache', 'paldb-items')

const RARITY_MAX = 4
const NON_STACK = new Set(['Weapon', 'Armor', 'Glider']) // équipement à données dynamiques
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

async function fetchCached(name, url) {
  mkdirSync(CACHE, { recursive: true })
  const f = join(CACHE, name)
  if (existsSync(f)) return readFileSync(f, 'utf8')
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  const html = await r.text()
  writeFileSync(f, html)
  return html
}

/** Parse une page paldb /Items -> { byHref, byId } (nom localisé). */
function parseItemsPage(html) {
  const $ = cheerio.load(html)
  const byHref = {}, byId = {}
  $('a.itemname[href]').each((_, a) => {
    const href = $(a).attr('href')
    const dh = $(a).attr('data-hover') || ''
    const txt = $(a).text().replace(/\s+/g, ' ').trim()
    if (!href || !txt) return
    if (!byHref[href]) byHref[href] = txt
    const m = dh.match(/[?&]s=[A-Za-z]+%2F([A-Za-z0-9_]+)/)
    if (m && !byId[m[1]]) byId[m[1]] = txt
  })
  return { byHref, byId }
}

async function frenchNames() {
  try {
    const fr = parseItemsPage(await fetchCached('fr-items.html', 'https://paldb.cc/fr/Items'))
    const en = parseItemsPage(await fetchCached('en-items.html', 'https://paldb.cc/en/Items'))
    // nom EN (paldb, normalisé) -> nom FR, via le href commun aux 2 langues
    const enToFr = {}
    for (const [href, frName] of Object.entries(fr.byHref)) {
      const e = en.byHref[href]
      if (e) enToFr[norm(e)] = frName
    }
    return { byId: fr.byId, enToFr }
  } catch (e) {
    console.warn('  ! noms FR indisponibles (', e.message, ') — noms anglais conservés')
    return { byId: {}, enToFr: {} }
  }
}

async function main() {
  const { items, items_dynamic } = JSON.parse(readFileSync(join(PST, 'items.json'), 'utf8'))
  mkdirSync(DEST_ICONS, { recursive: true })
  const existing = new Set(existsSync(DEST_ICONS) ? readdirSync(DEST_ICONS) : [])
  const fr = await frenchNames()

  const out = []
  let copied = 0, frDirect = 0, frViaEn = 0
  const seen = new Set()
  for (const it of items) {
    const id = it.asset
    if (!id || seen.has(id)) continue
    seen.add(id)
    let icon = null
    if (it.icon) {
      const base = it.icon.split('/').pop()
      const from = join(SRC_ICONS, base)
      if (!existing.has(base) && existsSync(from)) { copyFileSync(from, join(DEST_ICONS, base)); existing.add(base); copied++ }
      if (existing.has(base)) icon = `img/items/${base}`
    }
    const en = it.name || id
    let nameFr = null
    if (fr.byId[id]) { nameFr = fr.byId[id]; frDirect++ }
    else if (fr.enToFr[norm(en)]) { nameFr = fr.enToFr[norm(en)]; frViaEn++ }
    const cat = it.type_a_display || ''
    // Équipement à données propres (arme/armure/planeur/accessoire…) : source
    // faisant autorité = items_dynamic (le stack flag par catégorie est peu fiable).
    const din = items_dynamic?.[id]?.dynamic
    const dyn = din && (din.type === 'weapon' || din.type === 'armor')
      ? { t: din.type, d: Math.round((din.durability ?? 0) * 10) / 10 }
      : undefined
    out.push({
      id,
      name: nameFr || en, // FR si dispo, sinon EN
      nameEn: nameFr && nameFr !== en ? en : undefined, // garde l'EN pour la recherche
      icon,
      rarity: Math.max(0, Math.min(RARITY_MAX, it.rarity ?? 0)),
      cat,
      stack: !NON_STACK.has(cat),
      sort: it.sort_id ?? 0,
      ...(dyn ? { dyn } : {}),
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  writeFileSync(join(ROOT, 'src', 'data', 'items-catalog.json'), JSON.stringify(out))
  console.log(`${out.length} items -> src/data/items-catalog.json | ${copied} icônes | FR: ${frDirect + frViaEn}/${out.length} (direct ${frDirect}, via EN ${frViaEn})`)
}
main()
