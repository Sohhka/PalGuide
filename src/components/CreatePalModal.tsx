import { useMemo, useState } from 'react'
import { X, Sparkles, Loader2, AlertTriangle, Check, ShieldAlert, Star, Search, Plus, Trash2 } from 'lucide-react'
import { palsSortedByDex, palByKey, standardPassives } from '../data'
import { PalIcon } from './PalIcon'
import { palMatches } from '../lib/pal-helpers'
import type { SavePlayer } from '../lib/types'

const MAX_PASSIVES = 4
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || 0)))
const passiveName = (key: string) => standardPassives.find((p) => p.key === key)?.name ?? key

export function CreatePalModal({
  player,
  levelPath,
  onClose,
}: {
  player: SavePlayer
  levelPath: string
  onClose: () => void
}) {
  const [speciesKey, setSpeciesKey] = useState<string>('')
  const species = speciesKey ? palByKey.get(speciesKey) : null
  const [q, setQ] = useState('')

  const [nickname, setNickname] = useState('')
  const [level, setLevel] = useState(1)
  const [hp, setHp] = useState(100)
  const [shot, setShot] = useState(100)
  const [defense, setDefense] = useState(100)
  const [stars, setStars] = useState(0)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [passives, setPassives] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: true } | { ok: false; msg: string } | null>(null)

  const results = useMemo(() => {
    const list = palsSortedByDex.filter((p) => !p.key.includes('_')) // espèces de base
    if (!q.trim()) return list.slice(0, 60)
    return list.filter((p) => palMatches(p, q)).slice(0, 60)
  }, [q])

  const availablePassives = useMemo(() => standardPassives.filter((p) => !passives.includes(p.key)), [passives])

  const canCreate = !!species && !!player.palboxId && !saving

  const create = async () => {
    if (!species || !player.palboxId || !window.electronAPI?.editSave) return
    setSaving(true); setResult(null)
    try {
      const res = await window.electronAPI.editSave({
        levelPath,
        edits: {
          createPals: [{
            characterId: species.key,
            nickname: nickname.trim() || undefined,
            ownerUid: player.uid,
            palboxId: player.palboxId,
            level: clamp(level, 1, 60),
            ivHp: clamp(hp, 0, 100), ivShot: clamp(shot, 0, 100), ivDefense: clamp(defense, 0, 100),
            gender: gender === 'female' ? 'Female' : 'Male',
            passives,
            rank: clamp(stars, 0, 4) + 1,
          }],
        },
      })
      if (res.error) {
        const MSG: Record<string, string> = {
          PYTHON_MISSING: 'Python est introuvable.',
          FILE_BUSY: 'Le fichier est verrouillé. Ferme Palworld (et le serveur) avant d\'enregistrer.',
          VERIFY_FAILED: 'La vérification a échoué : rien n\'a été écrit. Ta save d\'origine est intacte.',
          ERROR: 'Erreur lors de la création.',
        }
        setResult({ ok: false, msg: (MSG[res.error] ?? MSG.ERROR) + (res.detail ? `\n${res.detail}` : '') })
        return
      }
      if (res.result && !res.result.verified) {
        setResult({ ok: false, msg: 'La création n\'a pas pu être vérifiée. Ta save d\'origine est intacte (rien écrit).' })
        return
      }
      setResult({ ok: true })
    } catch (e) {
      setResult({ ok: false, msg: String((e as Error).message) })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]"><Sparkles size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-[var(--color-brand)]">Créer un Pal</div>
            <div className="text-xs text-[var(--color-faint)]">Ajouté à la boîte de {player.name}</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* Choix d'espèce */}
          <div>
            <div className="hud-h mb-2 text-sm">Espèce {species && <span className="font-normal text-[var(--color-brand)]">· {species.name}</span>}</div>
            <div className="relative mb-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
              <input className="input pl-9" placeholder="Rechercher une espèce…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
              {results.map((p) => (
                <button key={p.key} onClick={() => setSpeciesKey(p.key)}
                  className={`flex items-center gap-2 border px-2 py-1.5 text-left ${speciesKey === p.key ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]' : 'border-transparent hover:bg-[var(--color-surface)]'}`}>
                  <PalIcon pal={p} size={26} />
                  <span className="truncate text-xs font-semibold">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {species && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Surnom (optionnel)</span>
                  <input className="input" value={nickname} maxLength={40} placeholder={species.name} onChange={(e) => setNickname(e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Niveau</span>
                  <input type="number" className="input" min={1} max={60} value={level} onChange={(e) => setLevel(clamp(+e.target.value, 1, 60))} /></label>
              </div>

              <div>
                <div className="hud-h mb-2 text-sm">Valeurs individuelles (IVs)</div>
                <div className="space-y-2">
                  <IvRow label="PV" value={hp} onChange={setHp} />
                  <IvRow label="Attaque" value={shot} onChange={setShot} />
                  <IvRow label="Défense" value={defense} onChange={setDefense} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Condensation</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} onClick={() => setStars(stars === n ? n - 1 : n)} className="p-0.5">
                        <Star size={20} className={n <= stars ? 'fill-[var(--color-warn)] text-[var(--color-warn)]' : 'text-[var(--color-faint)]'} />
                      </button>
                    ))}
                    <span className="ml-2 text-xs text-[var(--color-faint)]">{stars}/4</span>
                  </div>
                </div>
                <div><span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">Genre</span>
                  <div className="flex gap-2">
                    {(['male', 'female'] as const).map((gK) => (
                      <button key={gK} onClick={() => setGender(gK)}
                        className={`chip border ${gender === gK ? 'border-transparent bg-[var(--color-brand)] text-[#04222c]' : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]'}`}>
                        {gK === 'male' ? '♂ Mâle' : '♀ Femelle'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="hud-h mb-2 text-sm">Passifs <span className="text-xs font-normal text-[var(--color-faint)]">{passives.length}/{MAX_PASSIVES}</span></div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {passives.map((key) => (
                    <span key={key} className="chip flex items-center gap-1 border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                      {passiveName(key)}
                      <button onClick={() => setPassives((ps) => ps.filter((p) => p !== key))} className="text-[var(--color-faint)] hover:text-[var(--color-bad)]"><Trash2 size={12} /></button>
                    </span>
                  ))}
                </div>
                {passives.length < MAX_PASSIVES && (
                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-[var(--color-faint)]" />
                    <select className="input w-auto flex-1" value="" onChange={(e) => { if (e.target.value) setPassives((ps) => [...ps, e.target.value]) }}>
                      <option value="">Ajouter un passif…</option>
                      {availablePassives.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span>Ferme Palworld avant de créer. Backup auto du <code>Level.sav</code>. Le Pal apparaît dans ta boîte — <strong>réimporte ta partie</strong> pour le voir/éditer dans la liste.</span>
          </div>
          {result?.ok === true && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] p-2.5 text-sm text-[var(--color-good)]">
              <Check size={16} className="mt-0.5 shrink-0" /> <strong>{species?.name} créé et ajouté à ta boîte !</strong>
            </div>
          )}
          {result?.ok === false && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-2.5 text-sm text-[var(--color-bad)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span className="whitespace-pre-wrap break-words">{result.msg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="text-xs text-[var(--color-faint)]">{species ? species.name : 'Choisis une espèce'}</span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose}>Fermer</button>
            <button className="btn btn-brand" onClick={create} disabled={!canCreate}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {saving ? 'Création…' : 'Créer le Pal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IvRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const color = value >= 70 ? 'var(--color-good)' : value >= 40 ? 'var(--color-warn)' : 'var(--color-faint)'
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold text-[var(--color-muted)]">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(+e.target.value)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-3)]" style={{ accentColor: color }} />
      <input type="number" min={0} max={100} value={value} onChange={(e) => onChange(clamp(+e.target.value, 0, 100))}
        className="input w-16 py-1 text-center tabular-nums" />
    </div>
  )
}
