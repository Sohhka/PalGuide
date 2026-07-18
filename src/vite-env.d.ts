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
  levelPath?: string
  data?: {
    meta: { world: string; palCount: number }
    players: { uid: string; name: string; palCount: number }[]
    pals: ImportedPalRaw[]
  }
}

/** Une opération d'édition : sur un Pal identifié par son instanceId. */
interface PalEditOp {
  instanceId: string
  set: Record<string, number | string | string[]>
}

interface EditSaveResult {
  ok?: boolean
  error?: 'PYTHON_MISSING' | 'FILE_BUSY' | 'VERIFY_FAILED' | 'ERROR'
  detail?: string
  backupPath?: string
  savSize?: number
  result?: {
    verified: boolean
    appliedCount: number
    notFound: string[]
    mismatches: unknown[]
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
  editSave: (payload: { levelPath: string; edits: { pals: PalEditOp[] } }) => Promise<EditSaveResult>
}

interface Window {
  electronAPI?: ElectronAPI
}
