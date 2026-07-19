// Enrichit src/data/items-catalog.json avec la description FR de chaque item (pages /fr/<slug> de paldb).
// Fallback : description EN de PalworldSaveTools items.json. Cache dans data/_cache/paldb-items/pages/.
//   node scripts/build-item-descriptions.mjs
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data', '_cache', 'paldb-items')
const PAGES = join(CACHE, 'pages')
const PST = join(ROOT, 'data', '_sources', 'PalworldSaveTools', 'resources', 'game_data')
mkdirSync(PAGES, { recursive: true })

async function fetchItems(name, url) {
  const f = join(CACHE, name)
  if (existsSync(f)) return readFileSync(f, 'utf8')
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const html = await r.text(); writeFileSync(f, html); return html
}

async function fetchPage(slug) {
  const f = join(PAGES, encodeURIComponent(slug) + '.html')
  if (existsSync(f)) return readFileSync(f, 'utf8')
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://paldb.cc/fr/' + encodeURI(slug), { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.status === 404) { writeFileSync(f, ''); return '' }
      if (!r.ok) throw new Error(String(r.status))
      const html = await r.text(); writeFileSync(f, html); return html
    } catch (e) { if (i === 2) return ''; await new Promise((res) => setTimeout(res, 500 * (i + 1))) }
  }
  return ''
}

/** Description = 1re .card-body de prose française (pas de stats/tableaux). */
function parseDesc($) {
  let best = null
  $('div.card-body').each((_, el) => {
    if (best) return
    const t = $(el).clone().find('table,.d-flex,a,button,img,script,style,.row,ul,ol').remove().end().text().replace(/\s+/g, ' ').trim()
    if (t.length >= 20 && t.length <= 600 && !/\d{3,}/.test(t) && /[a-zàâäéèêëïîôûùüçœ]/i.test(t)) best = t
  })
  return best
}

/** Prix (valeur or) : ligne « Pièce d'or » hors bloc recette. */
function parsePrice($) {
  let price = null
  $('.d-flex.justify-content-between').each((_, r) => {
    if (price != null || $(r).closest('.recipes').length) return
    const k = $(r).children().first().text().replace(/\s+/g, ' ').trim()
    if (/^Pièce d'or$/i.test(k)) { const v = $(r).children().last().text().replace(/[^\d]/g, ''); if (v) price = +v }
  })
  return price
}

/** Recette : lignes du 1er bloc .recipes (les équipements en ont un par rareté -> on évite les doublons). */
function parseRecipe($) {
  const out = []
  $('.recipes').first().find('.d-flex.justify-content-between').each((_, row) => {
    const $row = $(row)
    const a = $row.find('a.itemname').first()
    const name = a.text().replace(/\s+/g, ' ').trim()
    if (!name) return
    const icon = a.find('img').attr('src')
    const rowTxt = $row.text().replace(/\s+/g, ' ').trim()
    const m = rowTxt.slice(name.length).match(/\d[\d\s]*/)
    out.push({ name, icon: icon ? `img/items/${icon.split('/').pop().split('?')[0]}` : null, qty: m ? +m[0].replace(/\s/g, '') : null })
  })
  return out
}

async function main() {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'items-catalog.json'), 'utf8'))
  const { items } = JSON.parse(readFileSync(join(PST, 'items.json'), 'utf8'))
  const enDesc = {}
  for (const it of items) if (it.asset && it.description) enDesc[it.asset] = it.description.replace(/\r?\n/g, ' ').trim()

  // StaticId -> slug depuis /fr/Items (data-hover ?s=Items%2F<id>, href = slug)
  const frItems = await fetchItems('fr-items.html', 'https://paldb.cc/fr/Items')
  const $ = cheerio.load(frItems)
  const slugById = {}, slugByName = {}
  $('a.itemname[href]').each((_, a) => {
    const href = $(a).attr('href'); const dh = $(a).attr('data-hover') || ''
    const name = $(a).text().replace(/\s+/g, ' ').trim().toLowerCase()
    if (href && name && !slugByName[name]) slugByName[name] = href
    const m = dh.match(/[?&]s=[A-Za-z]+%2F([A-Za-z0-9_]+)/)
    if (m && href && !slugById[m[1]]) slugById[m[1]] = href
  })
  console.log(`slugs paldb: par id ${Object.keys(slugById).length}, par nom ${Object.keys(slugByName).length} | items ${catalog.length}`)

  const CONC = 8
  let done = 0, fr = 0, en = 0, none = 0
  for (let i = 0; i < catalog.length; i += CONC) {
    const batch = catalog.slice(i, i + CONC)
    await Promise.all(batch.map(async (it) => {
      let d = null
      const slug = slugById[it.id] || slugByName[(it.name || '').toLowerCase()]
      if (slug) {
        const html = await fetchPage(slug)
        if (html) {
          const $ = cheerio.load(html)
          d = parseDesc($)
          const price = parsePrice($)
          if (price != null) it.price = price
          const recipe = parseRecipe($)
          if (recipe.length) it.recipe = recipe
        }
      }
      if (d) { it.desc = d; fr++ }
      else if (enDesc[it.id]) { it.desc = enDesc[it.id]; en++ }
      else { none++ }
      done++
    }))
    if (done % 200 < CONC) process.stdout.write(`\r  ${done}/${catalog.length} (FR ${fr}, EN ${en}, aucune ${none})`)
  }
  writeFileSync(join(ROOT, 'src', 'data', 'items-catalog.json'), JSON.stringify(catalog))
  console.log(`\nDescriptions -> items-catalog.json | FR ${fr} · EN(fallback) ${en} · aucune ${none}`)
}
main().catch((e) => { console.error('ERREUR', e); process.exit(1) })
