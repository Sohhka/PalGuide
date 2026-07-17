import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronDown, Loader2, Egg, Check } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { useBreedingGraph } from '../lib/useBreedingGraph'
import { palByKey, palById } from '../data'
import type { BreedingGraph } from '../data'
import type { Pal } from '../lib/types'
import { combosForChild } from '../lib/breeding'
import { useStore } from '../store/useStore'

export function BreedingTreePage() {
  const graph = useBreedingGraph()
  const [params, setParams] = useSearchParams()
  const targetKey = params.get('target')
  const [target, setTarget] = useState<Pal | null>(targetKey ? palByKey.get(targetKey) ?? null : null)

  useEffect(() => {
    if (targetKey) setTarget(palByKey.get(targetKey) ?? null)
  }, [targetKey])

  return (
    <>
      <PageHeader
        eyebrow="Breeding"
        title="Arbre de reproduction"
        subtitle="Déplie chaque Pal en ses combinaisons de parents, niveau par niveau, jusqu'aux Pals que tu possèdes."
        actions={
          <Link to="/breeding" className="btn">
            ← Calculateur
          </Link>
        }
      />

      <div className="card mb-5 p-4">
        <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Pal à obtenir</div>
        <div className="max-w-md">
          <PalPickerButton
            value={target}
            onChange={(p) => {
              setTarget(p)
              setParams(p ? { target: p.key } : {})
            }}
            placeholder="Choisir le Pal cible"
          />
        </div>
      </div>

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
          <BreedNode graph={graph} palId={target.id} ancestors={[]} depth={0} isRoot />
        </div>
      )}
    </>
  )
}

function BreedNode({
  graph,
  palId,
  ancestors,
  depth,
  isRoot = false,
}: {
  graph: BreedingGraph
  palId: number
  ancestors: number[]
  depth: number
  isRoot?: boolean
}) {
  const pal = palById.get(palId)
  const { isOwned } = useStore()
  const combos = combosForChild(graph, palId)
  const owned = pal ? isOwned(pal.key) : false
  const cycle = ancestors.includes(palId)
  const canExpand = combos.length > 0 && !owned && !cycle && depth < 8
  const [expanded, setExpanded] = useState(isRoot)
  const [recipeIdx, setRecipeIdx] = useState(0)

  if (!pal) return null
  const recipe = combos[Math.min(recipeIdx, combos.length - 1)]

  return (
    <div className="relative">
      <div className="flex items-center gap-2 py-1">
        {canExpand ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="grid h-6 w-6 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-brand)]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="grid h-6 w-6 place-items-center text-[var(--color-faint)]">
            {owned ? <Check size={14} className="text-[var(--color-good)]" /> : '·'}
          </span>
        )}

        <Link
          to={`/paldex/${pal.key}`}
          className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors hover:border-[var(--color-brand)] ${
            isRoot ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
        >
          <PalIcon pal={pal} size={36} ring />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-bold">
              {pal.name}
              {owned && <span className="chip bg-[var(--color-surface-3)] text-[10px] text-[var(--color-good)]">possédé</span>}
              {isRoot && <Egg size={13} className="text-[var(--color-brand)]" />}
            </span>
            <PalTypeBadges pal={pal} size="sm" />
          </span>
        </Link>

        {canExpand && combos.length > 1 && expanded && (
          <select
            className="input w-auto py-1 text-xs"
            value={recipeIdx}
            onChange={(e) => setRecipeIdx(Number(e.target.value))}
            title="Choisir la recette"
          >
            {combos.map(([a, b], i) => (
              <option key={i} value={i}>
                {palById.get(a)?.name} + {palById.get(b)?.name}
              </option>
            ))}
          </select>
        )}
        {cycle && <span className="text-xs text-[var(--color-faint)]">↺ boucle</span>}
      </div>

      {canExpand && expanded && recipe && (
        <div className="ml-3 border-l border-[var(--color-border)] pl-4">
          <BreedNode graph={graph} palId={recipe[0]} ancestors={[...ancestors, palId]} depth={depth + 1} />
          <BreedNode graph={graph} palId={recipe[1]} ancestors={[...ancestors, palId]} depth={depth + 1} />
        </div>
      )}
    </div>
  )
}
