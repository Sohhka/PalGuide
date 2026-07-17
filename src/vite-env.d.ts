/// <reference types="vite/client" />

interface ImportedPalRaw {
  instanceId: string | null
  characterId: string
  species: string
  isBoss: boolean
  gender: 'male' | 'female' | null
  level: number
  nickname: string | null
  iv: { hp: number; melee: number; shot: number; defense: number }
  passives: string[]
  ownerUid: string | null
  location: 'party' | 'palbox' | 'base'
}

interface ImportSaveResult {
  ok?: boolean
  canceled?: boolean
  error?: 'PYTHON_MISSING' | 'MODULE_MISSING' | 'ERROR'
  detail?: string
  data?: {
    meta: { world: string; palCount: number }
    players: { uid: string; name: string; palCount: number }[]
    pals: ImportedPalRaw[]
  }
}

interface ElectronAPI {
  isElectron: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (cb: (value: boolean) => void) => () => void
  importSave: () => Promise<ImportSaveResult>
}

interface Window {
  electronAPI?: ElectronAPI
}
