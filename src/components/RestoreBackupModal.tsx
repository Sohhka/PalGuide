import { useEffect, useState } from 'react'
import { X, Loader2, AlertTriangle, Check, ShieldAlert, RotateCcw, Archive } from 'lucide-react'

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`)

export function RestoreBackupModal({ levelPath, onClose }: { levelPath: string; onClose: () => void }) {
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      const res = await window.electronAPI!.listBackups({ levelPath })
      if (res.error) setErr(res.error)
      else setBackups(res.backups ?? [])
    } catch (e) { setErr(String((e as Error).message)) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [levelPath])

  const restore = async (b: BackupEntry) => {
    setRestoring(b.path); setResult(null)
    try {
      const res = await window.electronAPI!.restoreBackup({ backupPath: b.path })
      if (res.error) {
        const msg = res.error === 'FILE_BUSY' ? 'Fichier verrouillé — ferme Palworld/le serveur.' : (res.detail || 'Échec de la restauration.')
        setResult({ ok: false, msg })
      } else {
        setResult({ ok: true, msg: `${b.targetName} restauré depuis le backup du ${b.when}.` })
      }
    } catch (e) { setResult({ ok: false, msg: String((e as Error).message) }) } finally { setRestoring(null); setConfirm(null) }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]"><Archive size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-[var(--color-brand)]">Restaurer une sauvegarde</div>
            <div className="text-xs text-[var(--color-faint)]">Reviens à un backup créé automatiquement avant une édition.</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>Ferme Palworld avant de restaurer. Le fichier concerné sera <strong>remplacé</strong> par la version du backup choisi.</span>
          </div>

          {result && (
            <div className={`mb-3 flex gap-2 rounded border p-2.5 text-sm ${result.ok ? 'border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] text-[var(--color-good)]' : 'border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] text-[var(--color-bad)]'}`}>
              {result.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
              <span>{result.msg}</span>
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center py-16 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
          ) : err ? (
            <div className="py-8 text-center text-sm text-[var(--color-bad)]">{err}</div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted)]">Aucune sauvegarde de secours pour l'instant.<br />Elles sont créées automatiquement quand tu édites ta partie.</div>
          ) : (
            <div className="space-y-1.5">
              {backups.map((b) => (
                <div key={b.path} className="flex items-center gap-3 border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{b.targetName}</div>
                    <div className="text-xs text-[var(--color-faint)]">{b.when} · {fmtSize(b.size)}</div>
                  </div>
                  {confirm === b.path ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[var(--color-warn)]">Sûr ?</span>
                      <button className="btn btn-brand py-1" disabled={restoring === b.path} onClick={() => restore(b)}>
                        {restoring === b.path ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restaurer
                      </button>
                      <button className="btn py-1" onClick={() => setConfirm(null)}>Annuler</button>
                    </div>
                  ) : (
                    <button className="btn py-1" onClick={() => { setConfirm(b.path); setResult(null) }}>
                      <RotateCcw size={14} /> Restaurer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
