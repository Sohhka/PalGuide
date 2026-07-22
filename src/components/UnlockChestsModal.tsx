import { useState } from 'react'
import { X, Loader2, AlertTriangle, Check, ShieldAlert, LockOpen, Info } from 'lucide-react'

type UnlockResult = { scanned: number; unlocked: number; byType: Record<string, number> }

export function UnlockChestsModal({
  levelPath,
  onClose,
}: {
  levelPath: string
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<
    { ok: true; data: UnlockResult; backupPath?: string } | { ok: false; msg: string } | null
  >(null)

  const run = async () => {
    if (!window.electronAPI?.editSave) return
    setSaving(true); setResult(null)
    try {
      const res = await window.electronAPI.editSave({ levelPath, edits: { unlockChests: true } })
      if (res.error) {
        const MSG: Record<string, string> = {
          PYTHON_MISSING: 'Python est introuvable.',
          FILE_BUSY: 'Le fichier de sauvegarde est verrouillé. Ferme Palworld avant de continuer.',
          VERIFY_FAILED: 'La vérification a échoué : rien n\'a été écrit. Ta save d\'origine est intacte.',
          ERROR: 'Erreur lors du déverrouillage des coffres.',
        }
        setResult({ ok: false, msg: (MSG[res.error] ?? MSG.ERROR) + (res.detail ? `\n${res.detail}` : '') })
        return
      }
      const entry = res.result?.applied?.find((a) => a.kind === 'unlockChests')
      const data = (entry?.result as UnlockResult) ?? { scanned: 0, unlocked: 0, byType: {} }
      setResult({ ok: true, data, backupPath: res.backupPath })
    } catch (e) {
      setResult({ ok: false, msg: String((e as Error).message) })
    } finally { setSaving(false); setConfirm(false) }
  }

  const total = result?.ok ? result.data.unlocked : 0

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]"><LockOpen size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-[var(--color-brand)]">Déverrouiller tous les coffres</div>
            <div className="text-xs text-[var(--color-faint)]">Rend accessibles les coffres/étals verrouillés en privé</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 text-xs text-[var(--color-muted)]">
            <Info size={15} className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
            <div>
              Sur une partie multijoueur, certains coffres (et étals marchands) sont <strong>verrouillés en privé</strong> par le joueur qui les a placés — seul lui peut les ouvrir. Cet outil retire ce verrou <strong>partout dans le monde</strong>, pour que tous les coffres redeviennent <strong>accessibles à toute la guilde</strong>. Idéal pour jouer en solo une ancienne save multijoueur.
            </div>
          </div>

          <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span><strong>Ferme Palworld</strong> avant de continuer. Une <strong>sauvegarde de secours</strong> du Level.sav est créée automatiquement avant l'opération, et la modification est vérifiée avant d'être écrite.</span>
          </div>

          {result?.ok === true && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] p-2.5 text-sm text-[var(--color-good)]">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div>
                {total > 0 ? (
                  <><strong>{total} verrou{total > 1 ? 's' : ''} retiré{total > 1 ? 's' : ''} !</strong> Tous les coffres sont désormais accessibles.</>
                ) : (
                  <><strong>Aucun coffre verrouillé.</strong> Tes coffres étaient déjà tous accessibles.</>
                )}
                <span className="mt-1 block text-xs opacity-80">{result.data.scanned} coffres/étals analysés.</span>
                {result.backupPath && <span className="mt-1 block break-all text-xs opacity-70">Backup : {result.backupPath}</span>}
              </div>
            </div>
          )}
          {result?.ok === false && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-2.5 text-sm text-[var(--color-bad)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="whitespace-pre-wrap break-words">{result.msg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="text-xs text-[var(--color-faint)]">{confirm ? 'Déverrouiller tous les coffres du monde ?' : ''}</span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose}>Fermer</button>
            {result?.ok === true ? null : confirm ? (
              <button className="btn btn-brand" onClick={run} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <LockOpen size={16} />}
                {saving ? 'Déverrouillage…' : 'Oui, déverrouiller'}
              </button>
            ) : (
              <button className="btn btn-brand" onClick={() => { setResult(null); setConfirm(true) }} disabled={saving}>
                <LockOpen size={16} /> Déverrouiller les coffres
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
