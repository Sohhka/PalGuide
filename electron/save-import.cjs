// Import d'une sauvegarde Palworld.
//  - Décompression (côté Node) : PlZ (zlib) ou PlM (Oodle via oozextract).
//  - Parsing (côté Python) : palworld-save-tools, via scripts/import_save.py.
// Lecture seule — ne modifie jamais la sauvegarde.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { spawn } = require('node:child_process')

// oozextract est un module ESM -> import() dynamique (compatible node 20 d'Electron)
let _Extractor = null
async function getExtractor() {
  if (!_Extractor) _Extractor = (await import('oozextract')).Extractor
  return _Extractor
}

async function decompressSav(data) {
  let ul = data.readUInt32LE(0)
  let magic = data.slice(8, 11).toString('latin1')
  let type = data[11]
  let off = 12
  if (magic === 'CNK') {
    ul = data.readUInt32LE(12)
    magic = data.slice(20, 23).toString('latin1')
    type = data[23]
    off = 24
  }
  const payload = data.subarray(off)
  if (magic === 'PlZ') {
    let out = zlib.inflateSync(payload)
    if (type === 0x32) out = zlib.inflateSync(out)
    return out
  }
  if (magic === 'PlM') {
    // Oodle (Palworld v0.6+/1.0)
    const Extractor = await getExtractor()
    const ex = Extractor.new()
    const out = Buffer.from(ex.extract(Uint8Array.from(payload), ul))
    if (out.length !== ul) throw new Error('décompression Oodle incohérente')
    return out
  }
  throw new Error('Format de sauvegarde non reconnu (magic ' + JSON.stringify(magic) + ')')
}

async function decompressToTemp(savPath, tmpDir) {
  const gvas = await decompressSav(fs.readFileSync(savPath))
  const tmp = path.join(tmpDir, 'pg-' + path.basename(savPath) + '-' + process.pid + '-' + gvas.length + '.gvas')
  fs.writeFileSync(tmp, gvas)
  return tmp
}

// Localise l'exécutable Python (python / python3 / py)
function pythonCandidates() {
  return process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
}

function runPython(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const cands = pythonCandidates()
    const tryNext = (i) => {
      if (i >= cands.length) return reject(new Error('PYTHON_MISSING'))
      const child = spawn(cands[i], [scriptPath, ...args], { windowsHide: true })
      let out = ''
      let err = ''
      child.on('error', () => tryNext(i + 1)) // exe introuvable -> candidat suivant
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
 * @param {string} levelPath  chemin vers Level.sav
 * @param {string} scriptPath chemin vers import_save.py
 */
async function importSave(levelPath, scriptPath) {
  const worldDir = path.dirname(levelPath)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palguide-'))
  const temps = []
  try {
    const levelGvas = await decompressToTemp(levelPath, tmpDir)
    temps.push(levelGvas)

    const playerArgs = []
    const playersDir = path.join(worldDir, 'Players')
    if (fs.existsSync(playersDir)) {
      for (const f of fs.readdirSync(playersDir)) {
        if (!f.toLowerCase().endsWith('.sav')) continue
        try {
          const g = await decompressToTemp(path.join(playersDir, f), tmpDir)
          temps.push(g)
          playerArgs.push(g)
        } catch {
          /* joueur illisible -> ignoré */
        }
      }
    }

    const json = await runPython(scriptPath, [levelGvas, ...playerArgs])
    return JSON.parse(json)
  } finally {
    for (const t of temps) {
      try {
        fs.unlinkSync(t)
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmdirSync(tmpDir)
    } catch {
      /* ignore */
    }
  }
}

module.exports = { decompressSav, importSave }
