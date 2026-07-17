/// <reference types="vite/client" />

interface ElectronAPI {
  isElectron: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (cb: (value: boolean) => void) => () => void
}

interface Window {
  electronAPI?: ElectronAPI
}
