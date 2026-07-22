import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { resolveImport } from '../lib/savedata'

const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/** Ré-importe périodiquement la save depuis son chemin mémorisé (silencieux). Monté globalement. */
export function AutoReimport() {
  const importedSave = useStore((s) => s.importedSave)
  const autoRefresh = useStore((s) => s.autoRefresh)
  const refreshImportedSave = useStore((s) => s.refreshImportedSave)
  const levelPath = importedSave?.levelPath

  useEffect(() => {
    if (!autoRefresh || !levelPath || !window.electronAPI?.reimportSave) return
    let cancelled = false
    let running = false
    const tick = async () => {
      if (running) return
      running = true
      try {
        const res = await window.electronAPI!.reimportSave(levelPath)
        if (!cancelled && res.ok && res.data) {
          refreshImportedSave({ ...resolveImport(res.data), levelPath: res.levelPath })
        }
      } catch {
        /* échec (fichier verrouillé pendant une sauvegarde du jeu, etc.) -> on réessaie au prochain cycle */
      } finally {
        running = false
      }
    }
    const id = setInterval(tick, INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [autoRefresh, levelPath, refreshImportedSave])

  return null
}
