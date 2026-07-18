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

module.exports = { compressSav, editSave, savTypeFor }
