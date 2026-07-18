import { useMemo, useState } from 'react'
import { Plus, X, Layers, AlertTriangle, Sparkles, Users, Trash2, Save, Bookmark, Pencil, Check } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerModal } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges, WorkBadge, ElementBadge } from '../components/badges'
import { palByKey } from '../data'
import { useStore } from '../store/useStore'
import { analyzeTeam } from '../lib/partnerSkills'
import type { Pal } from '../lib/types'

export function TeamBuilderPage() {
  const { team, setTeamSlot, clearTeam, teamPresets, saveTeamPreset, loadTeamPreset, updateTeamPreset, renameTeamPreset, deleteTeamPreset } =
    useStore()
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const members = useMemo(() => team.map((k) => (k ? palByKey.get(k) ?? null : null)), [team])
  const analysis = useMemo(() => analyzeTeam(members), [members])
  const filled = members.filter(Boolean).length

  // Preset actuellement affiché dans les emplacements (mêmes Pals, mêmes positions)
  const activePresetId = useMemo(() => {
    if (filled === 0) return null
    const p = teamPresets.find((pr) => pr.team.length === team.length && pr.team.every((k, i) => (k ?? null) === (team[i] ?? null)))
    return p?.id ?? null
  }, [teamPresets, team, filled])

  return (
    <>
      <PageHeader
        eyebrow="Team Builder"
        title="Composition d'équipe"
        subtitle="Assemble ton équipe de 5, visualise les partner skills et repère ceux qui se cumulent (ou pas)."
        actions={
          filled > 0 ? (
            <button className="btn" onClick={clearTeam}>
              <Trash2 size={15} /> Vider
            </button>
          ) : undefined
        }
      />

      {/* Presets d'équipe */}
      <div className="card mb-5 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-h flex items-center gap-2 text-sm">
            <Bookmark size={15} /> Mes builds
          </h2>
          {saving ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="input w-48 py-1 text-sm"
                placeholder="Nom du build…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && presetName.trim()) {
                    saveTeamPreset(presetName)
                    setPresetName('')
                    setSaving(false)
                  } else if (e.key === 'Escape') setSaving(false)
                }}
              />
              <button
                className="btn btn-brand py-1"
                disabled={!presetName.trim()}
                onClick={() => {
                  saveTeamPreset(presetName)
                  setPresetName('')
                  setSaving(false)
                }}
              >
                <Check size={15} /> OK
              </button>
              <button className="btn py-1" onClick={() => setSaving(false)}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <button className="btn" onClick={() => setSaving(true)} disabled={filled === 0} title={filled === 0 ? 'Ajoute des Pals d\'abord' : ''}>
              <Save size={15} /> Sauvegarder ce build
            </button>
          )}
        </div>

        {teamPresets.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">Aucun build sauvegardé. Compose une équipe puis clique sur « Sauvegarder ce build ».</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-[var(--color-faint)]">
              Clique sur un build pour le <span className="text-[var(--color-brand)]">charger</span> dans les emplacements ci-dessous et voir tous ses Pals en grand.
            </p>
            <div className="flex flex-wrap gap-2">
              {teamPresets.map((p) => {
                const count = p.team.filter(Boolean).length
                const icons = p.team.filter((k): k is string => !!k).map((k) => palByKey.get(k)).filter(Boolean) as Pal[]
                const active = activePresetId === p.id
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1.5 border p-1.5 transition-colors ${
                      active
                        ? 'border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_12%,var(--color-surface-2))] shadow-[0_0_12px_rgba(79,205,236,0.25)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-2)]'
                    }`}
                  >
                    {editingId === p.id ? (
                      <input
                        autoFocus
                        className="input w-36 py-0.5 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { renameTeamPreset(p.id, editName); setEditingId(null) }
                          else if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => { renameTeamPreset(p.id, editName); setEditingId(null) }}
                      />
                    ) : (
                      <button
                        className="group flex items-center gap-1.5 pl-1"
                        onClick={() => loadTeamPreset(p.id)}
                        title={active ? 'Build déjà chargé' : 'Charger ce build dans les emplacements'}
                      >
                        <span className="flex -space-x-1.5">
                          {icons.slice(0, 5).map((pal, i) => (
                            <PalIcon key={i} pal={pal} size={22} ring />
                          ))}
                        </span>
                        <span className="text-sm font-semibold">{p.name}</span>
                        {active ? (
                          <span className="chip bg-[color-mix(in_srgb,var(--color-brand)_20%,transparent)] text-[10px] text-[var(--color-brand)]">
                            <Check size={11} /> Chargée
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--color-faint)] group-hover:text-[var(--color-brand)]">{count}/5 · charger</span>
                        )}
                      </button>
                    )}
                    <div className="flex items-center border-l border-[var(--color-border)] pl-1">
                      <button className="rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-brand)]" title="Mettre à jour avec l'équipe actuelle" onClick={() => updateTeamPreset(p.id)}>
                        <Save size={13} />
                      </button>
                      <button className="rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-ink)]" title="Renommer" onClick={() => { setEditingId(p.id); setEditName(p.name) }}>
                        <Pencil size={13} />
                      </button>
                      <button className="rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-bad)]" title="Supprimer" onClick={() => deleteTeamPreset(p.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Slots */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {team.map((key, i) => {
          const pal = key ? palByKey.get(key) : null
          return (
            <div
              key={i}
              className={`card relative flex min-h-[150px] flex-col items-center justify-center gap-2 p-3 text-center transition-colors ${
                pal ? '' : 'border-dashed'
              }`}
            >
              {pal ? (
                <>
                  <button
                    className="absolute right-2 top-2 rounded-lg p-1 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-bad)]"
                    onClick={() => setTeamSlot(i, null)}
                  >
                    <X size={15} />
                  </button>
                  <button onClick={() => setPickerSlot(i)} className="flex flex-col items-center gap-1.5">
                    <PalIcon pal={pal} size={64} ring />
                    <div className="text-sm font-bold">{pal.name}</div>
                    <PalTypeBadges pal={pal} size="sm" />
                  </button>
                  {pal.partnerSkill && (
                    <div className="mt-1 line-clamp-1 text-[11px] text-[var(--color-brand)]">{pal.partnerSkill.title}</div>
                  )}
                </>
              ) : (
                <button onClick={() => setPickerSlot(i)} className="flex flex-col items-center gap-2 text-[var(--color-faint)]">
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-[var(--color-border)]">
                    <Plus size={22} />
                  </span>
                  <span className="text-sm">Ajouter un Pal</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Effets d'équipe */}
      {filled === 0 ? (
        <div className="card grid place-items-center py-16 text-center text-[var(--color-muted)]">
          <Users size={28} className="mb-2 text-[var(--color-faint)]" />
          Ajoute des Pals pour voir leurs partner skills et synergies.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Partner skills détaillés */}
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-brand)]">
              <Sparkles size={16} /> Partner Skills de l'équipe
            </h2>
            <div className="space-y-3">
              {analysis.entries.map((e) => (
                <div key={e.pal.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
                  <div className="flex items-center gap-2">
                    <PalIcon pal={e.pal} size={30} />
                    <div className="font-bold">{e.pal.name}</div>
                    <div className="text-sm text-[var(--color-brand)]">· {e.skill.title}</div>
                    {e.skill.noStack && (
                      <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-warn)]">non cumulable</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{e.skill.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {e.categories.map((c) => (
                      <span key={c.id} className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {analysis.entries.length === 0 && (
                <div className="text-sm text-[var(--color-muted)]">Aucun des Pals sélectionnés n'a de partner skill.</div>
              )}
            </div>
          </section>

          {/* Synergies & cumuls */}
          <div className="space-y-5">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-brand)]">
                <Layers size={16} /> Synergies & cumuls
              </h2>
              {analysis.duplicateWarnings.length > 0 && (
                <div className="mb-3 space-y-2">
                  {analysis.duplicateWarnings.map((w, i) => (
                    <div key={i} className="flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2 text-xs text-[var(--color-warn)]">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {analysis.groups
                  .filter((g) => g.entries.length >= 1)
                  .map((g) => (
                    <div key={g.category.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{g.category.label}</span>
                        {g.stacked ? (
                          <span className="chip bg-[color-mix(in_srgb,var(--color-good)_15%,transparent)] text-[var(--color-good)]">
                            se cumule ×{g.entries.length}
                          </span>
                        ) : g.entries.length >= 2 && !g.category.stacks ? (
                          <span className="chip bg-[var(--color-surface-2)] text-[var(--color-warn)]">ne se cumule pas</span>
                        ) : (
                          <span className="chip bg-[var(--color-surface-2)] text-[var(--color-faint)]">{g.entries.length}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {g.entries.map((e) => (
                          <span key={e.pal.key} className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
                            <PalIcon pal={e.pal} size={16} /> {e.pal.name}
                          </span>
                        ))}
                      </div>
                      {g.note && <div className="mt-1 text-[11px] text-[var(--color-faint)]">{g.note}</div>}
                    </div>
                  ))}
              </div>
            </section>

            {/* Couverture élémentaire + travail */}
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-bold text-[var(--color-brand)]">Couverture & travail</h2>
              <div className="mb-3">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-faint)]">Éléments de l'équipe</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.elementCoverage.map((e) => (
                    <ElementBadge key={e} elementKey={e} size="sm" />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-faint)]">
                  Aptitudes de travail cumulées
                </div>
                {Object.keys(analysis.workTotals).length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(analysis.workTotals)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <WorkBadge key={k} workKey={k} level={v} />
                      ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-muted)]">—</div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <PalPickerModal
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        onSelect={(p: Pal) => {
          if (pickerSlot !== null) setTeamSlot(pickerSlot, p.key)
          setPickerSlot(null)
        }}
        title="Choisir un Pal pour l'équipe"
      />
    </>
  )
}
