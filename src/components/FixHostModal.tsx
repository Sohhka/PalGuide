import { useState } from 'react'
import { X, Loader2, AlertTriangle, Check, ShieldAlert, ArrowLeftRight, Info } from 'lucide-react'
import type { SavePlayer } from '../lib/types'

export function FixHostModal({
  players,
  levelPath,
  onClose,
}: {
  players: SavePlayer[]
  levelPath: string
  onClose: () => void
}) {
  const [source, setSource] = useState('') // perso multijoueur (plein)
  const [target, setTarget] = useState('') // perso solo (vide)
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: true; backupDir?: string } | { ok: false; msg: string } | null>(null)

  const opts = [...players].sort((a, b) => b.palCount - a.palCount)
  const canRun = source && target && source !== target && !saving

  const run = async () => {
    if (!window.electronAPI?.fixHostSave || !canRun) return
    setSaving(true); setResult(null)
    try {
      const res = await window.electronAPI.fixHostSave({ levelPath, uid1: source, uid2: target })
      if (res.error) {
        const MSG: Record<string, string> = {
          PYTHON_MISSING: 'Python est introuvable.',
          FILE_BUSY: 'Un fichier est verrouillé. Ferme Palworld (et le serveur) avant de continuer.',
          VERIFY_FAILED: 'La vérification a échoué : rien n\'a été écrit. Tes saves d\'origine sont intactes.',
          PLAYER_SAV_MISSING: 'Un fichier joueur (Players/…) est introuvable.',
          ERROR: 'Erreur lors de l\'échange d\'identité.',
        }
        setResult({ ok: false, msg: (MSG[res.error] ?? MSG.ERROR) + (res.detail ? `\n${res.detail}` : '') })
        return
      }
      setResult({ ok: true, backupDir: res.backupDir })
    } catch (e) {
      setResult({ ok: false, msg: String((e as Error).message) })
    } finally { setSaving(false); setConfirm(false) }
  }

  const label = (p: SavePlayer) => `${p.name} · ${p.palCount} Pal${p.palCount > 1 ? 's' : ''}${p.level ? ` · niv ${p.level}` : ''}`

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]"><ArrowLeftRight size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-[var(--color-brand)]">Jouer en solo une save multijoueur</div>
            <div className="text-xs text-[var(--color-faint)]">Échange l'identité (GUID) de deux personnages</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 text-xs text-[var(--color-muted)]">
            <Info size={15} className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
            <div>
              <strong>Comment faire :</strong>
              <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                <li>Copie ton monde multijoueur dans tes sauvegardes locales.</li>
                <li>Charge-le <strong>une fois en solo</strong> → ça crée ton personnage solo (vide).</li>
                <li>Réimporte le monde ici, puis échange ton <strong>perso multijoueur</strong> avec ton <strong>perso solo</strong> ci-dessous.</li>
              </ol>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Ton personnage multijoueur (à récupérer)</span>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Choisir…</option>
              {opts.map((p) => <option key={p.uid} value={p.uid}>{label(p)}</option>)}
            </select>
          </label>
          <div className="grid place-items-center text-[var(--color-faint)]"><ArrowLeftRight size={18} /></div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Ton personnage solo (créé à l'étape 2)</span>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choisir…</option>
              {opts.map((p) => <option key={p.uid} value={p.uid} disabled={p.uid === source}>{label(p)}</option>)}
            </select>
          </label>

          <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span><strong>Ferme Palworld</strong> avant de continuer. Une <strong>sauvegarde de secours complète</strong> (Level.sav + fichiers joueurs) est créée avant l'opération. Opération sensible : <strong>teste en jeu</strong> après, et restaure le backup si besoin.</span>
          </div>

          {result?.ok === true && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] p-2.5 text-sm text-[var(--color-good)]">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div><strong>Identités échangées !</strong> Lance le jeu en solo pour retrouver ta partie. <span className="mt-1 block break-all text-xs opacity-80">Backup : {result.backupDir}</span></div>
            </div>
          )}
          {result?.ok === false && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-2.5 text-sm text-[var(--color-bad)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="whitespace-pre-wrap break-words">{result.msg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="text-xs text-[var(--color-faint)]">{confirm ? 'Confirmer l\'échange ?' : ''}</span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose}>Fermer</button>
            {confirm ? (
              <button className="btn btn-brand" onClick={run} disabled={!canRun}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
                {saving ? 'Échange…' : 'Oui, échanger'}
              </button>
            ) : (
              <button className="btn btn-brand" onClick={() => { setResult(null); setConfirm(true) }} disabled={!canRun}>
                <ArrowLeftRight size={16} /> Échanger les identités
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
