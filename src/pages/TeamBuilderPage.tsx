import { useMemo, useState } from 'react'
import { Plus, X, Layers, AlertTriangle, Sparkles, Users, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerModal } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges, WorkBadge, ElementBadge } from '../components/badges'
import { palByKey } from '../data'
import { useStore } from '../store/useStore'
import { analyzeTeam } from '../lib/partnerSkills'
import type { Pal } from '../lib/types'

export function TeamBuilderPage() {
  const { team, setTeamSlot, clearTeam } = useStore()
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)

  const members = useMemo(() => team.map((k) => (k ? palByKey.get(k) ?? null : null)), [team])
  const analysis = useMemo(() => analyzeTeam(members), [members])
  const filled = members.filter(Boolean).length

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
