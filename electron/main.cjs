const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')

const isDev = !!process.env.ELECTRON_DEV
let win = null

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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
