// Scrape paldb.cc (/fr) pour enrichir chaque Pal avec ce que PalCalc n'a pas :
// élément, capture, melee/shot, genus, drops, partner skill (FR), niveaux+portée
// des active skills, description. HTML mis en cache -> re-parsing sans re-fetch.
//
// Usage :
//   node scripts/scrape-paldb.mjs           # fetch (avec cache) + parse -> paldb.json
//   node scripts/scrape-paldb.mjs --parse   # re-parse uniquement depuis le cache HTML
//   node scripts/scrape-paldb.mjs --force    # ignore le cache et re-télécharge tout
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsePalPage } from './lib/paldb-parse.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE_DIR = join(ROOT, 'data', '_cache', 'paldb')
const OUT_FILE = join(ROOT, 'data', '_cache', 'paldb.json')
const DB_JSON = join(ROOT, 'data', '_sources', 'palcalc', 'PalCalc.Model', 'db.json')

const args = new Set(process.argv.slice(2))
const PARSE_ONLY = args.has('--parse')
const FORCE = args.has('--force')
const CONCURRENCY = 5
const BASE = 'https://paldb.cc/fr/'

mkdirSync(CACHE_DIR, { recursive: true })

function slugFor(enName) {
  return enName.replace(/\s+/g, '_')
}

function cachePath(internal) {
  return join(CACHE_DIR, `${internal}.html`)
}

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (PalGuide data build; contact via github)',
          'Accept-Language': 'fr,en;q=0.8',
        },
      })
      if (res.status === 404) return { status: 404, html: null }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      return { status: 200, html }
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
}

async function getHtml(pal) {
  const cp = cachePath(pal.internal)
  if (!FORCE && existsSync(cp)) {
    const html = readFileSync(cp, 'utf-8')
    if (html && html.includes('ElementType1')) return { html, cached: true }
  }
  if (PARSE_ONLY) return { html: existsSync(cp) ? readFileSync(cp, 'utf-8') : null, cached: true }
  const url = BASE + encodeURI(slugFor(pal.en))
  const { status, html } = await fetchWithRetry(url)
  if (status === 404 || !html) return { html: null, cached: false, notFound: true }
  writeFileSync(cp, html)
  await new Promise((r) => setTimeout(r, 120)) // politesse
  return { html, cached: false }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let idx = 0
  let done = 0
  async function next() {
    const i = idx++
    if (i >= items.length) return
    results[i] = await worker(items[i], i)
    done++
    if (done % 20 === 0 || done === items.length) {
      process.stdout.write(`  … ${done}/${items.length}\n`)
    }
    return next()
  }
  await Promise.all(Array.from({ length: concurrency }, next))
  return results
}

async function main() {
  const db = JSON.parse(readFileSync(DB_JSON, 'utf-8'))
  const pals = db.Pals.map((p) => ({
    internal: p.InternalName,
    en: p.LocalizedNames?.en || p.Name,
    dex: p.Id?.PalDexNo,
  }))
  console.log(`Pals à traiter : ${pals.length} (concurrence ${CONCURRENCY}, ${PARSE_ONLY ? 'parse-only' : FORCE ? 'force fetch' : 'fetch+cache'})`)

  const out = {}
  const problems = []
  const elementSet = new Set()

  await runPool(
    pals,
    async (pal) => {
      let html
      try {
        const r = await getHtml(pal)
        html = r.html
        if (!html) {
          problems.push({ ...pal, reason: r.notFound ? '404' : 'no-html' })
          return
        }
      } catch (e) {
        problems.push({ ...pal, reason: String(e.message || e) })
        return
      }
      const rec = parsePalPage(html)
      if (rec.element1) elementSet.add(rec.element1)
      if (rec.element2) elementSet.add(rec.element2)
      if (!rec.element1) problems.push({ ...pal, reason: 'no-element' })
      out[pal.internal] = rec
    },
    CONCURRENCY,
  )

  writeFileSync(OUT_FILE, JSON.stringify(out, null, 0))
  const cachedFiles = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.html')).length
  console.log(`\n✔ Écrit ${Object.keys(out).length} enregistrements -> ${OUT_FILE}`)
  console.log(`  Cache HTML : ${cachedFiles} fichiers`)
  console.log(`  Éléments rencontrés : ${[...elementSet].sort().join(', ')}`)
  if (problems.length) {
    console.log(`\n⚠ ${problems.length} problème(s) :`)
    for (const p of problems.slice(0, 40)) console.log(`   - ${p.internal} (${p.en}) : ${p.reason}`)
  } else {
    console.log('  Aucun problème 🎉')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
