const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('node:path')
const { importSave } = require('./save-import.cjs')
const { editSave } = require('./save-edit.cjs')

const isDev = !!process.env.ELECTRON_DEV
let win = null

// Chemin d'un script Python embarqué (hors-asar en prod via extraResources)
function pyScriptPath(name) {
  return isDev || !app.isPackaged
    ? path.join(__dirname, '..', 'scripts', name)
    : path.join(process.resourcesPath, name)
}
const importScriptPath = () => pyScriptPath('import_save.py')

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    frame: false, // fenêtre sans cadre : barre de titre custom (look application)
    backgroundColor: '#060b14',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Ouvrir les liens externes dans le navigateur, pas dans l'app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5180')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Notifier le renderer des changements d'état (maximisé ou non)
  const sendMaxState = () => win?.webContents.send('window:maximized', win.isMaximized())
  win.on('maximize', sendMaxState)
  win.on('unmaximize', sendMaxState)
}

// ----- Contrôles de fenêtre (IPC depuis la barre de titre custom) -----
ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:toggle-maximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window:close', () => win?.close())
ipcMain.handle('window:is-maximized', () => !!win?.isMaximized())

// ----- Import d'une sauvegarde Palworld -----
function defaultSaveDir() {
  const local = process.env.LOCALAPPDATA
  return local ? path.join(local, 'Pal', 'Saved', 'SaveGames') : undefined
}

ipcMain.handle('save:import', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choisir le fichier Level.sav de ta partie',
    defaultPath: defaultSaveDir(),
    properties: ['openFile'],
    filters: [
      { name: 'Sauvegarde Palworld', extensions: ['sav'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  })
  if (res.canceled || !res.filePaths.length) return { canceled: true }
  const levelPath = res.filePaths[0]
  try {
    const data = await importSave(levelPath, importScriptPath())
    return { ok: true, data, levelPath }
  } catch (e) {
    const msg = String(e.message || e)
    let code = 'ERROR'
    if (msg.includes('PYTHON_MISSING')) code = 'PYTHON_MISSING'
    else if (msg.includes('MODULE_MISSING')) code = 'MODULE_MISSING'
    return { error: code, detail: msg.slice(0, 500) }
  }
})

// ----- Édition d'une sauvegarde (écrit sur le fichier d'origine, avec backup auto) -----
ipcMain.handle('save:edit', async (_e, payload) => {
  const { levelPath, edits } = payload || {}
  if (!levelPath || !edits) return { error: 'ERROR', detail: 'Paramètres manquants' }
  try {
    const out = await editSave({ savPath: levelPath, edits, editScript: pyScriptPath('edit_save.py') })
    return { ok: true, backupPath: out.backupPath, result: out.result, savSize: out.savSize }
  } catch (e) {
    const msg = String(e.message || e)
    let code = 'ERROR'
    if (msg.includes('PYTHON_MISSING')) code = 'PYTHON_MISSING'
    else if (msg.includes('EBUSY') || msg.includes('EPERM') || msg.includes('EACCES')) code = 'FILE_BUSY'
    else if (msg.includes('Vérification')) code = 'VERIFY_FAILED'
    return { error: code, detail: msg.slice(0, 500) }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
