// Parseur d'une page Pal de paldb.cc (locale /fr).
// On n'extrait QUE ce qui manque à PalCalc : élément, capture, melee/shot,
// genus, drops, partner skill (FR + effets), niveaux/portée des skills, description.
import * as cheerio from 'cheerio'

const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const num = (s) => {
  if (s == null) return null
  const m = String(s).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

// paldb -> nom interne d'élément PalCalc (Normal/Fire/Water/Leaf/Electricity/Ice/Earth/Dark/Dragon)
const ELEMENT_MAP = {
  Normal: 'Normal', Neutral: 'Normal', None: 'Normal',
  Fire: 'Fire',
  Water: 'Water',
  Leaf: 'Leaf', Grass: 'Leaf',
  Electric: 'Electricity', Electricity: 'Electricity',
  Ice: 'Ice',
  Earth: 'Earth', Ground: 'Earth',
  Dark: 'Dark',
  Dragon: 'Dragon',
}
const mapElement = (v) => {
  const k = clean(v)
  if (!k) return null
  return ELEMENT_MAP[k] || k
}

// Décode data-hover "?s=Waza%2FEPalWazaID%3A%3APoisonFog" -> "PoisonFog"
function wazaInternal(dataHover) {
  if (!dataHover) return null
  try {
    const dec = decodeURIComponent(dataHover)
    const m = dec.match(/EPalWazaID::([A-Za-z0-9_]+)/)
    if (m) return m[1]
  } catch {
    /* ignore */
  }
  return null
}

// Décode data-hover "?s=Items%2FLeather" -> "Leather"
function itemInternal(hrefOrHover) {
  if (!hrefOrHover) return null
  try {
    const dec = decodeURIComponent(hrefOrHover)
    const m = dec.match(/Items\/([A-Za-z0-9_]+)/)
    if (m) return m[1]
  } catch {
    /* ignore */
  }
  return null
}

// Parse les lignes clé/valeur d'une card (.d-flex.justify-content-between > div,div)
function cardKV($, cardEl) {
  const kv = {}
  $(cardEl)
    .find('.d-flex.justify-content-between')
    .each((_, row) => {
      const kids = $(row).children('div')
      if (kids.length >= 2) {
        const k = clean($(kids[0]).text())
        const v = clean($(kids[1]).text())
        if (k && !(k in kv)) kv[k] = v
      }
    })
  return kv
}

function findCardByTitle($, matcher) {
  let found = null
  $('.card').each((_, el) => {
    if (found) return
    const title = clean($(el).find('.card-title').first().text())
    if (matcher(title)) found = el
  })
  return found
}

export function parsePalPage(html) {
  const $ = cheerio.load(html)
  const rec = {
    element1: null,
    element2: null,
    captureRateCorrect: null,
    meleeAttack: null,
    shotAttack: null,
    genus: null,
    predator: false,
    nocturnal: false,
    description: null,
    partnerSkill: null,
    activeSkills: [],
    drops: [],
    passives: [],
    iconUrl: null,
  }

  // --- Icône du Pal (gère les sous-dossiers, ex. /Yakushima/) ---
  $('img').each((_, el) => {
    if (rec.iconUrl) return
    const src = $(el).attr('src') || ''
    if (/\/PalIcon\/Normal\/.*_icon_normal\.webp/.test(src)) rec.iconUrl = src
  })

  // --- Cards clé/valeur (Stats, Others, Movement) ---
  const kv = {}
  for (const title of ['Stats', 'Others', 'Movement', 'Statistiques', 'Autres']) {
    const card = findCardByTitle($, (t) => t.toLowerCase() === title.toLowerCase())
    if (card) Object.assign(kv, cardKV($, card))
  }

  rec.element1 = mapElement(kv['ElementType1'])
  rec.element2 = mapElement(kv['ElementType2'])
  rec.captureRateCorrect = num(kv['CaptureRateCorrect'])
  rec.meleeAttack = num(kv['MeleeAttack'])
  rec.shotAttack = num(kv['Attaque'] ?? kv['ShotAttack'] ?? kv['Shot Attack'])
  rec.genus = kv['GenusCategory'] || null
  rec.predator = kv['Predator'] === '1'
  rec.nocturnal = kv['Nocturnal'] === '1'

  // --- Description (card Summary) ---
  const sumCard = findCardByTitle($, (t) => /^(summary|résumé|resume)$/i.test(t))
  if (sumCard) {
    let txt = clean($(sumCard).find('.card-body').text())
    txt = txt.replace(/^\s*(summary|résumé|resume)\s*/i, '')
    rec.description = txt || null
  }

  // --- Partner Skill ---
  const psCard = findCardByTitle($, (t) => /partner skill|compétence de partenaire/i.test(t))
  if (psCard) {
    const $ps = $(psCard)
    const rawTitle = clean($ps.find('.card-title').first().text())
    const title = rawTitle.replace(/^.*?:\s*/, '') || null
    const descEl = $ps.find('.flex-grow-1').first()
    // le bloc technologie/objet de déblocage est un <div> imbriqué -> on l'enlève
    const descClone = descEl.clone()
    descClone.find('div').remove()
    const description = clean(descClone.text())
    const iconUrl = $ps.find('img.rounded-circle').first().attr('src') || null
    // effets structurés : dernière ligne (rang max) du tableau level/value
    const effects = []
    const rows = $ps.find('table tbody tr')
    const lastRow = rows.last()
    lastRow.find('td').last().find('div').each((_, d) => {
      const t = clean($(d).text())
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*?)\s+(-?\d+(?:\.\d+)?)$/)
      if (m) {
        const key = m[1].replace(/_\d+$/, '') // retire suffixe de rang _1.._5
        effects.push({ key, value: Number(m[2]) })
      }
    })
    // nombre de rangs
    const maxRank = rows.length || null
    // indice de non-cumul (texte FR/EN)
    const noStack = /non\s*cumulable|ne\s*(se\s*)?cumul|does not stack|non-?stack/i.test(description)
    // techno de déblocage
    let unlockTech = null
    $ps.find('span.border').each((_, s) => {
      const n = num($(s).text())
      if (n != null && unlockTech == null) unlockTech = n
    })
    rec.partnerSkill = { title, description, iconUrl, effects, maxRank, noStack, unlockTech }
  }

  // --- Active Skills ---
  $('.activeSkill').each((_, el) => {
    const $el = $(el)
    const head = clean($el.find('.itemHead').first().text())
    const level = num((head.match(/Lv\.?\s*(\d+)/) || [])[1])
    const nameLink = $el.find('a[data-hover*="Waza"]').first()
    const internalId = wazaInternal(nameLink.attr('data-hover'))
    const frName = clean(nameLink.text()) || null
    // élément via classe element_color_0X
    let elementIndex = null
    const cls = nameLink.attr('class') || ''
    const em = cls.match(/element_color_(\d+)/)
    if (em) elementIndex = Number(em[1])
    // portée via tooltip fa-wand-sparkles / fa-hand-fist
    let rangeMin = null
    let rangeMax = null
    $el.find('[data-bs-title]').each((_, ic) => {
      const t = $(ic).attr('data-bs-title') || ''
      const rm = t.match(/Range\s*(\d+)\s*[–-]\s*(\d+)/i)
      if (rm) {
        rangeMin = Number(rm[1])
        rangeMax = Number(rm[2])
      }
    })
    // cooldown / power (fallback ; PalCalc est prioritaire au merge)
    let cooldown = null
    let power = null
    $el.find('img[data-bs-title="CoolTime"]').each((_, ic) => {
      const sib = $(ic).parent().find('span').first()
      cooldown = num(sib.text())
    })
    $el.find('div').each((_, d) => {
      const t = clean($(d).text())
      if (/^Force\s*:/.test(t) || /^Power\s*:/.test(t)) {
        power = num(t)
      }
    })
    const hasSkillFruit = $el.find('a[href*="Skill_Fruit"], img[src*="SkillCard"]').length > 0
    const description = clean($el.find('> .card-body, .card-body').last().text()) || null
    if (level != null || internalId) {
      rec.activeSkills.push({
        level,
        internalId,
        frName,
        elementIndex,
        rangeMin,
        rangeMax,
        cooldown,
        power,
        hasSkillFruit,
        description,
      })
    }
  })

  // --- Drops ---
  const dropCard = findCardByTitle($, (t) => /possible drops|butin|drops/i.test(t))
  if (dropCard) {
    const seen = new Set()
    $(dropCard)
      .find('tbody tr')
      .each((_, tr) => {
        const $tr = $(tr)
        const link = $tr.find('a.itemname').first()
        if (!link.length) return
        const name = clean(link.clone().children().remove().end().text()) || clean(link.text())
        const iconUrl = link.find('img').attr('src') || null
        const internal = itemInternal(link.attr('href')) || itemInternal(link.attr('data-hover'))
        const quantity = clean($tr.find('.itemQuantity').first().text()) || null
        const tds = $tr.find('td')
        let rate = clean($(tds[tds.length - 1]).text()) || null
        // Palier de niveau (drops de boss/alpha) : "Lv.70 100%" -> levelGate=70
        let levelGate = null
        if (rate) {
          const lg = rate.match(/Lv\.?\s*(\d+)/i)
          if (lg) {
            levelGate = Number(lg[1])
            rate = clean(rate.replace(/Lv\.?\s*\d+/i, ''))
          }
        }
        const key = `${internal}|${quantity}|${rate}|${levelGate}`
        if (seen.has(key)) return
        seen.add(key)
        rec.drops.push({ internal, name, iconUrl, quantity, rate, levelGate })
      })
  }

  // --- Passive Skills (optionnel) ---
  const passCard = findCardByTitle($, (t) => /passive skills|caractéristiques|passifs/i.test(t))
  if (passCard) {
    $(passCard)
      .find('a')
      .each((_, a) => {
        const name = clean($(a).text())
        if (name) rec.passives.push({ name })
      })
  }

  return rec
}

export { clean, num, mapElement }
