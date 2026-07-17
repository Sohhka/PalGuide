// Télécharge toutes les images référencées (Pals, éléments, travail, drops,
// partner skills) depuis le CDN paldb.cc vers public/img/, et réécrit les URLs
// dans src/data/*.json en chemins LOCAUX relatifs -> application hors-ligne.
//
// Pipeline complet après un patch :
//   npm run scrape-paldb && npm run build-data && npm run download-assets
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'src', 'data')
const IMG = join(ROOT, 'public', 'img')

const isRemote = (u) => typeof u === 'string' && /^https?:\/\//.test(u)
const basename = (u) => decodeURIComponent(u.split('?')[0].split('/').pop() || '')

const tasks = new Map() // localPath -> remoteUrl
function plan(remoteUrl, sub, name) {
  if (!isRemote(remoteUrl)) return remoteUrl // déjà local
  const local = `img/${sub}/${name}`
  tasks.set(local, remoteUrl)
  return local
}

// ---- pals.json ----
const pals = JSON.parse(readFileSync(join(DATA, 'pals.json'), 'utf-8'))
for (const p of pals) {
  if (isRemote(p.iconUrl)) p.iconUrl = plan(p.iconUrl, 'pals', `${p.key}.webp`)
  if (p.partnerSkill?.iconUrl && isRemote(p.partnerSkill.iconUrl))
    p.partnerSkill.iconUrl = plan(p.partnerSkill.iconUrl, 'skills', basename(p.partnerSkill.iconUrl))
  for (const d of p.drops || []) {
    if (isRemote(d.iconUrl)) d.iconUrl = plan(d.iconUrl, 'items', basename(d.iconUrl))
  }
}

// ---- elements.json ----
const elements = JSON.parse(readFileSync(join(DATA, 'elements.json'), 'utf-8'))
for (const e of elements) {
  if (isRemote(e.iconUrl)) e.iconUrl = plan(e.iconUrl, 'elements', `${e.key}.webp`)
}

// ---- work.json ----
const work = JSON.parse(readFileSync(join(DATA, 'work.json'), 'utf-8'))
for (const k of Object.keys(work.icons || {})) {
  if (isRemote(work.icons[k])) work.icons[k] = plan(work.icons[k], 'work', `${k}.webp`)
}

console.log(`${tasks.size} image(s) à télécharger vers public/img/`)

// ---- Téléchargement ----
for (const sub of ['pals', 'elements', 'work', 'items', 'skills']) mkdirSync(join(IMG, sub), { recursive: true })

const entries = [...tasks.entries()]
let ok = 0
let skip = 0
const failed = []
let i = 0
async function worker() {
  while (i < entries.length) {
    const [local, url] = entries[i++]
    const dest = join(ROOT, 'public', local)
    if (existsSync(dest)) { skip++; continue }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (PalGuide asset build)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(dest, buf)
      ok++
      if (ok % 50 === 0) process.stdout.write(`  … ${ok} téléchargées\n`)
    } catch (e) {
      failed.push({ url, reason: String(e.message || e) })
    }
  }
}
await Promise.all(Array.from({ length: 12 }, worker))

// ---- Réécriture des JSON avec chemins locaux ----
writeFileSync(join(DATA, 'pals.json'), JSON.stringify(pals))
writeFileSync(join(DATA, 'elements.json'), JSON.stringify(elements))
writeFileSync(join(DATA, 'work.json'), JSON.stringify(work))

console.log(`\n✔ ${ok} téléchargées, ${skip} déjà présentes, ${failed.length} échec(s).`)
console.log('  URLs réécrites en local dans src/data/{pals,elements,work}.json')
if (failed.length) for (const f of failed.slice(0, 15)) console.log(`   ✗ ${f.url} — ${f.reason}`)
