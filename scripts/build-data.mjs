// Fusionne PalCalc (autoritatif, à jour v26/1.0) + le cache paldb.cc
// -> src/data/*.json normalisés (FR) pour l'application.
//
//   PalCalc  : liste des Pals, stats, breeding power, GRAPHE de reproduction
//              complet, work suitability, passifs, genres, noms FR, éléments (liste).
//   paldb.cc : élément par Pal, capture, melee/shot, genus, drops, partner skill
//              (FR + effets), niveaux + portée des active skills, description FR.
//
// Usage : node scripts/build-data.mjs   (lance `npm run scrape-paldb` avant si besoin)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'data', '_sources', 'palcalc', 'PalCalc.Model')
const PALDB_JSON = join(ROOT, 'data', '_cache', 'paldb.json')
const OUT_DIR = join(ROOT, 'src', 'data')
mkdirSync(OUT_DIR, { recursive: true })

const CDN = 'https://cdn.paldb.cc/image'
const palIcon = (internal) => `${CDN}/Pal/Texture/PalIcon/Normal/T_${internal}_icon_normal.webp`

// Couleurs d'éléments (alignées avec src/index.css --el-*)
const ELEMENT_COLORS = {
  Normal: '#9aa7bd',
  Fire: '#ff7a45',
  Water: '#38bdf8',
  Leaf: '#4ade80',
  Electricity: '#facc15',
  Ice: '#7dd3fc',
  Earth: '#d0a45a',
  Dark: '#b084f5',
  Dragon: '#c084fc',
}

// Traduction FR des catégories de genre (genus)
const GENUS_FR = {
  Humanoid: 'Humanoïde',
  Dragon: 'Dragon',
  Bird: 'Oiseau',
  FourLegged: 'Quadrupède',
  Monster: 'Monstre',
  Fish: 'Poisson',
  Plant: 'Plante',
  Ghost: 'Fantôme',
  Boss: 'Boss',
  Fairy: 'Fée',
  Insect: 'Insecte',
  Reptile: 'Reptile',
  Beast: 'Bête',
  Slime: 'Slime',
  Mechanical: 'Mécanique',
  Human: 'Humain',
}

// Traduction FR des aptitudes de travail
const WORK_FR = {
  Kindling: 'Allumage',
  Watering: 'Arrosage',
  Planting: 'Plantation',
  GenerateElectricity: 'Électricité',
  Handiwork: 'Artisanat',
  Gathering: 'Récolte',
  Lumbering: 'Bûcheronnage',
  Mining: 'Minage',
  MedicineProduction: 'Médecine',
  Cooling: 'Réfrigération',
  Transporting: 'Transport',
  Farming: 'Ferme',
}
// Index d'icône work (T_icon_palwork_XX)
const WORK_ICON_INDEX = {
  Kindling: '00',
  Watering: '01',
  Planting: '02',
  GenerateElectricity: '03',
  Handiwork: '04',
  Gathering: '05',
  Lumbering: '06',
  Mining: '07',
  MedicineProduction: '10',
  Cooling: '08',
  Transporting: '11',
  Farming: '12',
}
const workIcon = (k) => `${CDN}/Pal/Texture/UI/InGame/T_icon_palwork_${WORK_ICON_INDEX[k]}.webp`

// Retire les placeholders de localisation non résolus, ex. "{ReferenceMsgId_Xxx}"
const stripRefs = (s) => (s ? s.replace(/\s*\{[A-Za-z0-9_]+\}/g, '').replace(/\s+/g, ' ').trim() : s)

const fr = (loc, fallback) => {
  if (!loc) return fallback ?? null
  const v = loc.fr
  if (!v || v === '-' || v === 'fr_Text' || v === 'None') return loc.en || fallback || null
  return v
}

function main() {
  const db = JSON.parse(readFileSync(join(SRC, 'db.json'), 'utf-8'))
  const breeding = JSON.parse(readFileSync(join(SRC, 'breeding.json'), 'utf-8')).Breeding
  const paldb = existsSync(PALDB_JSON) ? JSON.parse(readFileSync(PALDB_JSON, 'utf-8')) : {}
  if (!existsSync(PALDB_JSON)) {
    console.warn('⚠ data/_cache/paldb.json absent — lance `npm run scrape-paldb` d\'abord. Build partiel.')
  }

  // ---- Index interne -> id court (0..N-1) pour le graphe ----
  const internalToId = {}
  db.Pals.forEach((p) => {
    internalToId[p.InternalName] = p.InternalIndex
  })

  // ---- Références skills / passifs (PalCalc) ----
  const activeByInternal = {}
  for (const s of db.ActiveSkills) activeByInternal[s.InternalName] = s

  // ---- elements.json (icônes locales fournies, dans public/img/elements/) ----
  const elements = db.Elements.map((el) => ({
    key: el.InternalName,
    name: fr(el.LocalizedNames, el.Name),
    color: ELEMENT_COLORS[el.InternalName] || '#9aa7bd',
    iconUrl: `img/elements/${el.InternalName}.png`,
  }))

  // ---- passives.json (map internal -> {name, description, rank}) ----
  const passives = {}
  for (const p of db.PassiveSkills) {
    const name = fr(p.LocalizedNames, p.Name)
    if (!name || name === 'en Text' || /_Text$/.test(name)) continue
    passives[p.InternalName] = {
      name,
      description: fr(p.LocalizedDescriptions, null),
      rank: p.Rank,
      standard: !!p.IsStandardPassiveSkill,
      inheritable: !!p.RandomInheritanceAllowed,
    }
  }

  // ---- pals.json ----
  const genderProb = db.BreedingGenderProbability || {}
  const missing = { element: [], partner: [], capture: [], paldb: [] }

  const pals = db.Pals.map((p) => {
    const pd = paldb[p.InternalName] || {}
    if (!paldb[p.InternalName]) missing.paldb.push(p.InternalName)

    const elements = [pd.element1, pd.element2].filter(Boolean)
    if (!elements.length) missing.element.push(p.InternalName)

    // Active skills : niveau+portée de paldb, valeurs canoniques de PalCalc
    const activeSkills = (pd.activeSkills || [])
      .filter((s) => s.internalId)
      .map((s) => {
        const base = activeByInternal[s.internalId]
        return {
          level: s.level ?? null,
          key: s.internalId,
          name: base ? fr(base.LocalizedNames, base.Name) : s.frName,
          element: base?.ElementInternalName ?? null,
          power: base?.Power ?? s.power ?? null,
          cooldown: base?.CooldownSeconds ?? s.cooldown ?? null,
          rangeMin: s.rangeMin ?? null,
          rangeMax: s.rangeMax ?? null,
          hasSkillFruit: base?.HasSkillFruit ?? s.hasSkillFruit ?? false,
          canInherit: base?.CanInherit ?? null,
        }
      })
      .sort((a, b) => (a.level ?? 999) - (b.level ?? 999))

    const partner = pd.partnerSkill
      ? {
          title: pd.partnerSkill.title,
          description: stripRefs(pd.partnerSkill.description),
          noStack: !!pd.partnerSkill.noStack,
          effects: pd.partnerSkill.effects || [],
          maxRank: pd.partnerSkill.maxRank ?? null,
          iconUrl: pd.partnerSkill.iconUrl ?? null,
        }
      : null
    if (!partner) missing.partner.push(p.InternalName)

    const captureRateCorrect = pd.captureRateCorrect ?? 1.0
    if (pd.captureRateCorrect == null) missing.capture.push(p.InternalName)

    const work = {}
    for (const [k, v] of Object.entries(p.WorkSuitability || {})) {
      if (v > 0) work[k] = v
    }

    return {
      id: p.InternalIndex,
      dex: p.Id?.PalDexNo ?? null,
      variant: !!p.Id?.IsVariant,
      key: p.InternalName,
      name: fr(p.LocalizedNames, p.Name),
      nameEn: p.LocalizedNames?.en || p.Name,
      elements,
      rarity: p.Rarity,
      size: p.Size,
      genus: pd.genus ? GENUS_FR[pd.genus] || pd.genus : null,
      genusKey: pd.genus || null,
      nocturnal: p.Nocturnal ?? pd.nocturnal ?? false,
      predator: pd.predator ?? false,
      price: p.Price,
      minLevel: p.MinWildLevel,
      maxLevel: p.MaxWildLevel,
      maleProbability: Math.round((genderProb[p.InternalName]?.MALE ?? 0.5) * 100),
      breedingPower: p.BreedingPower,
      breedingPriority: p.BreedingPowerPriority,
      stats: {
        hp: p.Hp,
        meleeAttack: pd.meleeAttack ?? p.Attack,
        shotAttack: pd.shotAttack ?? p.Attack,
        defense: p.Defense,
        stamina: p.Stamina,
        craftSpeed: p.CraftSpeed,
        food: p.FoodAmount,
      },
      speeds: {
        walk: p.WalkSpeed,
        run: p.RunSpeed,
        rideSprint: p.RideSprintSpeed,
        transport: p.TransportSpeed,
      },
      work,
      captureRateCorrect,
      partnerSkill: partner,
      activeSkills,
      guaranteedPassives: p.GuaranteedPassivesInternalIds || [],
      drops: (pd.drops || []).map((d) => ({
        item: d.internal,
        name: d.name,
        iconUrl: d.iconUrl,
        quantity: d.quantity,
        rate: d.rate,
        levelGate: d.levelGate ?? null,
      })),
      description: stripRefs(pd.description) || null,
      iconUrl: pd.iconUrl || palIcon(p.InternalName),
    }
  })

  // ---- breeding.json : triples [p1Id, p2Id, childId] (id = InternalIndex) ----
  const pairs = []
  for (const b of breeding) {
    const a = internalToId[b.Parent1InternalName]
    const c = internalToId[b.Parent2InternalName]
    const child = internalToId[b.ChildInternalName]
    if (a == null || c == null || child == null) continue
    pairs.push([a, c, child])
  }

  // ---- meta.json ----
  const meta = {
    gameVersion: '1.0',
    dbVersion: db.Version,
    generatedAt: new Date().toISOString().slice(0, 10),
    palCount: pals.length,
    breedingPairs: pairs.length,
    sources: ['PalCalc (MIT)', 'paldb.cc'],
  }

  // ---- Écriture ----
  const write = (name, obj) => {
    const file = join(OUT_DIR, name)
    writeFileSync(file, JSON.stringify(obj))
    return (JSON.stringify(obj).length / 1024).toFixed(0)
  }
  const sizes = {
    'pals.json': write('pals.json', pals),
    'breeding.json': write('breeding.json', { pairs }),
    'elements.json': write('elements.json', elements),
    'passives.json': write('passives.json', passives),
    'meta.json': write('meta.json', meta),
    'work.json': write('work.json', { labels: WORK_FR, icons: Object.fromEntries(Object.keys(WORK_FR).map((k) => [k, workIcon(k)])) }),
  }

  console.log('✔ Données générées dans src/data/')
  for (const [f, kb] of Object.entries(sizes)) console.log(`   ${f.padEnd(16)} ${kb} KB`)
  console.log(`\n   Pals: ${pals.length} | Recettes de breeding: ${pairs.length}`)
  console.log(`   Éléments avec icône: ${elements.filter((e) => e.iconUrl).length}/${elements.length}`)
  console.log('\n   Couverture (manques) :')
  console.log(`   - sans données paldb : ${missing.paldb.length}`)
  console.log(`   - sans élément       : ${missing.element.length}${missing.element.length ? ' -> ' + missing.element.slice(0, 12).join(', ') : ''}`)
  console.log(`   - sans partner skill : ${missing.partner.length}${missing.partner.length ? ' -> ' + missing.partner.slice(0, 12).join(', ') : ''}`)
  console.log(`   - sans capture rate  : ${missing.capture.length}`)
}

main()
