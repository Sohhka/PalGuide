// Génère src/data/schematics.json : plans (schematics) d'armes/armures,
// avec leur rareté, les Pals/boss qui les lâchent, et s'ils sont en coffre.
// Source : pages *_Schematic_N de paldb.cc. Cache dans data/_cache/paldb-eq/.
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data', '_cache', 'paldb-eq')
mkdirSync(CACHE, { recursive: true })
const FORCE = process.argv.includes('--force')
const BASE = 'https://paldb.cc/fr/'
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const RARITY = { Commun: 0, Inhabituel: 1, Rare: 2, Épique: 3, Légendaire: 4 }

// --- Correspondance nom de boss -> clé de Pal (par suffixe de nom, le plus long gagne) ---
const pals = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'pals.json'), 'utf8'))
const nameIndex = []
for (const p of pals) for (const nm of [p.name, p.nameEn]) if (nm) nameIndex.push({ key: p.key, n: norm(nm), len: nm.length })
nameIndex.sort((a, b) => b.len - a.len)
function matchPalKey(dropperName) {
  const d = norm(dropperName)
  for (const e of nameIndex) if (d === e.n || d.endsWith(' ' + e.n) || d.endsWith(e.n)) return e.key
  return null
}

async function fetchPage(slug) {
  const f = join(CACHE, `${slug}.html`)
  if (!FORCE && existsSync(f)) return readFileSync(f, 'utf8')
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + encodeURI(slug), { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.status === 404) { writeFileSync(f, ''); return '' }
      if (!r.ok) throw new Error(`${r.status}`)
      const html = await r.text(); writeFileSync(f, html); return html
    } catch (e) { if (i === 2) { console.warn(`  ! ${slug}: ${e.message}`); return '' }; await new Promise((res) => setTimeout(res, 400 * (i + 1))) }
  }
  return ''
}

/** Extrait les slugs *_Schematic_N liés depuis une page équipement. */
function schematicSlugs(html) {
  const $ = cheerio.load(html)
  const out = new Set()
  $('a[href]').each((_, a) => { const h = $(a).attr('href') || ''; if (/_Schematic_\d+$/.test(h)) out.add(h) })
  return [...out]
}

function parseSchematic(html) {
  const $ = cheerio.load(html)
  const name = clean($('.nav-link[data-bs-target]').first().text()) || clean($('a.itemname').first().text()) || null
  if (!name) return null
  const icon = $('img[src*="itemicon"]').first().attr('src') || null
  let rarity = null, droppers = [], treasureBox = false
  $('.card').each((_, card) => {
    const t = clean($(card).find('.card-title').first().text())
    if (/^Stats$/i.test(t)) {
      $(card).find('.d-flex.justify-content-between').each((_, row) => {
        if (/Rarity/i.test($(row).children().first().text())) rarity = RARITY[clean($(row).children().last().text())] ?? rarity
      })
    }
    if (/dropped by/i.test(t)) {
      $(card).find('a[href]').each((_, a) => {
        const txt = clean($(a).text())
        if (txt) droppers.push({ name: txt, palKey: matchPalKey(txt) })
      })
    }
    if (/treasure/i.test(t)) treasureBox = true
  })
  // dédoublonne les droppeurs
  const seen = new Set()
  droppers = droppers.filter((d) => (seen.has(d.name) ? false : seen.add(d.name)))
  return { name, icon, rarity, droppers, treasureBox }
}

async function main() {
  console.log(`Plans (schematics) — cache ${FORCE ? 'ignoré' : 'utilisé'}`)
  const equip = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'equipment.json'), 'utf8'))
  // énumère les slugs de plans depuis les pages équipement en cache
  const schSlugs = new Set()
  for (const it of equip.items) {
    const f = join(CACHE, `${it.slug}.html`)
    if (existsSync(f)) for (const s of schematicSlugs(readFileSync(f, 'utf8'))) schSlugs.add(s)
  }
  const list = [...schSlugs]
  console.log(`  ${list.length} plans à traiter`)

  const IMG = join(ROOT, 'public', 'img', 'equipment')
  mkdirSync(IMG, { recursive: true })
  const iconCache = new Map()
  async function localIcon(url) {
    if (!url || !/^https?:/.test(url)) return url
    if (iconCache.has(url)) return iconCache.get(url)
    const b = url.split('/').pop().split('?')[0]; const dest = join(IMG, b); const rel = `img/equipment/${b}`
    iconCache.set(url, rel)
    if (!existsSync(dest)) { try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (r.ok) writeFileSync(dest, Buffer.from(await r.arrayBuffer())) } catch { /* */ } }
    return rel
  }

  const schematics = []
  let done = 0
  const CONC = 6
  for (let i = 0; i < list.length; i += CONC) {
    const batch = list.slice(i, i + CONC)
    const parsed = await Promise.all(batch.map(async (slug) => { const s = parseSchematic(await fetchPage(slug)); return s ? { slug, ...s } : null }))
    for (const s of parsed) { done++; if (s && s.droppers.length) schematics.push(s) }
    process.stdout.write(`\r  ${done}/${list.length}`)
  }
  // télécharge les icônes localement
  for (const s of schematics) s.icon = await localIcon(s.icon)

  writeFileSync(join(ROOT, 'src', 'data', 'schematics.json'), JSON.stringify(schematics))
  const matched = schematics.reduce((n, s) => n + s.droppers.filter((d) => d.palKey).length, 0)
  const total = schematics.reduce((n, s) => n + s.droppers.length, 0)
  console.log(`\n${schematics.length} plans avec droppeur -> src/data/schematics.json (${matched}/${total} droppeurs reliés à un Pal)`)
}
main().catch((e) => { console.error('ERREUR', e); process.exit(1) })
