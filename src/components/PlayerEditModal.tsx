import { useMemo, useState } from 'react'
import { X, Save, Loader2, AlertTriangle, Check, ShieldAlert, User, Cpu, Sparkles, Crown } from 'lucide-react'
import { useStore } from '../store/useStore'
import { statusLabel, STATUS_ORDER } from '../lib/savedata'
import type { SavePlayer } from '../lib/types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || 0)))

export function PlayerEditModal({
  player,
  levelPath,
  onClose,
}: {
  player: SavePlayer
  levelPath: string
  onClose: () => void
}) {
  const patchImportedPlayer = useStore((s) => s.patchImportedPlayer)
  const canEditChar = !!player.instanceId

  const [level, setLevel] = useState(player.level ?? 1)
  const [status, setStatus] = useState<Record<string, number>>({ ...(player.statusPoints ?? {}) })
  const [tech, setTech] = useState(player.techPoint ?? 0)
  const [bossTech, setBossTech] = useState(player.bossTechPoint ?? 0)
  const [unlockAllTech, setUnlockAllTech] = useState(false)
  const [makeGuildMaster, setMakeGuildMaster] = useState(false)

  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: true; backups?: string[] } | { ok: false; msg: string } | null>(null)

  // Ordonne les points de statut : principaux d'abord, puis le reste.
  const statusKeys = useMemo(() => {
    const keys = Object.keys(player.statusPoints ?? {})
    return keys.sort((a, b) => {
      const ia = STATUS_ORDER.indexOf(a), ib = STATUS_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || statusLabel(a).localeCompare(statusLabel(b))
    })
  }, [player])

  const charSet = useMemo(() => {
    const s: Record<string, number> = {}
    if (canEditChar) {
      if (level !== player.level) s.Level = clamp(level, 1, 60)
      for (const k of statusKeys) {
        const v = clamp(status[k] ?? 0, 0, 50)
        if (v !== (player.statusPoints?.[k] ?? 0)) s['Status:' + k] = v
      }
    }
    return s
  }, [level, status, statusKeys, player, canEditChar])

  const saveData = useMemo(() => {
    const s: Record<string, number | boolean> = {}
    if (tech !== (player.techPoint ?? 0)) s.TechnologyPoint = clamp(tech, 0, 999999)
    if (bossTech !== (player.bossTechPoint ?? 0)) s.bossTechnologyPoint = clamp(bossTech, 0, 999999)
    if (unlockAllTech) s.UnlockAllTech = true
    return s
  }, [tech, bossTech, unlockAllTech, player])

  const changedCount = Object.keys(charSet).length + Object.keys(saveData).length + (makeGuildMaster ? 1 : 0)
  const canSave = changedCount > 0 && !saving

  const save = async () => {
    if (!window.electronAPI?.editPlayer) return
    setSaving(true)
    setResult(null)
    try {
      const res = await window.electronAPI.editPlayer({
        levelPath,
        uid: player.uid,
        instanceId: player.instanceId,
        charSet: Object.keys(charSet).length ? charSet : undefined,
        saveData: Object.keys(saveData).length ? saveData : undefined,
        makeGuildMaster: makeGuildMaster || undefined,
      })
      if (res.error) {
        const MSG: Record<string, string> = {
          PYTHON_MISSING: 'Python est introuvable.',
          FILE_BUSY: 'Un fichier est verrouillé. Ferme Palworld (et le serveur) avant d\'enregistrer.',
          VERIFY_FAILED: 'La vérification a échoué : rien n\'a été écrit. Ta save d\'origine est intacte.',
          PLAYER_SAV_MISSING: 'Fichier joueur (Players/…) introuvable pour éditer la techno.',
          ERROR: 'Erreur lors de l\'écriture.',
        }
        setResult({ ok: false, msg: (MSG[res.error] ?? MSG.ERROR) + (res.detail ? `\n${res.detail}` : '') })
        return
      }
      patchImportedPlayer(player.uid, {
        level,
        statusPoints: { ...status },
        techPoint: tech,
        bossTechPoint: bossTech,
      })
      setMakeGuildMaster(false)
      setResult({ ok: true, backups: res.backups })
    } catch (e) {
      setResult({ ok: false, msg: String((e as Error).message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]"><User size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-extrabold text-[var(--color-brand)]">Éditer {player.name}</div>
            <div className="text-xs text-[var(--color-faint)]">Personnage joueur</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="space-y-5 p-5">
          {/* Niveau */}
          {canEditChar && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Niveau</span>
                <input type="number" className="input" min={1} max={60} value={level}
                  onChange={(e) => setLevel(clamp(+e.target.value, 1, 60))} />
                <span className="mt-1 block text-[10px] text-[var(--color-faint)]">L'XP est ajustée automatiquement pour ce niveau.</span>
              </label>
            </div>
          )}

          {/* Points de statut */}
          {canEditChar && statusKeys.length > 0 && (
            <div>
              <div className="hud-h mb-2 flex items-center gap-2 text-sm"><Sparkles size={14} /> Points de statut</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {statusKeys.map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-muted)]" title={statusLabel(k)}>{statusLabel(k)}</span>
                    <input type="number" min={0} max={50} value={status[k] ?? 0}
                      onChange={(e) => setStatus((s) => ({ ...s, [k]: clamp(+e.target.value, 0, 50) }))}
                      className="input w-16 py-1 text-center tabular-nums" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points de techno */}
          <div>
            <div className="hud-h mb-2 flex items-center gap-2 text-sm"><Cpu size={14} /> Points de technologie</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Points de techno</span>
                <input type="number" className="input" min={0} max={999999} value={tech}
                  onChange={(e) => setTech(clamp(+e.target.value, 0, 999999))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Points de techno (boss)</span>
                <input type="number" className="input" min={0} max={999999} value={bossTech}
                  onChange={(e) => setBossTech(clamp(+e.target.value, 0, 999999))} />
              </label>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={unlockAllTech} onChange={(e) => setUnlockAllTech(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
              <span>Débloquer <strong>toutes les technologies</strong> (588 recettes)</span>
            </label>
          </div>

          {/* Guilde (multijoueur) */}
          <div>
            <div className="hud-h mb-2 flex items-center gap-2 text-sm"><Crown size={14} /> Guilde</div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={makeGuildMaster} onChange={(e) => setMakeGuildMaster(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
              <span>Définir ce joueur comme <strong>maître de la guilde</strong></span>
            </label>
            <p className="mt-1 text-[10px] text-[var(--color-faint)]">Utile pour reprendre une save multijoueur en solo (devenir chef de guilde).</p>
          </div>

          {/* Avertissement */}
          <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span>Ferme Palworld (et ton serveur) avant d'enregistrer. Une <strong>sauvegarde de secours</strong> de chaque fichier modifié est créée automatiquement.</span>
          </div>

          {result?.ok === true && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] p-2.5 text-sm text-[var(--color-good)]">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>Enregistré dans ta save.</strong>
                {result.backups?.map((b) => <span key={b} className="mt-1 block break-all text-xs opacity-80">Backup : {b}</span>)}
              </div>
            </div>
          )}
          {result?.ok === false && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-2.5 text-sm text-[var(--color-bad)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{result.msg}</span>
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="text-xs text-[var(--color-faint)]">
            {changedCount > 0 ? `${changedCount} champ${changedCount > 1 ? 's' : ''} modifié${changedCount > 1 ? 's' : ''}` : 'Aucune modification'}
          </span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose}>Fermer</button>
            <button className="btn btn-brand" onClick={save} disabled={!canSave}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Enregistrement…' : 'Enregistrer dans la save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
