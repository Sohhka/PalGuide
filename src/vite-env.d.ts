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
  activeSkills?: string[]
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
    players: {
      uid: string
      name: string
      palCount: number
      instanceId?: string | null
      level?: number
      exp?: number
      statusPoints?: Record<string, number>
      techPoint?: number | null
      bossTechPoint?: number | null
      palboxId?: string | null
    }[]
    pals: ImportedPalRaw[]
  }
}

interface CreatePalOp {
  characterId: string
  nickname?: string
  ownerUid: string
  palboxId: string
  level: number
  ivHp?: number
  ivShot?: number
  ivDefense?: number
  gender?: string
  passives?: string[]
  rank?: number
}

interface EditPlayerResult {
  ok?: boolean
  error?: 'PYTHON_MISSING' | 'FILE_BUSY' | 'VERIFY_FAILED' | 'PLAYER_SAV_MISSING' | 'ERROR'
  detail?: string
  backups?: string[]
  verified?: boolean
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

interface InventoryOp {
  containerId: string
  action: 'count' | 'item' | 'add' | 'remove'
  slotIndex?: number
  staticId?: string
  count?: number
}

interface InventorySlot {
  slotIndex: number
  id: string
  count: number
  dyn: boolean
}

interface ReadInventoryResult {
  ok?: boolean
  error?: 'PYTHON_MISSING' | 'PLAYER_SAV_MISSING' | 'ERROR'
  detail?: string
  inventory?: { containerId: string; slotNum: number; slots: InventorySlot[]; error?: string }
}

interface BackupEntry {
  path: string
  targetName: string
  when: string
  stamp: string
  size: number
  mtime: number
}

interface ListBackupsResult {
  ok?: boolean
  error?: string
  backups?: BackupEntry[]
}

interface RestoreBackupResult {
  ok?: boolean
  error?: 'FILE_BUSY' | 'ERROR'
  detail?: string
  target?: string
}

interface FixHostResult {
  ok?: boolean
  error?: 'PYTHON_MISSING' | 'FILE_BUSY' | 'VERIFY_FAILED' | 'PLAYER_SAV_MISSING' | 'ERROR'
  detail?: string
  backupDir?: string
  counts?: Record<string, number>
}

interface ElectronAPI {
  isElectron: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (cb: (value: boolean) => void) => () => void
  importSave: () => Promise<ImportSaveResult>
  editSave: (payload: {
    levelPath: string
    edits: { pals?: PalEditOp[]; saveData?: Record<string, number>; inventory?: InventoryOp[]; createPals?: CreatePalOp[] }
  }) => Promise<EditSaveResult>
  editPlayer: (payload: {
    levelPath: string
    uid: string
    instanceId?: string | null
    charSet?: Record<string, number | string>
    saveData?: Record<string, number | boolean>
    makeGuildMaster?: boolean
  }) => Promise<EditPlayerResult>
  readInventory: (payload: { levelPath: string; uid: string }) => Promise<ReadInventoryResult>
  listBackups: (payload: { levelPath: string }) => Promise<ListBackupsResult>
  restoreBackup: (payload: { backupPath: string }) => Promise<RestoreBackupResult>
  fixHostSave: (payload: { levelPath: string; uid1: string; uid2: string }) => Promise<FixHostResult>
}

interface Window {
  electronAPI?: ElectronAPI
}
