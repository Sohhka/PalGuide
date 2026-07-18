// Génère src/data/equipment.json : armes, armures, planeurs, accessoires
// (stats par rareté + recette) depuis paldb.cc. Cache HTML dans data/_cache/paldb-eq/.
//   node scripts/build-equipment.mjs           # fetch (avec cache) + parse
//   node scripts/build-equipment.mjs --force   # re-télécharge tout
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data', '_cache', 'paldb-eq')
mkdirSync(CACHE, { recursive: true })
const FORCE = process.argv.includes('--force')
const BASE = 'https://paldb.cc/fr/'
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()

const CATEGORIES = [
  { page: 'Weapon', id: 'weapon', label: 'Armes' },
  { page: 'Armor', id: 'armor', label: 'Armures' },
  { page: 'Glider', id: 'glider', label: 'Planeurs' },
  { page: 'Accessory', id: 'accessory', label: 'Accessoires' },
]

// Correspondance des libellés de rareté FR -> tier
const RARITY = { Commun: 0, Inhabituel: 1, Rare: 2, Épique: 3, Légendaire: 4 }

async function fetchPage(slug) {
  const cacheFile = join(CACHE, `${slug}.html`)
  if (!FORCE && existsSync(cacheFile)) return readFileSync(cacheFile, 'utf8')
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + encodeURI(slug), { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.status === 404) { writeFileSync(cacheFile, ''); return '' }
      if (!r.ok) throw new Error(`${r.status}`)
      const html = await r.text()
      writeFileSync(cacheFile, html)
      return html
    } catch (e) {
      if (i === 2) { console.warn(`  ! ${slug}: ${e.message}`); return '' }
      await new Promise((res) => setTimeout(res, 400 * (i + 1)))
    }
  }
  return ''
}

/** Slugs d'items listés sur une page catégorie (table principale). */
function enumerate(html) {
  const $ = cheerio.load(html)
  const slugs = new Set()
  $('table a.itemname[href], .card a.itemname[href]').each((_, a) => {
    const href = $(a).attr('href') || ''
    if (/^[A-Za-z0-9_]+$/.test(href)) slugs.add(href)
  })
  return [...slugs]
}

const num = (s) => { const m = clean(s).replace(/[  ]/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : undefined }

const TYPEA_CAT = { Weapon: 'weapon', Armor: 'armor', Glider: 'glider', Accessory: 'accessory' }

/** Parse une page item -> variantes par rareté + méta + recette. */
function parseItem(html) {
  const $ = cheerio.load(html)
  const name = clean($('.nav-link[data-bs-target]').first().text()) || clean($('a.itemname').first().text()) || null
  if (!name) return null
  const icon = $('img[src*="itemicon"]').first().attr('src') || null

  const variants = []
  let typeA = null
  $('.card').each((_, card) => {
    const title = clean($(card).find('.card-title').first().text())
    const isStats = /^Stats$/i.test(title)
    const isOthers = /others/i.test(title)
    if (!isStats && !isOthers) return
    const kv = {}
    $(card).find('.d-flex.justify-content-between').each((_, row) => {
      const k = clean($(row).children().first().text()); const v = clean($(row).children().last().text())
      if (k) kv[k] = v
    })
    if (isOthers && kv.TypeA && !typeA) typeA = kv.TypeA
    if (isStats && kv.Rarity) {
      variants.push({
        rarity: RARITY[kv.Rarity] ?? 0,
        attack: num(kv.Attaque),
        defense: num(kv['Défense'] ?? kv.Defense),
        durability: num(kv['Résistance'] ?? kv.Durability),
        weight: num(kv.Weight ?? kv.Poids),
        gold: num(kv["Pièce d'or"]),
        magazine: num(kv.MagazineSize),
        hp: num(kv.HP),
      })
    }
  })
  // équipement seulement : type réel Weapon/Armor/Glider/Accessory
  const categoryId = TYPEA_CAT[typeA]
  if (!categoryId) return null
  variants.sort((a, b) => a.rarity - b.rarity)
  // dédoublonne par rareté (garde la 1re)
  const seen = new Set()
  const vpure = variants.filter((v) => (seen.has(v.rarity) ? false : seen.add(v.rarity)))

  // recette : matériaux (icônes d'items) hors variantes de l'arme elle-même
  const materials = []
  const mseen = new Set()
  $('img[src*="itemicon_Material"], img[src*="itemicon_Consume"]').each((_, im) => {
    const src = $(im).attr('src') || ''
    const nm = clean($(im).closest('a').text()) || clean($(im).attr('alt'))
    if (nm && !mseen.has(nm)) { mseen.add(nm); materials.push({ name: nm, icon: src }) }
  })

  return {
    name,
    category: categoryId,
    icon,
    rank: num($('.card .d-flex.justify-content-between:contains("Rank")').first().children().last().text()),
    variants: vpure,
    materials: materials.slice(0, 8),
  }
}

async function main() {
  console.log(`Équipement (cache ${FORCE ? 'ignoré' : 'utilisé'})`)
  // 1) énumération
  const toParse = new Map() // slug -> categoryId (1re catégorie gagne)
  for (const c of CATEGORIES) {
    const slugs = enumerate(await fetchPage(c.page))
    for (const s of slugs) if (!toParse.has(s)) toParse.set(s, c.id)
    console.log(`  ${c.label} : ${slugs.length} items listés`)
  }
  // 2) parse
  const items = []
  let done = 0
  const entries = [...toParse.entries()]
  const CONC = 6
  for (let i = 0; i < entries.length; i += CONC) {
    const batch = entries.slice(i, i + CONC)
    const parsed = await Promise.all(batch.map(async ([slug]) => {
      const it = parseItem(await fetchPage(slug))
      return it ? { slug, ...it } : null
    }))
    for (const it of parsed) { done++; if (it) items.push(it) }
    process.stdout.write(`\r  parse ${done}/${entries.length}`)
  }
  // 3) télécharge les icônes localement (app hors-ligne) + réécrit les chemins
  const IMG = join(ROOT, 'public', 'img', 'equipment')
  mkdirSync(IMG, { recursive: true })
  const iconCache = new Map()
  async function localIcon(url) {
    if (!url || !/^https?:/.test(url)) return url
    if (iconCache.has(url)) return iconCache.get(url)
    const base = url.split('/').pop().split('?')[0]
    const dest = join(IMG, base)
    const rel = `img/equipment/${base}`
    iconCache.set(url, rel)
    if (!existsSync(dest)) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (r.ok) writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
      } catch { /* garde le chemin, icône manquante gérée côté UI */ }
    }
    return rel
  }
  const urls = new Set()
  for (const it of items) { if (it.icon) urls.add(it.icon); for (const m of it.materials) if (m.icon) urls.add(m.icon) }
  process.stdout.write(`\n  icônes : ${urls.size} à récupérer`)
  const urlList = [...urls]
  for (let i = 0; i < urlList.length; i += 12) await Promise.all(urlList.slice(i, i + 12).map(localIcon))
  for (const it of items) {
    if (it.icon) it.icon = iconCache.get(it.icon) ?? it.icon
    for (const m of it.materials) m.icon = iconCache.get(m.icon) ?? m.icon
  }

  items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  const out = { _source: 'paldb.cc', categories: CATEGORIES.map((c) => ({ id: c.id, label: c.label })), items }
  writeFileSync(join(ROOT, 'src', 'data', 'equipment.json'), JSON.stringify(out))
  const byCat = {}
  for (const it of items) byCat[it.category] = (byCat[it.category] || 0) + 1
  console.log(`\n${items.length} équipements -> src/data/equipment.json (${Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(', ')})`)
}
main().catch((e) => { console.error('ERREUR', e); process.exit(1) })
