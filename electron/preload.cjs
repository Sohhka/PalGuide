const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (cb) => {
    const listener = (_e, value) => cb(value)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },
  importSave: () => ipcRenderer.invoke('save:import'),
  editSave: (payload) => ipcRenderer.invoke('save:edit', payload),
  editPlayer: (payload) => ipcRenderer.invoke('save:edit-player', payload),
  readInventory: (payload) => ipcRenderer.invoke('save:read-inventory', payload),
  listBackups: (payload) => ipcRenderer.invoke('save:list-backups', payload),
  restoreBackup: (payload) => ipcRenderer.invoke('save:restore-backup', payload),
  fixHostSave: (payload) => ipcRenderer.invoke('save:fix-host', payload),
})
