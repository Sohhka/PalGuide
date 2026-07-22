import { useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2, Star, AlertTriangle, Check, Plus, Trash2, ShieldAlert, Swords } from 'lucide-react'
import { palByKey, standardPassives, loadSkillsCatalog, type SkillsCatalog } from '../data'
import { useStore } from '../store/useStore'
import { PalIcon } from './PalIcon'
import type { ImportedPal } from '../lib/types'

const MAX_PASSIVES = 4
const MAX_SKILLS = 3
const MAX_SOUL = 20 // âmes : rang max par attribut (Statue du Pouvoir)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || 0)))

/** Correspondance clé de passif -> nom lisible (pour l'affichage). */
const passiveName = (key: string) =>
  standardPassives.find((p) => p.key === key)?.name ?? key

export function PalEditModal({
  pal,
  levelPath,
  onClose,
}: {
  pal: ImportedPal
  levelPath: string
  onClose: () => void
}) {
  const species = pal.palKey ? palByKey.get(pal.palKey) : null
  const patchImportedPal = useStore((s) => s.patchImportedPal)

  // État éditable (initialisé depuis le Pal)
  const [nickname, setNickname] = useState(pal.nickname ?? '')
  const [level, setLevel] = useState(pal.level)
  const [hp, setHp] = useState(pal.iv.hp)
  const [shot, setShot] = useState(pal.iv.shot)
  const [defense, setDefense] = useState(pal.iv.defense)
  const [stars, setStars] = useState(pal.stars)
  const [gender, setGender] = useState(pal.gender)
  const [passives, setPassives] = useState<string[]>(pal.passives)
  const [skills, setSkills] = useState<string[]>(pal.activeSkills ?? [])
  const curSouls = pal.souls ?? { hp: 0, atk: 0, def: 0, work: 0 }
  const [soulHp, setSoulHp] = useState(curSouls.hp)
  const [soulAtk, setSoulAtk] = useState(curSouls.atk)
  const [soulDef, setSoulDef] = useState(curSouls.def)
  const [soulWork, setSoulWork] = useState(curSouls.work)
  const [cat, setCat] = useState<SkillsCatalog | null>(null)
  useEffect(() => { loadSkillsCatalog().then(setCat) }, [])

  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: true; backupPath?: string } | { ok: false; msg: string } | null>(null)

  // Diff -> opérations d'édition (uniquement les champs modifiés)
  const set = useMemo(() => {
    const s: Record<string, number | string | string[]> = {}
    if (nickname.trim() !== (pal.nickname ?? '')) s.NickName = nickname.trim()
    if (level !== pal.level) s.Level = clamp(level, 1, 80)
    if (hp !== pal.iv.hp) s.Talent_HP = clamp(hp, 0, 100)
    if (shot !== pal.iv.shot) s.Talent_Shot = clamp(shot, 0, 100)
    if (defense !== pal.iv.defense) s.Talent_Defense = clamp(defense, 0, 100)
    if (stars !== pal.stars) s.Rank = clamp(stars, 0, 4) + 1 // Rank 1 = 0 étoile
    if (gender && gender !== pal.gender) s.Gender = gender === 'female' ? 'Female' : 'Male'
    if (soulHp !== curSouls.hp) s.Rank_HP = clamp(soulHp, 0, MAX_SOUL)
    if (soulAtk !== curSouls.atk) s.Rank_Attack = clamp(soulAtk, 0, MAX_SOUL)
    if (soulDef !== curSouls.def) s.Rank_Defence = clamp(soulDef, 0, MAX_SOUL)
    if (soulWork !== curSouls.work) s.Rank_CraftSpeed = clamp(soulWork, 0, MAX_SOUL)
    const passSame = passives.length === pal.passives.length && passives.every((p, i) => p === pal.passives[i])
    if (!passSame) s.PassiveSkillList = passives
    const cur = pal.activeSkills ?? []
    const skillsSame = skills.length === cur.length && skills.every((k, i) => k === cur[i])
    if (!skillsSame) s.EquipWaza = skills
    return s
  }, [nickname, level, hp, shot, defense, stars, gender, soulHp, soulAtk, soulDef, soulWork, curSouls, passives, skills, pal])

  const changedCount = Object.keys(set).length
  const canSave = changedCount > 0 && !!pal.instanceId && !saving

  const availablePassives = useMemo(
    () => standardPassives.filter((p) => !passives.includes(p.key)),
    [passives],
  )

  const skillMap = useMemo(() => new Map((cat?.skills ?? []).map((s) => [s.id, s])), [cat])
  const skillName = (id: string) => skillMap.get(id)?.name ?? id
  const availableSkills = useMemo(() => {
    if (!cat) return []
    const learn = cat.learn[pal.palKey ?? pal.species] ?? cat.learn[pal.species] ?? []
    const ids = learn.length ? learn : cat.skills.map((s) => s.id)
    return ids.filter((id) => !skills.includes(id) && skillMap.has(id))
  }, [cat, pal, skills, skillMap])

  const save = async () => {
    if (!pal.instanceId || !window.electronAPI?.editSave) return
    setSaving(true)
    setResult(null)
    try {
      const res = await window.electronAPI.editSave({
        levelPath,
        edits: { pals: [{ instanceId: pal.instanceId, set }] },
      })
      if (res.error) {
        const MSG: Record<string, string> = {
          PYTHON_MISSING: 'Python est introuvable.',
          FILE_BUSY: 'Le fichier est verrouillé. Ferme Palworld (et le serveur) avant d\'enregistrer.',
          VERIFY_FAILED: 'La vérification a échoué : rien n\'a été écrit. Ta save d\'origine est intacte.',
          ERROR: 'Erreur lors de l\'écriture.',
        }
        setResult({ ok: false, msg: (MSG[res.error] ?? MSG.ERROR) + (res.detail ? `\n${res.detail}` : '') })
        return
      }
      // reflète l'édition dans l'UI
      patchImportedPal(pal.instanceId, {
        nickname: nickname.trim() || null,
        level,
        iv: { ...pal.iv, hp, shot, defense },
        souls: { hp: soulHp, atk: soulAtk, def: soulDef, work: soulWork },
        stars,
        gender,
        passives,
        activeSkills: skills,
      })
      setResult({ ok: true, backupPath: res.backupPath })
    } catch (e) {
      setResult({ ok: false, msg: String((e as Error).message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {species && <PalIcon pal={species} size={44} ring />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-extrabold text-[var(--color-brand)]">
              Éditer {pal.nickname || species?.name || pal.species}
            </div>
            <div className="text-xs text-[var(--color-faint)]">{species?.name ?? pal.species}</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="space-y-5 p-5">
          {/* Surnom + niveau */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Surnom">
              <input className="input" value={nickname} maxLength={40}
                placeholder={species?.name ?? ''} onChange={(e) => setNickname(e.target.value)} />
            </Field>
            <Field label="Niveau">
              <input type="number" className="input" min={1} max={80} value={level}
                onChange={(e) => setLevel(clamp(+e.target.value, 1, 80))} />
            </Field>
          </div>

          {/* IVs */}
          <div>
            <div className="hud-h mb-2 text-sm">Valeurs individuelles (IVs)</div>
            <div className="space-y-2">
              <IvSlider label="PV" value={hp} onChange={setHp} />
              <IvSlider label="Attaque" value={shot} onChange={setShot} />
              <IvSlider label="Défense" value={defense} onChange={setDefense} />
            </div>
          </div>

          {/* Âmes de Pal */}
          <div>
            <div className="hud-h mb-2 text-sm">Âmes de Pal <span className="text-xs font-normal text-[var(--color-faint)]">Statue du Pouvoir · 0–{MAX_SOUL} par attribut</span></div>
            <div className="space-y-2">
              <SoulSlider label="PV" value={soulHp} onChange={setSoulHp} />
              <SoulSlider label="Attaque" value={soulAtk} onChange={setSoulAtk} />
              <SoulSlider label="Défense" value={soulDef} onChange={setSoulDef} />
              <SoulSlider label="Vit. travail" value={soulWork} onChange={setSoulWork} />
            </div>
          </div>

          {/* Condensation + genre */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Condensation (étoiles)">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} onClick={() => setStars(stars === n ? n - 1 : n)} className="p-0.5" title={`${n} étoile${n > 1 ? 's' : ''}`}>
                    <Star size={22} className={n <= stars ? 'fill-[var(--color-warn)] text-[var(--color-warn)]' : 'text-[var(--color-faint)]'} />
                  </button>
                ))}
                <span className="ml-2 text-xs text-[var(--color-faint)]">{stars}/4</span>
              </div>
            </Field>
            {pal.gender && (
              <Field label="Genre">
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map((g) => (
                    <button key={g} onClick={() => setGender(g)}
                      className={`chip border ${gender === g ? 'border-transparent bg-[var(--color-brand)] text-[#04222c]' : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]'}`}>
                      {g === 'male' ? '♂ Mâle' : '♀ Femelle'}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>

          {/* Passifs */}
          <div>
            <div className="hud-h mb-2 flex items-center gap-2 text-sm">
              Passifs <span className="text-xs font-normal text-[var(--color-faint)]">{passives.length}/{MAX_PASSIVES}</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {passives.length === 0 && <span className="text-xs text-[var(--color-faint)]">Aucun passif.</span>}
              {passives.map((key) => (
                <span key={key} className="chip flex items-center gap-1 border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  {passiveName(key)}
                  <button onClick={() => setPassives((ps) => ps.filter((p) => p !== key))} className="text-[var(--color-faint)] hover:text-[var(--color-bad)]" aria-label="Retirer">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
            {passives.length < MAX_PASSIVES && (
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-[var(--color-faint)]" />
                <select className="input w-auto flex-1" value=""
                  onChange={(e) => { if (e.target.value) setPassives((ps) => [...ps, e.target.value]) }}>
                  <option value="">Ajouter un passif…</option>
                  {availablePassives.map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Compétences actives */}
          <div>
            <div className="hud-h mb-2 flex items-center gap-2 text-sm">
              <Swords size={14} /> Compétences actives <span className="text-xs font-normal text-[var(--color-faint)]">{skills.length}/{MAX_SKILLS}</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {skills.length === 0 && <span className="text-xs text-[var(--color-faint)]">Aucune compétence équipée.</span>}
              {skills.map((id) => (
                <span key={id} className="chip flex items-center gap-1 border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  {skillName(id)}
                  <button onClick={() => setSkills((ss) => ss.filter((s) => s !== id))} className="text-[var(--color-faint)] hover:text-[var(--color-bad)]" aria-label="Retirer">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
            {skills.length < MAX_SKILLS && (
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-[var(--color-faint)]" />
                <select className="input w-auto flex-1" value=""
                  onChange={(e) => { if (e.target.value) setSkills((ss) => [...ss, e.target.value]) }}>
                  <option value="">{cat ? 'Ajouter une compétence…' : 'Chargement…'}</option>
                  {availableSkills.map((id) => (
                    <option key={id} value={id}>{skillName(id)}{skillMap.get(id)?.element ? ` · ${skillMap.get(id)!.element}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Avertissement */}
          <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span>Ferme Palworld (et ton serveur) avant d'enregistrer. Une <strong>sauvegarde de secours</strong> de ton fichier est créée automatiquement avant toute écriture.</span>
          </div>

          {/* Résultat */}
          {result?.ok === true && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] p-2.5 text-sm text-[var(--color-good)]">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>Enregistré dans ta save.</strong>
                {result.backupPath && <span className="mt-1 block break-all text-xs opacity-80">Backup : {result.backupPath}</span>}
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

        {/* Pied : actions */}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-faint)]">{label}</span>
      {children}
    </label>
  )
}

function IvSlider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const color = value >= 70 ? 'var(--color-good)' : value >= 40 ? 'var(--color-warn)' : 'var(--color-faint)'
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold text-[var(--color-muted)]">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(+e.target.value)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-3)]"
        style={{ accentColor: color }} />
      <input type="number" min={0} max={100} value={value} onChange={(e) => onChange(clamp(+e.target.value, 0, 100))}
        className="input w-16 py-1 text-center tabular-nums" />
    </div>
  )
}

function SoulSlider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-semibold text-[var(--color-muted)]">{label}</span>
      <input type="range" min={0} max={MAX_SOUL} value={value} onChange={(e) => onChange(+e.target.value)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-3)]"
        style={{ accentColor: 'var(--color-accent)' }} />
      <input type="number" min={0} max={MAX_SOUL} value={value} onChange={(e) => onChange(clamp(+e.target.value, 0, MAX_SOUL))}
        className="input w-14 py-1 text-center tabular-nums" />
      <span className="w-11 shrink-0 text-right text-xs text-[var(--color-faint)] tabular-nums">+{value * 3}%</span>
    </div>
  )
}
