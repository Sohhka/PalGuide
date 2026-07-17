import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronDown, Loader2, Egg, Check, Sparkles, Target as TargetIcon } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { PassivePicker, PassiveChip, passiveRankColor } from '../components/PassivePicker'
import { RecipeSelect } from '../components/RecipeSelect'
import { useBreedingGraph } from '../lib/useBreedingGraph'
import { palByKey, palById, passives } from '../data'
import type { BreedingGraph } from '../data'
import type { Pal, ImportedPal } from '../lib/types'
import { combosForChild } from '../lib/breeding'
import { useStore } from '../store/useStore'
import { palsOfPlayer, importByKey } from '../lib/savedata'

export function BreedingTreePage() {
  const graph = useBreedingGraph()
  const [params, setParams] = useSearchParams()
  const targetKey = params.get('target')
  const [target, setTarget] = useState<Pal | null>(targetKey ? palByKey.get(targetKey) ?? null : null)
  const [desired, setDesired] = useState<string[]>([])

  const { importedSave, selectedPlayerUid } = useStore()
  const myPals = useMemo(() => palsOfPlayer(importedSave, selectedPlayerUid), [importedSave, selectedPlayerUid])
  const myByKey = useMemo(() => importByKey(importedSave, selectedPlayerUid), [importedSave, selectedPlayerUid])
  const desiredSet = useMemo(() => new Set(desired), [desired])

  useEffect(() => {
    if (targetKey) setTarget(palByKey.get(targetKey) ?? null)
  }, [targetKey])

  // Donneurs : pour chaque talent souhaité, tes Pals qui le possèdent
  const donors = useMemo(
    () =>
      desired.map((pk) => ({
        passive: pk,
        instances: myPals.filter((p) => p.passives.includes(pk)),
      })),
    [desired, myPals],
  )
  const covered = donors.filter((d) => d.instances.length > 0).length

  return (
    <>
      <PageHeader
        eyebrow="Breeding"
        title="Arbre de reproduction"
        subtitle="Déplie chaque Pal en ses combinaisons de parents. Choisis les talents visés et repère, parmi tes Pals, ceux qui les portent."
        actions={
          <Link to="/breeding" className="btn">
            ← Calculateur
          </Link>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* Cible */}
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Pal à obtenir</div>
          <PalPickerButton
            value={target}
            onChange={(p) => {
              setTarget(p)
              setParams(p ? { target: p.key } : {})
            }}
            placeholder="Choisir le Pal cible"
          />
        </div>

        {/* Talents souhaités */}
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)]">
            <Sparkles size={15} className="text-[var(--color-brand)]" /> Talents souhaités sur le Pal final
          </div>
          <PassivePicker value={desired} onChange={setDesired} max={4} />
        </div>
      </div>

      {/* Analyse des donneurs (si save importée + talents choisis) */}
      {desired.length > 0 && (
        <div className="card mb-5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-brand)]">
            <TargetIcon size={16} /> Où trouver ces talents
            {importedSave && (
              <span className="chip bg-[var(--color-surface-2)] text-[var(--color-faint)]">
                {covered}/{desired.length} disponibles dans ta partie
              </span>
            )}
          </div>
          {!importedSave ? (
            <p className="text-sm text-[var(--color-muted)]">
              Importe ta sauvegarde (onglet <Link to="/ma-partie" className="text-brand">Ma partie</Link>) pour voir
              lesquels de tes Pals possèdent ces talents.
            </p>
          ) : (
            <div className="space-y-2">
              {donors.map((d) => (
                <div key={d.passive} className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border-soft)] pb-2 last:border-0">
                  <PassiveChip passiveKey={d.passive} />
                  {d.instances.length === 0 ? (
                    <span className="text-xs text-[var(--color-faint)]">Aucun de tes Pals ne l'a — à capturer / faire apparaître.</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {[...new Map(d.instances.map((i) => [i.palKey, i])).values()].slice(0, 8).map((inst, i) => {
                        const p = inst.palKey ? palByKey.get(inst.palKey) : null
                        if (!p) return null
                        const n = d.instances.filter((x) => x.palKey === inst.palKey).length
                        return (
                          <span key={i} className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
                            <PalIcon pal={p} size={18} /> {p.name}
                            {n > 1 && <span className="text-[var(--color-faint)]">×{n}</span>}
                          </span>
                        )
                      })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!target ? (
        <div className="card grid place-items-center py-16 text-center text-[var(--color-muted)]">
          Choisis un Pal pour construire son arbre de reproduction.
        </div>
      ) : !graph ? (
        <div className="card grid place-items-center gap-2 py-16 text-[var(--color-muted)]">
          <Loader2 className="animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="card overflow-x-auto p-4">
          <BreedNode graph={graph} palId={target.id} ancestors={[]} depth={0} desired={desiredSet} myByKey={myByKey} isRoot />
        </div>
      )}
    </>
  )
}

function bestInstance(instances: ImportedPal[], desired: Set<string>): ImportedPal | null {
  if (!instances.length) return null
  return [...instances]
    .map((i) => ({ i, hits: i.passives.filter((p) => desired.has(p)).length }))
    .sort((a, b) => b.hits - a.hits)[0].i
}

function BreedNode({
  graph,
  palId,
  ancestors,
  depth,
  desired,
  myByKey,
  isRoot = false,
}: {
  graph: BreedingGraph
  palId: number
  ancestors: number[]
  depth: number
  desired: Set<string>
  myByKey: Map<string, ImportedPal[]>
  isRoot?: boolean
}) {
  const pal = palById.get(palId)
  const combos = combosForChild(graph, palId)
  const instances = pal ? myByKey.get(pal.key) ?? [] : []
  const owned = instances.length > 0
  const cycle = ancestors.includes(palId)
  const canExpand = combos.length > 0 && !cycle && depth < 8
  const [expanded, setExpanded] = useState(isRoot)
  const [recipeIdx, setRecipeIdx] = useState(0)

  if (!pal) return null
  const recipe = combos[Math.min(recipeIdx, combos.length - 1)]
  const best = bestInstance(instances, desired)
  const hits = best ? best.passives.filter((p) => desired.has(p)).length : 0

  return (
    <div className="relative">
      <div className="flex items-start gap-2 py-1">
        {canExpand ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-brand)]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center text-[var(--color-faint)]">·</span>
        )}

        <div
          className={`min-w-0 border px-2 py-1.5 ${
            isRoot
              ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]'
              : owned
                ? 'border-[color-mix(in_srgb,var(--color-good)_45%,transparent)] bg-[var(--color-surface)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Link to={`/paldex/${pal.key}`}>
              <PalIcon pal={pal} size={34} ring />
            </Link>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                {pal.name}
                {isRoot && <Egg size={13} className="text-[var(--color-brand)]" />}
                {owned ? (
                  <span className="chip bg-[color-mix(in_srgb,var(--color-good)_15%,transparent)] text-[10px] text-[var(--color-good)]">
                    <Check size={10} /> possédé ×{instances.length}
                  </span>
                ) : (
                  <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">à obtenir</span>
                )}
                {desired.size > 0 && owned && (
                  <span className={`chip text-[10px] ${hits > 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-faint)]'}`} style={{ background: 'var(--color-surface-2)' }}>
                    {hits}/{desired.size} talents visés
                  </span>
                )}
              </span>
              <PalTypeBadges pal={pal} size="sm" />
            </span>
          </div>

          {/* Talents du Pal possédé (le meilleur exemplaire) */}
          {best && best.passives.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {best.passives.map((pk) => {
                const info = passives[pk]
                const isDesired = desired.has(pk)
                const color = passiveRankColor(info?.rank ?? 1)
                return (
                  <span
                    key={pk}
                    className="chip text-[10px]"
                    style={{
                      color: isDesired ? '#04222c' : color,
                      background: isDesired ? color : `color-mix(in srgb, ${color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                    }}
                    title={info?.description ?? undefined}
                  >
                    {isDesired && <Check size={9} />} {info?.name ?? pk}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {canExpand && combos.length > 1 && expanded && (
          <div className="mt-1">
            <RecipeSelect combos={combos} value={recipeIdx} onChange={setRecipeIdx} />
          </div>
        )}
        {cycle && <span className="mt-2 text-xs text-[var(--color-faint)]">↺ boucle</span>}
      </div>

      {canExpand && expanded && recipe && (
        <div className="ml-3 border-l border-[var(--color-border)] pl-4">
          <BreedNode graph={graph} palId={recipe[0]} ancestors={[...ancestors, palId]} depth={depth + 1} desired={desired} myByKey={myByKey} />
          <BreedNode graph={graph} palId={recipe[1]} ancestors={[...ancestors, palId]} depth={depth + 1} desired={desired} myByKey={myByKey} />
        </div>
      )}
    </div>
  )
}
