// Génère src/data/spawns.json : points d'apparition (spawn) par Pal.
// Source : paldb.cc /paldex/<nom>.json (coords monde) — voir crédits README.
// Transformation monde -> fraction d'image (rposToScale + projTpos de paldb) :
//   fx = (Y - minY)/(maxY - minY) ; fy = 1 - (X - minX)/(maxX - minX)
// Cache HTML/JSON dans data/_cache/spawns/ pour éviter de re-télécharger.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'data', '_cache', 'spawns')
mkdirSync(CACHE, { recursive: true })
const FORCE = process.argv.includes('--force')

// Bornes monde (config paldb landScapeRealPosition)
const minX = -1099400, maxX = 349400, minY = -724400, maxY = 724400
const toFrac = (X, Y) => ({ fx: (Y - minY) / (maxY - minY), fy: 1 - (X - minX) / (maxX - minX) })
const onIsland = (fx, fy) => fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1

const pals = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'pals.json'), 'utf8'))
const keys = [...new Set(pals.map((p) => p.key))]

async function fetchSpawn(key) {
  const cacheFile = join(CACHE, `${key}.json`)
  if (!FORCE && existsSync(cacheFile)) {
    try { return JSON.parse(readFileSync(cacheFile, 'utf8')) } catch { /* re-fetch */ }
  }
  const url = `https://paldb.cc/paldex/${key.toLowerCase()}.json`
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://paldb.cc/fr/Palpagos_Islands' } })
      if (r.status === 404) { writeFileSync(cacheFile, 'null'); return null }
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      writeFileSync(cacheFile, JSON.stringify(j))
      return j
    } catch (e) {
      if (i === 2) { console.warn(`  ! ${key}: ${e.message}`); return null }
      await new Promise((res) => setTimeout(res, 400 * (i + 1)))
    }
  }
  return null
}

function pointsOf(data) {
  const out = []
  const seen = new Set()
  for (const bucket of ['dayTimeLocations', 'nightTimeLocations']) {
    const locs = data?.[bucket]?.Locations
    if (!Array.isArray(locs)) continue
    for (const l of locs) {
      if (typeof l.X !== 'number' || typeof l.Y !== 'number') continue
      const { fx, fy } = toFrac(l.X, l.Y)
      if (!onIsland(fx, fy)) continue
      const a = Math.round(fx * 1e4), b = Math.round(fy * 1e4)
      const kk = a * 100000 + b
      if (seen.has(kk)) continue // dédoublonne les points quasi identiques (jour+nuit)
      seen.add(kk)
      out.push([a / 1e4, b / 1e4])
    }
  }
  return out
}

async function main() {
  console.log(`Spawns : ${keys.length} Pals (cache ${FORCE ? 'ignoré' : 'utilisé'})`)
  const spawns = {}
  const CONC = 8
  let done = 0, withPts = 0, totalPts = 0
  for (let i = 0; i < keys.length; i += CONC) {
    const batch = keys.slice(i, i + CONC)
    const results = await Promise.all(batch.map(async (k) => [k, pointsOf(await fetchSpawn(k))]))
    for (const [k, pts] of results) {
      done++
      if (pts.length) { spawns[k] = pts; withPts++; totalPts += pts.length }
    }
    process.stdout.write(`\r  ${done}/${keys.length}`)
  }
  writeFileSync(join(ROOT, 'src', 'data', 'spawns.json'), JSON.stringify(spawns))
  const sizeKb = (Buffer.byteLength(JSON.stringify(spawns)) / 1024).toFixed(0)
  console.log(`\n${withPts} Pals avec spawns, ${totalPts} points au total -> src/data/spawns.json (${sizeKb} Ko)`)
}

main().catch((e) => { console.error('ERREUR', e); process.exit(1) })
