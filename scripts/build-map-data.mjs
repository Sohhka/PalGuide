// Génère les données de la carte interactive (positions normalisées 0..1).
// Sources : PalworldSaveTools (MIT, deafdudecomputers) — voir crédits README.
//   - fast_travel_points.json : { GUID: {x,y,z, id, localized_name} } en coords save
//   - boss_mapping.json        : drapeaux de boss -> id de zone
//   - T_WorldMap.webp          : fond de carte (île principale Palpagos)
// Transformation (lib palworld-coord) : sav -> carte in-game, puis -> fraction d'image.
//   mapX = round((y - 158000)/459) ; mapY = round((x + 123888)/459)   (X/Y inversés)
//   fx = (mapX + 1000)/2000 ; fy = (1000 - mapY)/2000  (île principale = [-1000,1000])
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = 'https://raw.githubusercontent.com/deafdudecomputers/PalworldSaveTools/main'

const TRANSL_X = 123888
const TRANSL_Y = 158000
const SCALE = 459
const RANGE = 1000 // demi-plage de l'île principale

/** coords save -> fraction d'image {fx, fy} + coords carte in-game {mx, my} */
function savToFraction(x, y) {
  const mx = Math.round((y - TRANSL_Y) / SCALE)
  const my = Math.round((x + TRANSL_X) / SCALE)
  const fx = (mx + RANGE) / (2 * RANGE)
  const fy = (RANGE - my) / (2 * RANGE)
  return { mx, my, fx, fy }
}

const onMainIsland = (fx, fy) => fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1

async function getJson(path) {
  const r = await fetch(`${RAW}/${path}`)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

async function download(path, dest) {
  const r = await fetch(`${RAW}/${path}`)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, buf)
  return buf.length
}

async function main() {
  // --- Voyage rapide ---
  const ftRaw = await getJson('resources/game_data/fast_travel_points.json')
  const fastTravel = []
  let ftOff = 0
  for (const [guid, p] of Object.entries(ftRaw)) {
    const { fx, fy } = savToFraction(p.x, p.y)
    if (!onMainIsland(fx, fy)) { ftOff++; continue }
    fastTravel.push({
      guid: guid.toLowerCase(),
      id: p.id,
      name: p.localized_name || p.id,
      fx: +fx.toFixed(5),
      fy: +fy.toFixed(5),
    })
  }

  // --- Tours de boss (syndicat) : points « Tower Entrance » (hors watchtowers décoratifs) ---
  const towers = []
  for (const [guid, p] of Object.entries(ftRaw)) {
    const nm = p.localized_name || ''
    if (!/tower/i.test(nm) || /watchtower/i.test(nm)) continue
    const { fx, fy } = savToFraction(p.x, p.y)
    if (!onMainIsland(fx, fy)) continue
    towers.push({ guid: guid.toLowerCase(), name: nm, fx: +fx.toFixed(5), fy: +fy.toFixed(5) })
  }

  // --- Mapping des boss (flag -> zone) ---
  const bossMap = await getJson('resources/game_data/boss_mapping.json')

  // --- Fond de carte ---
  const imgBytes = await download('resources/assets/maps/T_WorldMap.webp', join(ROOT, 'public/img/worldmap.webp'))

  const out = {
    _source: 'PalworldSaveTools (MIT, deafdudecomputers) + palworld-coord',
    image: 'img/worldmap.webp',
    fastTravel,
    towers,
    bossFlagMap: bossMap.boss_defeat_flag_map ?? {},
  }
  writeFileSync(join(ROOT, 'src/data/map.json'), JSON.stringify(out, null, 0))

  console.log(`Voyage rapide : ${fastTravel.length} sur l'île (${ftOff} hors île / DLC ignorés)`)
  console.log(`Tours de boss : ${towers.length}`)
  console.log(`Boss flags : ${Object.keys(out.bossFlagMap).length}`)
  console.log(`Image : ${(imgBytes / 1024).toFixed(0)} Ko -> public/img/worldmap.webp`)
  console.log('Écrit : src/data/map.json')
  // échantillon pour vérif visuelle
  for (const f of fastTravel.slice(0, 5)) console.log(`  ${f.name}: fx=${f.fx} fy=${f.fy}`)
}

main().catch((e) => { console.error('ERREUR', e); process.exit(1) })
