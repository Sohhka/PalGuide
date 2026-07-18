// Génère les données de la carte interactive (positions normalisées 0..1).
// Sources : PalworldSaveTools (MIT, deafdudecomputers) — voir crédits README.
//   - fast_travel_points.json : { GUID: {x,y,z, id, localized_name} } en coords save
//   - boss_mapping.json        : drapeaux de boss -> id de zone
//   - T_WorldMap.webp          : fond de carte (île principale Palpagos)
// Transformation (lib palworld-coord, constantes « new » de la carte 1.0+ complète) :
//   mapX = round((y + 18)/725) ; mapY = round((x + 375247)/725)   (X/Y inversés)
//   fx = (mapX + 1000)/2000 ; fy = (1000 - mapY)/2000  (carte monde = [-1000,1000])
// (les anciennes constantes 123888/158000/459 étaient calibrées pour l'ancienne
//  carte Palpagos seule et décalaient tout sur la carte monde actuelle.)
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = 'https://raw.githubusercontent.com/deafdudecomputers/PalworldSaveTools/main'

// ------------------------------------------------------------------ //
//  POI depuis paldb.cc (map_data_fr.js) — voir crédits README        //
//  Catégories utilisateur -> types paldb + icône officielle.         //
// ------------------------------------------------------------------ //
const PALDB_MAP_DATA = 'https://paldb.cc/js/map_data_fr.js'

const POI_CATEGORIES = [
  { id: 'effigy', label: 'Effigies', icon: 'lifmunk_effigy.png', types: ['Lifmunk Effigy'] },
  { id: 'chest', label: 'Coffres', icon: 'chest-loc.png', types: ['Treasure', 'Treasure Element', 'Treasure Map', 'Oilrig Treasure', 'Oilrig Treasure Goal'] },
  { id: 'egg', label: 'Œufs', icon: 'egg-loc.png', types: ['Grass Egg', 'Volcano Egg', 'Frozen Egg', 'Desert Egg', 'Feybreak Egg', 'Sakura Egg'] },
  { id: 'dungeon', label: 'Donjons', icon: 'T_icon_compass_dungeon.png', types: ['Dungeon', 'Cave Entrance'] },
  { id: 'alpha', label: 'Pals Alpha', icon: 'T_prt_reticle_pal_icon.png', types: ['Alpha Pal'] },
  { id: 'npc', label: 'PNJ', icon: 'npc-loc.png', types: ['NPC', 'City', 'Arrogant Pal Critic'] },
  { id: 'merchant', label: 'Marchands', icon: 'merch-loc.png', types: ['Wandering Merchant', 'Black Marketeer'] },
  { id: 'fruit', label: 'Arbres à fruits', icon: 'fruit-loc.png', types: ['Fruit Tree'] },
  { id: 'note', label: 'Journaux', icon: 'note-loc.png', types: ['Journals'] },
  { id: 'fishing', label: 'Pêche', icon: null, types: ['Fishing Spot'] },
  { id: 'ore', label: 'Minerais', icon: null, types: ['Ore', 'Coal', 'Sulfur', 'Pure Quartz', 'Hexolite Quartz', 'Chromite', 'Crude Oil', 'Nightstar Sand', 'Coal Cluster', 'Ore Cluster', 'Pure Quartz Cluster', 'Sulfur Cluster'] },
]

/** Récupère les POI de paldb.cc, applique leur transformation exacte ipos -> fraction d'image. */
async function fetchPaldbPoi() {
  const r = await fetch(PALDB_MAP_DATA, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://paldb.cc/fr/Palpagos_Islands' } })
  if (!r.ok) throw new Error(`paldb map_data -> ${r.status}`)
  const ctx = {}
  createContext(ctx)
  runInContext(await r.text(), ctx)
  const all = [...(ctx.extrasIngame || []), ...(ctx.extras || []), ...(ctx.fixedDungeon || [])].filter((m) => m && m.ipos)
  // Transformation exacte de paldb (config + perPixel=459)
  const c = ctx.config
  const perPixel = 459
  const tXp = (c.landScapeRealPositionMax.X - c.landScapeRealPositionMin.X) / perPixel
  const tYp = (c.landScapeRealPositionMax.Y - c.landScapeRealPositionMin.Y) / perPixel
  const igXs = 1000 + (-582888 - c.landScapeRealPositionMin.X) / perPixel
  const igYs = 1000 + (-301000 - c.landScapeRealPositionMin.Y) / perPixel
  const toFrac = (X, Y) => ({ fx: (X + igYs) / tYp, fy: 1 - (Y + igXs) / tXp })

  const typeToCat = {}
  for (const cat of POI_CATEGORIES) for (const t of cat.types) typeToCat[t] = cat.id

  const poi = {}
  for (const cat of POI_CATEGORIES) poi[cat.id] = []
  for (const m of all) {
    const cat = typeToCat[m.type]
    if (!cat) continue
    const { fx, fy } = toFrac(m.ipos.X, m.ipos.Y)
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue
    const e = { fx: +fx.toFixed(4), fy: +fy.toFixed(4) }
    if (m.item) e.n = m.item
    if (typeof m.lv === 'number') e.lv = m.lv
    if (m.onlyTime) e.time = m.onlyTime // day / night
    poi[cat].push(e)
  }
  return { poi, meta: POI_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon ? `img/map-icons/${c.icon}` : null })) }
}

const TRANSL_X = 375247
const TRANSL_Y = -18
const SCALE = 725
const RANGE = 1000 // demi-plage de la carte monde

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

  // --- POI depuis paldb.cc ---
  const { poi, meta } = await fetchPaldbPoi()

  // --- Fond de carte ---
  const imgBytes = await download('resources/assets/maps/T_WorldMap.webp', join(ROOT, 'public/img/worldmap.webp'))

  const out = {
    _source: 'PalworldSaveTools (MIT, deafdudecomputers) + palworld-coord ; POI: paldb.cc',
    image: 'img/worldmap.webp',
    fastTravel,
    towers,
    bossFlagMap: bossMap.boss_defeat_flag_map ?? {},
    poiMeta: meta,
    poi,
  }
  writeFileSync(join(ROOT, 'src/data/map.json'), JSON.stringify(out, null, 0))

  console.log(`Voyage rapide : ${fastTravel.length} sur l'île (${ftOff} hors île / DLC ignorés)`)
  console.log(`Tours de boss : ${towers.length}`)
  console.log(`Boss flags : ${Object.keys(out.bossFlagMap).length}`)
  console.log(`POI paldb : ${meta.map((m) => `${m.id}=${poi[m.id].length}`).join(', ')}`)
  console.log(`Image : ${(imgBytes / 1024).toFixed(0)} Ko -> public/img/worldmap.webp`)
  console.log('Écrit : src/data/map.json')
  // échantillon pour vérif visuelle
  for (const f of fastTravel.slice(0, 5)) console.log(`  ${f.name}: fx=${f.fx} fy=${f.fy}`)
}

main().catch((e) => { console.error('ERREUR', e); process.exit(1) })
