// Écriture d'une sauvegarde Palworld (éditeur).
//  - Backup auto horodaté de l'original AVANT toute écriture.
//  - Décompression (Node) -> édition (Python palsav) -> recompression PlZ (Node) -> écriture.
//  - edit_save.py relit et vérifie chaque changement ; on n'écrit la save que si verified=true.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { spawn } = require('node:child_process')
const { decompressSav } = require('./save-import.cjs')

// GVAS -> .sav PlZ (miroir de decompressSav). type 0x31 = zlib simple, 0x32 = double.
// cl = longueur de la 1re compression (comme palsav.compress_gvas_to_sav).
function compressSav(gvas, saveType = 0x31) {
  let compressed = zlib.deflateSync(gvas)
  const compressedLen = compressed.length
  if (saveType === 0x32) compressed = zlib.deflateSync(compressed)
  const head = Buffer.alloc(12)
  head.writeUInt32LE(gvas.length, 0)
  head.writeUInt32LE(compressedLen, 4)
  head.write('PlZ', 8, 'latin1')
  head.writeUInt8(saveType, 11)
  return Buffer.concat([head, compressed])
}

// Level.sav / LocalData.sav = double zlib (0x32) ; saves joueur = simple (0x31).
function savTypeFor(filePath) {
  const b = path.basename(filePath).toLowerCase()
  return b === 'level.sav' || b === 'localdata.sav' ? 0x32 : 0x31
}

function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function pythonCandidates() {
  return process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
}

function runPython(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const cands = pythonCandidates()
    const tryNext = (i) => {
      if (i >= cands.length) return reject(new Error('PYTHON_MISSING'))
      const child = spawn(cands[i], [scriptPath, ...args], { windowsHide: true })
      let out = '', err = ''
      child.on('error', () => tryNext(i + 1))
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (err += d))
      child.on('close', (code) => {
        if (code === 0) resolve(out)
        else if (err.includes('MODULE_MISSING')) reject(new Error('MODULE_MISSING'))
        else reject(new Error(err || 'python exit ' + code))
      })
    }
    tryNext(0)
  })
}

/**
 * Applique des éditions à une save et la réécrit (avec backup).
 * @param {object} o
 * @param {string} o.savPath      chemin du .sav à éditer (ex. Level.sav)
 * @param {object} o.edits        { pals: [{ instanceId, set: {...} }] }
 * @param {string} o.editScript   chemin de edit_save.py
 * @param {string} [o.backupDir]  dossier des backups (défaut : à côté du .sav)
 * @returns {Promise<{backupPath:string, result:object, savSize:number}>}
 */
async function editSave({ savPath, edits, editScript, backupDir }) {
  if (!fs.existsSync(savPath)) throw new Error('Fichier introuvable : ' + savPath)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palguide-edit-'))
  const temps = []
  try {
    // 1) backup AVANT tout
    const dir = backupDir || path.dirname(savPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const backupPath = path.join(dir, path.basename(savPath) + '.bak-' + timestamp())
    fs.copyFileSync(savPath, backupPath)

    // 2) décompression -> GVAS temp
    const gvas = await decompressSav(fs.readFileSync(savPath))
    const gvasIn = path.join(tmpDir, 'in.gvas'); fs.writeFileSync(gvasIn, gvas); temps.push(gvasIn)
    const gvasOut = path.join(tmpDir, 'out.gvas'); temps.push(gvasOut)
    const editsPath = path.join(tmpDir, 'edits.json'); fs.writeFileSync(editsPath, JSON.stringify(edits)); temps.push(editsPath)

    // 3) édition + vérification (Python)
    const resJson = await runPython(editScript, [gvasIn, gvasOut, editsPath])
    const result = JSON.parse(resJson)
    if (!result.ok) throw new Error('Édition échouée')
    if (!result.verified) throw new Error('Vérification post-écriture échouée : ' + JSON.stringify(result.mismatches))

    // 4) recompression PlZ -> écriture de la save (l'original est déjà sauvegardé)
    const editedGvas = fs.readFileSync(gvasOut)
    const sav = compressSav(editedGvas, savTypeFor(savPath))
    fs.writeFileSync(savPath, sav)

    return { backupPath, result, savSize: sav.length }
  } finally {
    for (const t of temps) { try { fs.unlinkSync(t) } catch { /* */ } }
    try { fs.rmdirSync(tmpDir) } catch { /* */ }
  }
}

/** Trouve le fichier <PlayerUId>.sav d'un joueur à partir du Level.sav et de son uid. */
function findPlayerSav(levelPath, uid) {
  const dir = path.join(path.dirname(levelPath), 'Players')
  if (!fs.existsSync(dir)) return null
  const target = String(uid).replace(/-/g, '').toLowerCase()
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.sav')) continue
    if (f.slice(0, -4).toLowerCase() === target) return path.join(dir, f) // exact (exclut les *_dps.sav)
  }
  return null
}

/**
 * Édite un joueur : champs de Level.sav (niveau/XP/points de statut via son instanceId)
 * et champs du <PlayerUId>.sav (points de techno). Chaque fichier a son propre backup.
 * @param {object} o
 * @param {string} o.levelPath
 * @param {string} o.uid
 * @param {string} o.instanceId  InstanceId de l'entrée joueur (CharacterSaveParameterMap)
 * @param {object} [o.charSet]   { Level, Exp, "Status:<nom>": n, ... }  (Level.sav)
 * @param {object} [o.saveData]  { TechnologyPoint, bossTechnologyPoint } (player.sav)
 * @param {string} o.editScript
 */
async function editPlayer({ levelPath, uid, instanceId, charSet, saveData, makeGuildMaster, editScript }) {
  const out = { backups: [] }
  const levelEdits = {}
  if (charSet && Object.keys(charSet).length) {
    if (!instanceId) throw new Error('instanceId du joueur manquant')
    levelEdits.pals = [{ instanceId, set: charSet }]
  }
  if (makeGuildMaster) levelEdits.guildAdmin = { newAdminUid: uid }
  if (Object.keys(levelEdits).length) {
    const r = await editSave({ savPath: levelPath, edits: levelEdits, editScript })
    out.backups.push(r.backupPath)
    out.level = r.result
  }
  if (saveData && Object.keys(saveData).length) {
    const psav = findPlayerSav(levelPath, uid)
    if (!psav) throw new Error('Fichier de sauvegarde du joueur introuvable (Players/…)')
    const r = await editSave({ savPath: psav, edits: { saveData }, editScript })
    out.backups.push(r.backupPath)
    out.player = r.result
  }
  const verified =
    (!out.level || out.level.verified) && (!out.player || out.player.verified)
  return { ...out, verified }
}

/** Lit l'inventaire principal d'un joueur (via palsav), depuis le Level.sav courant. */
async function readInventory({ levelPath, uid, readScript }) {
  const psav = findPlayerSav(levelPath, uid)
  if (!psav) throw new Error('Fichier de sauvegarde du joueur introuvable (Players/…)')
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palguide-inv-'))
  const temps = []
  try {
    const lg = path.join(tmpDir, 'level.gvas'); fs.writeFileSync(lg, await decompressSav(fs.readFileSync(levelPath))); temps.push(lg)
    const pg = path.join(tmpDir, 'player.gvas'); fs.writeFileSync(pg, await decompressSav(fs.readFileSync(psav))); temps.push(pg)
    const json = await runPython(readScript, [lg, pg])
    return JSON.parse(json)
  } finally {
    for (const t of temps) { try { fs.unlinkSync(t) } catch { /* */ } }
    try { fs.rmdirSync(tmpDir) } catch { /* */ }
  }
}

const BAK_RE = /\.bak-(\d{8})-(\d{6})$/

/** Liste les sauvegardes de secours (.bak-…) créées par l'éditeur autour d'un Level.sav. */
function listBackups({ levelPath }) {
  const worldDir = path.dirname(levelPath)
  const dirs = [worldDir, path.join(worldDir, 'Players')]
  const out = []
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d)) {
      const m = f.match(BAK_RE)
      if (!m) continue
      const full = path.join(d, f)
      let size = 0, mtime = 0
      try { const st = fs.statSync(full); size = st.size; mtime = st.mtimeMs } catch { /* */ }
      out.push({
        path: full,
        targetName: f.replace(BAK_RE, ''),
        when: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)} ${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4, 6)}`,
        stamp: `${m[1]}-${m[2]}`,
        size,
        mtime,
      })
    }
  }
  out.sort((a, b) => b.stamp.localeCompare(a.stamp)) // plus récent d'abord
  return out
}

/** Restaure un backup : copie le .bak-… par-dessus le fichier d'origine. */
function restoreBackup({ backupPath }) {
  if (!backupPath || !BAK_RE.test(backupPath)) throw new Error('Chemin de backup invalide')
  if (!fs.existsSync(backupPath)) throw new Error('Backup introuvable')
  const target = backupPath.replace(BAK_RE, '')
  fs.copyFileSync(backupPath, target)
  return { target }
}

const playerSavName = (uid) => String(uid).replace(/-/g, '').toUpperCase() + '.sav'
const dpsSavName = (uid) => String(uid).replace(/-/g, '').toUpperCase() + '_dps.sav'

/**
 * « Fix host save » : échange l'identité (PlayerUId) de deux joueurs — pour jouer
 * en solo une save multijoueur. Édite Level.sav + les 2 <uid>.sav (+ _dps), avec
 * renommage croisé, et sauvegarde de secours complète avant écriture.
 */
async function fixHostSave({ levelPath, uid1, uid2, editScript }) {
  const worldDir = path.dirname(levelPath)
  const playersDir = path.join(worldDir, 'Players')
  const p1 = path.join(playersDir, playerSavName(uid1)) // <uid1>.sav
  const p2 = path.join(playersDir, playerSavName(uid2)) // <uid2>.sav
  if (!fs.existsSync(p1)) throw new Error('Fichier du joueur 1 introuvable (Players/…)')
  if (!fs.existsSync(p2)) throw new Error('Fichier du joueur 2 introuvable (Players/…)')
  const d1 = path.join(playersDir, dpsSavName(uid1)); const hasD1 = fs.existsSync(d1)
  const d2 = path.join(playersDir, dpsSavName(uid2)); const hasD2 = fs.existsSync(d2)

  // 1) sauvegarde de secours complète (Level + joueurs concernés + _dps)
  const stamp = timestamp()
  const backupDir = path.join(worldDir, 'palguide-fixhost-bak-' + stamp)
  fs.mkdirSync(path.join(backupDir, 'Players'), { recursive: true })
  fs.copyFileSync(levelPath, path.join(backupDir, 'Level.sav'))
  for (const f of [p1, p2, ...(hasD1 ? [d1] : []), ...(hasD2 ? [d2] : [])]) fs.copyFileSync(f, path.join(backupDir, 'Players', path.basename(f)))

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palguide-fixhost-'))
  const temps = []
  const T = (n) => { const p = path.join(tmpDir, n); temps.push(p); return p }
  try {
    // 2) décompression -> GVAS temp
    const dec = async (src, name) => { const g = T(name); fs.writeFileSync(g, await decompressSav(fs.readFileSync(src))); return g }
    const cfg = {
      uid1, uid2,
      levelIn: await dec(levelPath, 'lvl-in.gvas'), levelOut: T('lvl-out.gvas'),
      p1In: await dec(p1, 'p1-in.gvas'), p1Out: T('p1-out.gvas'),
      p2In: await dec(p2, 'p2-in.gvas'), p2Out: T('p2-out.gvas'),
    }
    if (hasD1) { cfg.dps1In = await dec(d1, 'd1-in.gvas'); cfg.dps1Out = T('d1-out.gvas') }
    if (hasD2) { cfg.dps2In = await dec(d2, 'd2-in.gvas'); cfg.dps2Out = T('d2-out.gvas') }
    const cfgPath = T('cfg.json'); fs.writeFileSync(cfgPath, JSON.stringify(cfg))

    // 3) swap (Python) + vérification
    const result = JSON.parse(await runPython(editScript, [cfgPath]))
    if (!result.ok) throw new Error('Fix host échoué')
    if (!result.verified) throw new Error('Vérification du fix host échouée : rien écrit')

    // 4) recompression -> écriture avec renommage croisé
    //    contenu de p1 (PlayerUId=uid2) -> <uid2>.sav ; contenu de p2 -> <uid1>.sav
    const writeSav = (gvasFile, dest, type) => fs.writeFileSync(dest, compressSav(fs.readFileSync(gvasFile), type))
    writeSav(cfg.levelOut, levelPath, 0x32)
    writeSav(cfg.p1Out, p2, 0x31) // p2 == <uid2>.sav
    writeSav(cfg.p2Out, p1, 0x31) // p1 == <uid1>.sav
    // _dps : déplacement croisé (u1 -> u2, u2 -> u1)
    if (hasD1 || hasD2) {
      if (hasD1) fs.rmSync(d1, { force: true })
      if (hasD2) fs.rmSync(d2, { force: true })
      if (hasD1) writeSav(cfg.dps1Out, d2, 0x31) // <uid1>_dps content -> <uid2>_dps.sav
      if (hasD2) writeSav(cfg.dps2Out, d1, 0x31)
    }
    return { backupDir, result }
  } finally {
    for (const t of temps) { try { fs.unlinkSync(t) } catch { /* */ } }
    try { fs.rmdirSync(tmpDir) } catch { /* */ }
  }
}

module.exports = { compressSav, editSave, editPlayer, readInventory, listBackups, restoreBackup, fixHostSave, savTypeFor, findPlayerSav }
