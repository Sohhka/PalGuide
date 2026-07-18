// ------------------------------------------------------------------ //
//  Générateur d'équipe par prompt (moteur LOCAL, hors-ligne)          //
//  Interprète une phrase FR -> intentions -> score les Pals ->        //
//  assemble une équipe de 5 en respectant les cumuls de partner skill.//
// ------------------------------------------------------------------ //
import type { Pal } from './types'
import { rarityTier, totalWork, RARITY_LABEL } from './pal-helpers'
import { skillCategories } from './partnerSkills'
import { starSkillFactor, starStatFactor } from './stars'
import { pals, palByKey, workLabels } from '../data'

export type IntentId = 'dps' | 'tank' | 'base' | 'mount' | 'capture' | 'boss'
export type StatKey = 'hp' | 'meleeAttack' | 'shotAttack' | 'defense' | 'stamina' | 'food'
export type SpeedKey = 'walk' | 'run' | 'rideSprint' | 'transport'
export type ElementKey =
  | 'Normal' | 'Fire' | 'Water' | 'Leaf' | 'Electricity' | 'Ice' | 'Earth' | 'Dark' | 'Dragon'
export type WorkKey =
  | 'Kindling' | 'Watering' | 'Planting' | 'GenerateElectricity' | 'Handiwork' | 'Gathering'
  | 'Lumbering' | 'Mining' | 'MedicineProduction' | 'Cooling' | 'Transporting' | 'Farming'

export interface IntentDef {
  id: IntentId
  label: string
  motsClesFR: string[]
  categories: Partial<Record<string, number>>
  statWeights: Partial<Record<StatKey, number>>
  speedWeights?: Partial<Record<SpeedKey, number>>
  elementFilterable: boolean
  workFilterable: boolean
}

// ------------------------------------------------------------------ //
//  Lexique                                                            //
// ------------------------------------------------------------------ //
export const INTENTS: IntentDef[] = [
  {
    id: 'dps', label: 'DPS / Dégâts joueur',
    motsClesFR: ['degats', 'degat', 'dps', 'dommage', 'dommages', 'dmg', 'damage', 'attaque', 'attaquer',
      'attack', 'atk', 'offensif', 'offensive', 'offense', 'agressif', 'agressive', 'faire mal', 'taper',
      'cogner', 'frapper', 'frappe', 'burst', 'nuke', 'one shot', 'oneshot', 'tuer', 'kill', 'carry',
      'puissance', 'puissant', 'force', 'glass cannon', 'combat', 'combattant', 'combattre', 'fight',
      'rush', 'demolir', 'detruire', 'sniper', 'tireur', 'shot', 'arme'],
    categories: { weapon: 1.0, atk: 1.0, element: 0.7, active: 0.8, special: 0.4 },
    statWeights: { meleeAttack: 1.0, shotAttack: 1.0 },
    elementFilterable: true, workFilterable: false,
  },
  {
    id: 'tank', label: 'Tank / Survie',
    motsClesFR: ['tank', 'tanky', 'tanker', 'defense', 'defensif', 'defensive', 'survie', 'survivre',
      'encaisser', 'resister', 'resistance', 'robuste', 'solide', 'tenace', 'costaud', 'blinde', 'endurant',
      'endurance', 'bouclier', 'proteger', 'protection', 'mur', 'gros pv', 'point de vie', 'points de vie',
      'pv', 'vie', 'sante', 'immortel', 'durable', 'aggro', 'resistant', 'regeneration', 'regen', 'soin',
      'soigner', 'heal', 'healer', 'soigneur', 'vol de vie', 'lifesteal'],
    categories: { def: 1.0, heal: 0.9 },
    statWeights: { hp: 1.0, defense: 1.0, stamina: 0.3 },
    elementFilterable: false, workFilterable: false,
  },
  {
    id: 'base', label: 'Base / Production',
    motsClesFR: ['base', 'camp', 'production', 'produire', 'producteur', 'travail', 'travailler',
      'travailleur', 'worker', 'ouvrier', 'metier', 'artisanat', 'artisan', 'craft', 'crafter', 'fabrication',
      'fabriquer', 'atelier', 'usine', 'automatisation', 'afk', 'ferme', 'farm', 'farming', 'recolte',
      'cueillette', 'minage', 'miner', 'mineur', 'bucheron', 'bucheronnage', 'arrosage', 'plantation',
      'electricite', 'generateur', 'refrigeration', 'medecine', 'transport', 'logistique', 'ressources',
      'rendement', 'productivite', 'elevage', 'ranch'],
    categories: { work: 1.0, mining: 1.0, logging: 1.0, farm: 1.0, weight: 0.5 },
    statWeights: {},
    speedWeights: { transport: 0.4 },
    elementFilterable: false, workFilterable: true,
  },
  {
    id: 'mount', label: 'Monture / Mobilité',
    motsClesFR: ['monture', 'montures', 'chevaucher', 'monter', 'mount', 'cheval', 'destrier', 'rider',
      'deplacement', 'vitesse', 'rapide', 'rapidite', 'mobilite', 'mobile', 'explorer', 'exploration',
      'voyager', 'voyage', 'parcourir', 'traverser', 'courir', 'course', 'sprint', 'vol', 'voler', 'volant',
      'planer', 'planeur', 'glider', 'aerien', 'nage', 'nager', 'natation', 'aquatique', 'escalade',
      'escalader', 'grimper', 'falaise', 'saut', 'sauter', 'jump', 'dash'],
    categories: { move: 1.0, swim: 0.9, climb: 0.8, jump: 0.7, rideElement: 0.6, atk: 0.4 },
    statWeights: { stamina: 0.8 },
    speedWeights: { rideSprint: 1.0, run: 0.7, walk: 0.2 },
    elementFilterable: true, workFilterable: false,
  },
  {
    id: 'capture', label: 'Capture',
    motsClesFR: ['capture', 'capturer', 'attraper', 'chopper', 'choper', 'catch', 'sphere', 'balle',
      'attrapeur', 'affaiblir', 'ne pas tuer', 'collectionner', 'collection', 'paldex', 'domestiquer',
      'apprivoiser'],
    categories: { atk: 0.3, special: 0.3 },
    statWeights: { meleeAttack: 0.4, shotAttack: 0.4 },
    elementFilterable: true, workFilterable: false,
  },
  {
    id: 'boss', label: 'Boss / Endgame',
    motsClesFR: ['boss', 'raid', 'raids', 'alpha', 'donjon', 'donjons', 'dungeon', 'tour', 'gardien',
      'syndicat', 'mono cible', 'single target', 'cible unique', 'difficile', 'hardcore', 'tryhard', 'meta',
      'min max', 'top tier', 'op', 'surpuissant', 'broken'],
    categories: { weapon: 1.0, atk: 1.0, element: 0.7, active: 0.8, heal: 0.5, def: 0.5 },
    statWeights: { meleeAttack: 0.9, shotAttack: 0.9, hp: 0.5, defense: 0.5 },
    elementFilterable: true, workFilterable: false,
  },
]

export const INTENT_BY_ID = Object.fromEntries(INTENTS.map((i) => [i.id, i])) as Record<IntentId, IntentDef>

export const ENDGAME_WORDS = ['endgame', 'end game', 'fin de jeu', 'late game', 'lategame', 'post game',
  'haut niveau', 'niveau max', 'niveau eleve', 'niveau 50', 'optimise', 'optimal', 'optimiser', 'optimum',
  'meta', 'min max', 'meilleur', 'best', 'top tier', 'op', 'surpuissant', 'broken', 'tryhard', 'competitif',
  'parfait', 'meilleure equipe']

export const ELEMENT_WORDS: Record<ElementKey, string[]> = {
  Fire: ['feu', 'flamme', 'flammes', 'brulure', 'pyro', 'ardent', 'incendie', 'fire', 'burn'],
  Water: ['eau', 'aqua', 'aquatique', 'hydro', 'ocean', 'mer', 'vague', 'water'],
  Electricity: ['foudre', 'electrique', 'electricite', 'eclair', 'tonnerre', 'volt', 'orage', 'electric', 'thunder'],
  Leaf: ['plante', 'plantes', 'herbe', 'nature', 'vegetal', 'feuille', 'flore', 'grass', 'leaf'],
  Ice: ['glace', 'givre', 'gel', 'cryo', 'neige', 'glacial', 'ice', 'frost'],
  Earth: ['terre', 'sol', 'roche', 'rocher', 'pierre', 'sable', 'ground', 'earth', 'rock'],
  Dark: ['tenebres', 'ombre', 'obscur', 'sombre', 'noir', 'nocturne', 'demon', 'spectre', 'dark', 'shadow'],
  Dragon: ['dragon', 'dragons', 'draconique', 'drake', 'wyvern'],
  Normal: ['neutre', 'non elementaire', 'normal', 'incolore', 'sans type'],
}

export const WORK_WORDS: Record<WorkKey, string[]> = {
  Kindling: ['allumage', 'feu de camp', 'forge', 'forger', 'brasier', 'kindling'],
  Watering: ['arrosage', 'arroser', 'irriguer', 'irrigation', 'watering'],
  Planting: ['plantation', 'planter', 'semer', 'semis', 'graine', 'graines', 'planting'],
  GenerateElectricity: ['generateur', 'centrale', 'dynamo', 'generate electricity'],
  Handiwork: ['artisanat', 'artisan', 'craft', 'crafter', 'fabrication', 'fabriquer', 'etabli', 'bricolage', 'handiwork'],
  Gathering: ['recolte', 'cueillette', 'cueillir', 'ramasser', 'collecter', 'gathering'],
  Lumbering: ['bucheronnage', 'bucheron', 'abattre', 'rondin', 'lumbering'],
  Mining: ['minage', 'miner', 'mine', 'mineur', 'mineurs', 'pioche', 'minerai', 'extraction', 'mining'],
  MedicineProduction: ['medecine', 'medicament', 'pommade', 'remede', 'pharmacie', 'medicine'],
  Cooling: ['refrigeration', 'frigo', 'glaciere', 'refroidir', 'cooling'],
  Transporting: ['transport', 'transporter', 'porteur', 'livrer', 'coursier', 'logistique', 'transporting'],
  Farming: ['ferme', 'elevage', 'elever', 'ranch', 'paturage', 'farming'],
}

export const ELEMENT_LABEL: Record<ElementKey, string> = {
  Normal: 'Neutre', Fire: 'Feu', Water: 'Eau', Leaf: 'Plante', Electricity: 'Foudre',
  Ice: 'Glace', Earth: 'Terre', Dark: 'Ténèbres', Dragon: 'Dragon',
}

// ------------------------------------------------------------------ //
//  Normalisation + matching par frontière de mot (P1-5)               //
// ------------------------------------------------------------------ //
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordRe(kw: string): RegExp {
  return new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
}

// Regex pré-compilées (au chargement du module)
const COMPILED_INTENTS = INTENTS.map((it) => ({ id: it.id, re: it.motsClesFR.map((k) => wordRe(normalize(k))) }))
const ELEMENT_RE = (Object.entries(ELEMENT_WORDS) as [ElementKey, string[]][]).map(
  ([el, ws]) => [el, ws.map((w) => wordRe(normalize(w)))] as const,
)
const WORK_RE = (Object.entries(WORK_WORDS) as [WorkKey, string[]][]).map(
  ([wk, ws]) => [wk, ws.map((w) => wordRe(normalize(w)))] as const,
)
const ENDGAME_RE = ENDGAME_WORDS.map((w) => wordRe(normalize(w)))
const NEG_TRIGGERS = ['sans', 'aucun', 'aucune', 'non', 'ni', 'pas', 'eviter', 'evite', 'exclure', 'exclu', 'no']

// Index des noms de Pals (FR + EN), du plus long au plus court pour matcher
// les variantes multi-mots ("Frostallion Noct") avant le nom de base.
const NAME_ENTRIES = (() => {
  const seen = new Set<string>()
  const arr: { key: string; n: string }[] = []
  for (const p of pals) {
    for (const raw of [p.name, p.nameEn]) {
      const n = normalize(raw)
      if (n.length < 3) continue
      const id = `${p.key}|${n}`
      if (seen.has(id)) continue
      seen.add(id)
      arr.push({ key: p.key, n })
    }
  }
  return arr.sort((a, b) => b.n.length - a.n.length)
})()

/** Pals explicitement nommés dans la demande → à imposer dans l'équipe (max 5). */
export function detectRequiredPals(text: string): string[] {
  let scan = ` ${normalize(text)} `
  const found: string[] = []
  for (const { key, n } of NAME_ENTRIES) {
    if (found.includes(key)) continue
    const re = wordRe(n)
    if (re.test(scan)) {
      found.push(key)
      scan = scan.replace(re, ' '.repeat(n.length)) // neutralise la zone (évite de re-matcher un nom plus court dedans)
      if (found.length >= 5) break
    }
  }
  return found
}

// ------------------------------------------------------------------ //
//  Parser                                                             //
// ------------------------------------------------------------------ //
export interface ParsedPrompt {
  intents: IntentId[]
  primary: IntentId
  element: ElementKey | null
  work: WorkKey | null
  endgame: boolean
  matched: boolean // au moins une intention/élément/métier/Pal reconnu
  requiredKeys: string[] // Pals nommés à imposer dans l'équipe
  negated: { intents: IntentId[]; categories: string[] }
  raw: string
}

export function parsePrompt(text: string): ParsedPrompt {
  const t = normalize(text)
  const tokens = t.split(' ').filter(Boolean)

  // Fenêtres de négation : les 4 tokens suivant un déclencheur ("sans defense")
  const negWindows: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (NEG_TRIGGERS.includes(tokens[i])) negWindows.push(tokens.slice(i + 1, i + 5).join(' '))
  }
  const negIntents = new Set<IntentId>()
  const negElement = new Set<ElementKey>()
  const negWork = new Set<WorkKey>()
  for (const w of negWindows) {
    for (const it of COMPILED_INTENTS) if (it.re.some((re) => re.test(w))) negIntents.add(it.id)
    for (const [el, res] of ELEMENT_RE) if (res.some((re) => re.test(w))) negElement.add(el)
    for (const [wk, res] of WORK_RE) if (res.some((re) => re.test(w))) negWork.add(wk)
  }

  // Score de chaque intention (nb de mots-clés touchés), hors intentions niées
  const scoreByIntent: Record<string, number> = {}
  for (const it of COMPILED_INTENTS) {
    if (negIntents.has(it.id)) continue
    let sc = 0
    for (const re of it.re) if (re.test(t)) sc++
    if (sc > 0) scoreByIntent[it.id] = sc
  }
  let intents = (Object.keys(scoreByIntent) as IntentId[])
    .sort((a, b) => scoreByIntent[b] - scoreByIntent[a])
    .slice(0, 2) // cap 2 intentions (P1-6)

  // Élément / métier nommés (hors négation)
  let element: ElementKey | null = null
  for (const [el, res] of ELEMENT_RE) {
    if (negElement.has(el)) continue
    if (res.some((re) => re.test(t))) { element = el; break }
  }
  let work: WorkKey | null = null
  for (const [wk, res] of WORK_RE) {
    if (negWork.has(wk)) continue
    if (res.some((re) => re.test(t))) { work = wk; break }
  }

  // Un métier nommé ⇒ intention "base" ; un élément seul ⇒ "dps"
  if (work && !intents.includes('base')) intents = (['base', ...intents] as IntentId[]).slice(0, 2)
  if (element && intents.length === 0 && !negIntents.has('dps')) intents = ['dps']

  // Pals nommés explicitement (imposés) — retirés du texte pour la détection d'intentions ? Non :
  // un nom de Pal ne perturbe pas les mots-clés d'intention (noms propres distincts).
  const requiredKeys = detectRequiredPals(text)

  const endgame = ENDGAME_RE.some((re) => re.test(t))
  const matched = intents.length > 0 || element != null || work != null || requiredKeys.length > 0

  // Fallback si rien de reconnu (respecte la négation)
  if (intents.length === 0) {
    const order: IntentId[] = ['dps', 'boss', 'tank', 'mount', 'base', 'capture']
    intents = [order.find((id) => !negIntents.has(id)) ?? 'dps']
  }

  const negCategories = new Set<string>()
  for (const id of negIntents) for (const c of Object.keys(INTENT_BY_ID[id].categories)) negCategories.add(c)

  return {
    intents,
    primary: intents[0],
    element,
    work,
    endgame,
    matched,
    requiredKeys,
    negated: { intents: [...negIntents], categories: [...negCategories] },
    raw: text,
  }
}

// ------------------------------------------------------------------ //
//  Scoring                                                            //
// ------------------------------------------------------------------ //
const STAT_MAX: Record<StatKey, number> = {
  hp: 180, meleeAttack: 150, shotAttack: 150, defense: 200, stamina: 410, food: 9,
}
const SPEED_MAX: Record<SpeedKey, number> = { walk: 3000, run: 3000, rideSprint: 3300, transport: 3000 }
const RARITY_WEIGHT: Record<string, number> = { common: 1.0, rare: 1.15, epic: 1.4, legendary: 1.7 }

export interface ScoreBreakdown {
  total: number
  skill: number
  stats: number
  element: number
  work: number
  rarity: number
  reasons: string[]
}

export function scorePal(pal: Pal, parsed: ParsedPrompt, stars: number): ScoreBreakdown {
  const reasons: string[] = []
  const skF = starSkillFactor(stars)
  const stF = starStatFactor(stars)

  // Poids fusionnés entre intentions actives — MAX, pas somme (évite le double comptage, P0-4)
  const catW: Record<string, number> = {}
  const statW: Partial<Record<StatKey, number>> = {}
  const speedW: Partial<Record<SpeedKey, number>> = {}
  for (const id of parsed.intents) {
    const def = INTENT_BY_ID[id]
    for (const [c, w] of Object.entries(def.categories)) catW[c] = Math.max(catW[c] ?? 0, w as number)
    for (const [k, w] of Object.entries(def.statWeights)) {
      const key = k as StatKey
      statW[key] = Math.max(statW[key] ?? 0, w as number)
    }
    for (const [k, w] of Object.entries(def.speedWeights ?? {})) {
      const key = k as SpeedKey
      speedW[key] = Math.max(speedW[key] ?? 0, w as number)
    }
  }

  // (A) Partner skill : catégories pertinentes × facteur d'étoiles
  let skill = 0
  const eff = pal.partnerSkill?.effects ?? []
  if (pal.partnerSkill && eff.length > 0) {
    const cats = skillCategories(pal.partnerSkill)
    for (const cat of cats) {
      if (cat.id === 'other') continue
      const w = catW[cat.id]
      if (w) { skill += w; reasons.push(cat.label) }
    }
    for (const c of parsed.negated.categories) if (cats.some((cat) => cat.id === c)) skill -= 1.2
    skill *= skF
  }

  // (B) Stats pondérées (moyenne normalisée) × facteur d'étoiles doux
  let stats = 0
  let wSum = 0
  for (const [k, w] of Object.entries(statW)) {
    stats += (pal.stats[k as StatKey] / STAT_MAX[k as StatKey]) * (w as number)
    wSum += w as number
  }
  for (const [k, w] of Object.entries(speedW)) {
    stats += (pal.speeds[k as SpeedKey] / SPEED_MAX[k as SpeedKey]) * (w as number)
    wSum += w as number
  }
  if (wSum > 0) stats /= wSum
  stats *= stF

  // Base/production : craftSpeed inutilisable → proxy totalWork (si aucun métier précis nommé)
  if (!parsed.work && parsed.intents.includes('base')) {
    const tw = Math.min(1, totalWork(pal) / 20) * stF
    if (tw > stats) { stats = tw; if (tw > 0.3) reasons.push('bon travailleur') }
  }

  // (C) Élément (le pool est déjà pré-filtré dans buildTeam ; bonus de confirmation)
  let element = 0
  if (parsed.element) {
    if (pal.elements.includes(parsed.element)) { element = 0.6; reasons.push(`élément ${ELEMENT_LABEL[parsed.element]}`) }
    else element = -0.8
  }

  // (D) Métier nommé : signal dominant
  let work = 0
  if (parsed.work) {
    const lvl = pal.work[parsed.work] ?? 0
    if (lvl > 0) { work = 0.5 + Math.min(1.0, lvl / 5); reasons.push(`${workLabels[parsed.work] ?? parsed.work} niv.${lvl}`) }
    else work = -1.0
  }

  // (E) Capture : pénalise le burst extrême (on veut affaiblir, pas tuer)
  if (parsed.primary === 'capture') {
    const burst = (pal.stats.meleeAttack + pal.stats.shotAttack) / (2 * 150)
    if (burst > 0.85) { stats -= 0.3; reasons.push('dégâts un peu élevés pour capturer') }
  }

  // (F) Composition + multiplicateur de rareté (endgame ou boss)
  let base = skill * 1.6 + stats * 1.2 + element + work
  let rarity = 1
  const tier = rarityTier(pal.rarity)
  if (parsed.endgame || parsed.intents.includes('boss')) {
    rarity = RARITY_WEIGHT[tier]
    if (pal.guaranteedPassives.some((p) => /ElementBoost|Legend|EternalFlame|Nushi|Salvation/i.test(p) && !/_down/i.test(p))) base += 0.3
    if (tier === 'legendary' || tier === 'epic') reasons.push(`rareté ${RARITY_LABEL[tier]}`)
  }

  const total = Math.max(0, base) * rarity
  return { total, skill, stats, element, work, rarity, reasons: [...new Set(reasons)].slice(0, 4) }
}

// ------------------------------------------------------------------ //
//  Assemblage (glouton + pénalité de redondance non-cumulable)        //
// ------------------------------------------------------------------ //
export interface Candidate {
  pal: Pal
  stars: number
}

export interface BuildResult {
  team: Pal[]
  reasons: string[]
  perPal: { pal: Pal; stars: number; why: string[]; locked: boolean }[]
  poolSize: number // nb de candidats pertinents (pour signaler une équipe incomplète)
}

export function buildTeam(candidates: Candidate[], parsed: ParsedPrompt, size = 5): BuildResult {
  const starByKey = new Map(candidates.map((c) => [c.pal.key, c.stars]))
  const usedNoStack = new Set<string>()
  const catCount: Record<string, number> = {}
  const lockedKeys = new Set<string>()
  const picked: (Candidate & { s: ScoreBreakdown; locked: boolean })[] = []

  // Enregistre les catégories d'un Pal choisi (pour la gestion des cumuls)
  const register = (pal: Pal) => {
    const sk = pal.partnerSkill
    if (sk && (sk.effects?.length ?? 0) > 0) {
      if (sk.noStack) usedNoStack.add(sk.title)
      for (const cat of skillCategories(sk)) if (cat.id !== 'other') catCount[cat.id] = (catCount[cat.id] ?? 0) + 1
    }
  }

  // 1) Pals IMPOSÉS (nommés dans la demande) : inclus quoi qu'il arrive, ils
  //    court-circuitent les filtres élément/métier.
  for (const key of parsed.requiredKeys.slice(0, size)) {
    const pal = palByKey.get(key)
    if (!pal || lockedKeys.has(key)) continue
    const stars = starByKey.get(key) ?? 0
    picked.push({ pal, stars, s: scorePal(pal, parsed, stars), locked: true })
    lockedKeys.add(key)
    register(pal)
  }

  // 2) Pool de complétion : filtres DURS (P0-3), hors Pals déjà imposés
  let pool = candidates.filter((c) => !lockedKeys.has(c.pal.key))
  if (parsed.element) pool = pool.filter((c) => c.pal.elements.includes(parsed.element!))
  if (parsed.work) pool = pool.filter((c) => (c.pal.work[parsed.work!] ?? 0) > 0)

  const scored = pool
    .map((c) => ({ ...c, s: scorePal(c.pal, parsed, c.stars) }))
    .filter((c) => c.s.total > 0)
    .sort((a, b) => b.s.total - a.s.total)

  // 3) Complétion gloutonne (compteurs de cumul déjà amorcés par les imposés)
  while (picked.length < size && scored.length) {
    let best = -Infinity
    let bestIdx = -1
    for (let i = 0; i < scored.length; i++) {
      const c = scored[i]
      let adj = c.s.total
      const sk = c.pal.partnerSkill
      const hasEff = sk && (sk.effects?.length ?? 0) > 0
      if (sk && hasEff) {
        const cats = skillCategories(sk)
        if (sk.noStack && usedNoStack.has(sk.title)) adj -= 1000 // même skill non-cumulable déjà pris
        for (const cat of cats) {
          if (cat.id === 'other') continue
          const already = catCount[cat.id] ?? 0
          if (already > 0) adj -= cat.stacks ? already * 0.15 : already * 0.9
        }
        const newCats = cats.filter((cat) => cat.id !== 'other' && !(catCount[cat.id] > 0))
        adj += Math.min(0.3, newCats.length * 0.1) // diversité utile
      }
      if (adj > best) { best = adj; bestIdx = i }
    }
    if (bestIdx < 0) break
    if (best <= 0 && picked.length > lockedKeys.size) break // ne pas compléter avec du bruit
    const chosen = scored.splice(bestIdx, 1)[0]
    picked.push({ ...chosen, locked: false })
    register(chosen.pal)
  }

  return {
    team: picked.map((p) => p.pal),
    reasons: summarize(parsed, picked),
    perPal: picked.map((p) => ({ pal: p.pal, stars: p.stars, why: p.s.reasons, locked: p.locked })),
    poolSize: scored.length + picked.length,
  }
}

function summarize(parsed: ParsedPrompt, picked: { pal: Pal }[]): string[] {
  const out: string[] = []
  if (parsed.requiredKeys.length) {
    const names = parsed.requiredKeys.map((k) => palByKey.get(k)?.name).filter(Boolean)
    if (names.length) out.push(`Imposé${names.length > 1 ? 's' : ''} par ta demande : ${names.join(', ')}.`)
  }
  if (!parsed.matched) {
    out.push('Aucune intention claire détectée dans ta demande → équipe offensive par défaut.')
  } else {
    const parts = parsed.intents.map((id) => INTENT_BY_ID[id].label)
    let line = `Objectif : ${parts.join(' + ')}`
    if (parsed.element) line += ` · élément ${ELEMENT_LABEL[parsed.element]}`
    if (parsed.work) line += ` · ${workLabels[parsed.work] ?? parsed.work}`
    if (parsed.endgame) line += ' · endgame (rareté priorisée)'
    out.push(line + '.')
  }
  if (parsed.negated.intents.length) {
    out.push(`Exclu : ${parsed.negated.intents.map((id) => INTENT_BY_ID[id].label).join(', ')}.`)
  }
  if (picked.length < 5) {
    out.push(`Seulement ${picked.length} Pal(s) correspondent vraiment — le pool est trop restreint pour compléter sans hors-sujet.`)
  }
  return out
}
