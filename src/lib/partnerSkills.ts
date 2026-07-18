import type { Pal, PartnerSkill } from './types'

// ------------------------------------------------------------------ //
//  Catégorisation des partner skills + analyse de cumul pour l'équipe //
// ------------------------------------------------------------------ //

export interface EffectCategory {
  id: string
  label: string
  /** true = ce type de bonus se cumule additivement entre Pals différents */
  stacks: boolean
}

const CATEGORIES: { test: RegExp; cat: EffectCategory }[] = [
  { test: /DamageUpWeapon|ShotAttack_PartnerSkill|Weapon/i, cat: { id: 'weapon', label: "Dégâts d'arme du joueur", stacks: true } },
  { test: /TrainerATK_UP|GiveElement_TrainerATK|AttackUp_.*Partner|TrainerAttack/i, cat: { id: 'atk', label: 'Attaque du joueur / monture', stacks: true } },
  { test: /TrainerDEF_UP|DefenseUp|Defense_.*Partner|DashDefence/i, cat: { id: 'def', label: 'Défense du joueur', stacks: true } },
  { test: /ElementBoost|AttackUp_(Fire|Water|Leaf|Electricity|Ice|Earth|Dark|Dragon|Normal)/i, cat: { id: 'element', label: "Boost de dégâts d'élément", stacks: true } },
  { test: /GiveA(Fire|Water|Leaf|Electricity|Ice|Earth|Dark|Dragon|Ice)_Ride|GiveElement/i, cat: { id: 'rideElement', label: "Élément ajouté en monture", stacks: false } },
  { test: /SwimSpeed/i, cat: { id: 'swim', label: 'Vitesse de nage', stacks: true } },
  { test: /ClimbSpeed/i, cat: { id: 'climb', label: "Vitesse d'escalade", stacks: true } },
  { test: /JumpPower/i, cat: { id: 'jump', label: 'Hauteur de saut', stacks: true } },
  { test: /MoveSpeed|DashSpeed/i, cat: { id: 'move', label: 'Vitesse de déplacement', stacks: true } },
  { test: /Mining/i, cat: { id: 'mining', label: 'Minage', stacks: true } },
  { test: /Logging|Deforest/i, cat: { id: 'logging', label: 'Bûcheronnage', stacks: true } },
  { test: /Farm|Crop|Harvest|Plant/i, cat: { id: 'farm', label: 'Ferme / récolte', stacks: true } },
  { test: /WorkSuitability|Handiwork|Gather/i, cat: { id: 'work', label: 'Travail', stacks: true } },
  { test: /ItemWeightReduction|MaxInventoryWeight|Weight/i, cat: { id: 'weight', label: 'Poids / inventaire', stacks: true } },
  { test: /LifeSteal|RecoverHP|Heal/i, cat: { id: 'heal', label: 'Soin / vol de vie', stacks: true } },
  { test: /Homing|Mutant/i, cat: { id: 'special', label: 'Effet spécial', stacks: false } },
  { test: /ActiveSkillMainValueByRank/i, cat: { id: 'active', label: 'Puissance de la compétence active', stacks: false } },
]

const OTHER: EffectCategory = { id: 'other', label: 'Effet de partenaire', stacks: false }

export function categorizeEffect(effectKey: string): EffectCategory {
  for (const { test, cat } of CATEGORIES) if (test.test(effectKey)) return cat
  return OTHER
}

/** Catégories couvertes par un partner skill (via ses effets, sinon "autre"). */
export function skillCategories(skill: PartnerSkill): EffectCategory[] {
  const seen = new Map<string, EffectCategory>()
  for (const e of skill.effects) {
    const c = categorizeEffect(e.key)
    if (!seen.has(c.id)) seen.set(c.id, c)
  }
  if (!seen.size) seen.set(OTHER.id, OTHER)
  return [...seen.values()]
}

export interface TeamEntry {
  pal: Pal
  skill: PartnerSkill
  categories: EffectCategory[]
}

export interface TeamGroup {
  category: EffectCategory
  entries: TeamEntry[]
  /** true si au moins deux sources différentes se cumulent */
  stacked: boolean
  note: string
}

export interface TeamAnalysis {
  entries: TeamEntry[]
  groups: TeamGroup[]
  duplicateWarnings: string[]
  /** total des aptitudes de travail de l'équipe */
  workTotals: Record<string, number>
  /** couverture des éléments (attaque) */
  elementCoverage: string[]
}

export function analyzeTeam(team: (Pal | null)[]): TeamAnalysis {
  const members = team.filter((p): p is Pal => !!p)
  const entries: TeamEntry[] = members
    .filter((p) => p.partnerSkill)
    .map((p) => ({ pal: p, skill: p.partnerSkill!, categories: skillCategories(p.partnerSkill!) }))

  // Groupes par catégorie
  const byCat = new Map<string, TeamEntry[]>()
  for (const e of entries) {
    for (const c of e.categories) {
      if (!byCat.has(c.id)) byCat.set(c.id, [])
      byCat.get(c.id)!.push(e)
    }
  }

  const groups: TeamGroup[] = []
  for (const [, list] of byCat) {
    const cat = list[0].categories.find((c) => byCat.get(c.id) === list) || list[0].categories[0]
    const distinctTitles = new Set(list.map((e) => e.skill.title))
    let stacked = false
    let note = ''
    if (list.length >= 2) {
      if (cat.stacks && distinctTitles.size >= 2) {
        stacked = true
        note = `${list.length} Pals renforcent « ${cat.label} » → les bonus se cumulent.`
      } else if (!cat.stacks && distinctTitles.size >= 2) {
        note = `Plusieurs Pals affectent « ${cat.label} », mais ce type d'effet ne se cumule généralement pas — un seul s'applique.`
      }
    }
    groups.push({ category: cat, entries: list, stacked, note })
  }
  groups.sort((a, b) => b.entries.length - a.entries.length || a.category.label.localeCompare(b.category.label))

  // Doublons de partner skill (même compétence sur plusieurs Pals)
  const duplicateWarnings: string[] = []
  const titleCount = new Map<string, TeamEntry[]>()
  for (const e of entries) {
    if (!titleCount.has(e.skill.title)) titleCount.set(e.skill.title, [])
    titleCount.get(e.skill.title)!.push(e)
  }
  for (const [title, list] of titleCount) {
    if (list.length >= 2 && list[0].skill.noStack) {
      duplicateWarnings.push(
        `« ${title} » est présent ${list.length}× (${list.map((e) => e.pal.name).join(', ')}) mais ne se cumule pas — un seul exemplaire est utile.`,
      )
    }
  }

  // Totaux de travail de l'équipe
  const workTotals: Record<string, number> = {}
  for (const p of members) {
    for (const [k, v] of Object.entries(p.work)) {
      workTotals[k] = (workTotals[k] || 0) + v
    }
  }

  // Couverture des éléments
  const elementCoverage = [...new Set(members.flatMap((p) => p.elements))]

  return { entries, groups, duplicateWarnings, workTotals, elementCoverage }
}
