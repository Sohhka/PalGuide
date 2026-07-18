import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronDown, Loader2, Egg, Check, Sparkles, Target as TargetIcon, Wand2, AlertTriangle } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { PassivePicker, PassiveChip, passiveRankColor } from '../components/PassivePicker'
import { RecipeSelect } from '../components/RecipeSelect'
import { RecipeRow } from '../components/RecipeRow'
import { PanZoom } from '../components/PanZoom'
import { useBreedingGraph } from '../lib/useBreedingGraph'
import { pals, palByKey, palById, passives } from '../data'
import type { BreedingGraph } from '../data'
import type { Pal, ImportedPal } from '../lib/types'
import { combosForChild, computeShortestSteps, buildOptimalTree, treeToSteps } from '../lib/breeding'
import { useStore } from '../store/useStore'
import { palsOfPlayer, importByKey, ownedKeysFromImport } from '../lib/savedata'

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

  // ---- Chemin automatique ----
  const owned = useStore((s) => s.owned)
  const [autoOpen, setAutoOpen] = useState(false)
  const [allowUnowned, setAllowUnowned] = useState(false)

  const ownedIdSet = useMemo(() => {
    const keys = new Set([...owned, ...ownedKeysFromImport(importedSave, selectedPlayerUid)])
    const s = new Set<number>()
    for (const k of keys) {
      const p = palByKey.get(k)
      if (p) s.add(p.id)
    }
    return s
  }, [owned, importedSave, selectedPlayerUid])

  const auto = useMemo(() => {
    if (!autoOpen || !target || !graph) return null
    const available = allowUnowned ? new Set(pals.map((p) => p.id)) : ownedIdSet
    if (available.size === 0) return { empty: true as const }
    const steps = computeShortestSteps(graph, available)
    if (!steps.dist.has(target.id)) return { unreachable: true as const }
    const tree = buildOptimalTree(steps, target.id, available)
    const chain = tree ? treeToSteps(tree) : []
    // Feuilles (Pals de départ) = parents jamais produits comme enfant
    const childrenIds = new Set(chain.map((s) => s.childId))
    const leaves = [...new Set(chain.flatMap((s) => [s.a, s.b]))].filter((id) => !childrenIds.has(id))
    const missingLeaves = leaves.filter((id) => !ownedIdSet.has(id))
    // Talents manquants (aucun Pal possédé ne les a)
    const missingPassives = desired.filter((pk) => !myPals.some((p) => p.passives.includes(pk)))
    return { chain, leaves, missingLeaves, missingPassives, available }
  }, [autoOpen, allowUnowned, target, graph, ownedIdSet, desired, myPals])

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

      {/* Chemin automatique */}
      {target && graph && (
        <div className="card mb-5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="hud-h flex items-center gap-2 text-sm">
              <Wand2 size={15} /> Chemin automatique vers {target.name}
            </h2>
            <div className="flex items-center gap-2">
              <label className="chip cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  className="accent-[var(--color-brand)]"
                  checked={allowUnowned}
                  onChange={(e) => setAllowUnowned(e.target.checked)}
                />
                Inclure les Pals à capturer
              </label>
              <button className="btn btn-brand" onClick={() => setAutoOpen(true)}>
                <Wand2 size={15} /> Générer
              </button>
            </div>
          </div>

          {!autoOpen ? (
            <p className="text-sm text-[var(--color-muted)]">
              Construit la chaîne d'élevage la plus courte vers <b className="text-[var(--color-ink)]">{target.name}</b> à
              partir des Pals que tu possèdes (importe ta partie dans « Ma partie »). Ajoute des talents ci-dessus pour le
              plan des talents.
            </p>
          ) : auto && 'empty' in auto ? (
            <WarningBox>
              Il te manque des Pals de départ (aucun Pal importé).{' '}
              <button className="font-bold underline" onClick={() => setAllowUnowned(true)}>
                Inclure les Pals à capturer
              </button>{' '}
              pour construire quand même le chemin, ou importe ta partie.
            </WarningBox>
          ) : auto && 'unreachable' in auto ? (
            <p className="text-sm text-[var(--color-muted)]">Ce Pal ne s'obtient pas par reproduction.</p>
          ) : auto ? (
            <div className="space-y-3">
              {auto.missingPassives.length > 0 && (
                <WarningBox>
                  <span className="flex flex-wrap items-center gap-1.5">
                    Talents introuvables dans ta partie :
                    {auto.missingPassives.map((pk) => (
                      <PassiveChip key={pk} passiveKey={pk} />
                    ))}
                    — capture un Pal qui les porte pour les injecter.
                  </span>
                </WarningBox>
              )}
              {auto.missingLeaves.length > 0 && (
                <WarningBox>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Il te manque {auto.missingLeaves.length} Pal(s) de départ — à capturer :</span>
                    {auto.missingLeaves.map((id) => {
                      const p = palById.get(id)
                      return p ? (
                        <span key={id} className="inline-flex items-center gap-1">
                          <PalIcon pal={p} size={16} /> {p.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </WarningBox>
              )}

              <div className="flex items-center gap-2">
                <span className="chip bg-[var(--color-surface-2)] text-[var(--color-brand)]">
                  {auto.chain.length} élevage{auto.chain.length > 1 ? 's' : ''}
                </span>
                <span className="text-sm text-[var(--color-muted)]">Chaîne la plus courte</span>
              </div>

              {auto.chain.length === 0 ? (
                <p className="text-sm text-[var(--color-good)]">Tu possèdes déjà {target.name} !</p>
              ) : (
                <ol className="space-y-2">
                  {auto.chain.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-3 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-brand)]">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <RecipeRow a={step.a} b={step.b} child={step.childId} highlightChild={step.childId === target.id} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {auto.leaves.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border-soft)] pt-2 text-xs">
                  <span className="text-[var(--color-faint)]">Pals de départ :</span>
                  {auto.leaves.map((id) => {
                    const p = palById.get(id)
                    if (!p) return null
                    const isOwned = ownedIdSet.has(id)
                    return (
                      <span
                        key={id}
                        className="chip"
                        style={{
                          color: isOwned ? 'var(--color-good)' : 'var(--color-warn)',
                          background: 'var(--color-surface-2)',
                        }}
                      >
                        <PalIcon pal={p} size={16} /> {p.name} {isOwned ? '✓' : '· à capturer'}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
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
        <div className="card overflow-hidden">
          <PanZoom>
            <ul className="ftree p-10">
              <BreedNode graph={graph} palId={target.id} ancestors={[]} depth={0} desired={desiredSet} myByKey={myByKey} isRoot />
            </ul>
          </PanZoom>
        </div>
      )}
    </>
  )
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2.5 text-sm text-[var(--color-warn)]">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
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
  const comboText = recipe ? `${palById.get(recipe[0])?.name} + ${palById.get(recipe[1])?.name}` : ''

  return (
    <li>
      <div className="inline-flex flex-col items-center align-top">
        {/* Carte du Pal */}
        <div
          className={`w-[164px] border p-2 text-center ${
            isRoot
              ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]'
              : owned
                ? 'border-[color-mix(in_srgb,var(--color-good)_55%,transparent)] bg-[var(--color-surface)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
          title={canExpand ? `Issu de : ${comboText}` : undefined}
        >
          <Link to={`/paldex/${pal.key}`} className="inline-block">
            <PalIcon pal={pal} size={44} ring />
          </Link>
          <div className="mt-1 flex items-center justify-center gap-1 text-sm font-bold leading-tight">
            {pal.name}
            {isRoot && <Egg size={12} className="text-[var(--color-brand)]" />}
          </div>
          <div className="mt-0.5 flex flex-wrap justify-center gap-1">
            <PalTypeBadges pal={pal} size="sm" />
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {owned ? (
              <span className="chip bg-[color-mix(in_srgb,var(--color-good)_15%,transparent)] text-[10px] text-[var(--color-good)]">
                <Check size={10} /> possédé ×{instances.length}
              </span>
            ) : (
              <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">à obtenir</span>
            )}
            {desired.size > 0 && owned && (
              <span
                className={`chip text-[10px] ${hits > 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-faint)]'}`}
                style={{ background: 'var(--color-surface-2)' }}
              >
                {hits}/{desired.size} talents
              </span>
            )}
          </div>
          {best && best.passives.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-1">
              {best.passives.map((pk) => {
                const info = passives[pk]
                const isDesired = desired.has(pk)
                const color = passiveRankColor(info?.rank ?? 1)
                return (
                  <span
                    key={pk}
                    className="chip text-[9px]"
                    style={{
                      color: isDesired ? '#04222c' : color,
                      background: isDesired ? color : `color-mix(in srgb, ${color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                    }}
                    title={info?.description ?? undefined}
                  >
                    {isDesired && <Check size={8} />} {info?.name ?? pk}
                  </span>
                )
              })}
            </div>
          )}
          {cycle && <div className="mt-1 text-[10px] text-[var(--color-faint)]">↺ boucle</div>}
        </div>

        {/* Contrôles : déplier + choix de recette */}
        {canExpand && (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1 border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-brand)]"
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {expanded ? 'Masquer' : combos.length > 1 ? `${combos.length} recettes` : 'Déplier'}
            </button>
            {expanded && combos.length > 1 && (
              <RecipeSelect combos={combos} value={recipeIdx} onChange={setRecipeIdx} />
            )}
          </div>
        )}
      </div>

      {canExpand && expanded && recipe && (
        <ul>
          <BreedNode graph={graph} palId={recipe[0]} ancestors={[...ancestors, palId]} depth={depth + 1} desired={desired} myByKey={myByKey} />
          <BreedNode graph={graph} palId={recipe[1]} ancestors={[...ancestors, palId]} depth={depth + 1} desired={desired} myByKey={myByKey} />
        </ul>
      )}
    </li>
  )
}
