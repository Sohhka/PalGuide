import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Egg, Route, Shuffle, Plus, Equal, Network, X, Loader2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton, PalPickerModal } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { RecipeRow } from '../components/RecipeRow'
import { useBreedingGraph } from '../lib/useBreedingGraph'
import { pals, palByKey, palById } from '../data'
import type { Pal } from '../lib/types'
import { useStore } from '../store/useStore'
import {
  combosForChild,
  childForPair,
  computeShortestSteps,
  buildOptimalTree,
  treeToSteps,
} from '../lib/breeding'
import { ownedKeysFromImport } from '../lib/savedata'

type Tab = 'calc' | 'combos' | 'path'

export function BreedingPage() {
  const graph = useBreedingGraph()
  const [params, setParams] = useSearchParams()
  const childParam = params.get('child')
  const [tab, setTab] = useState<Tab>(childParam ? 'combos' : 'calc')

  return (
    <>
      <PageHeader
        eyebrow="Breeding"
        title="Calculateur de reproduction"
        subtitle="Combine deux Pals, trouve toutes les recettes d'un Pal, ou calcule le chemin d'élevage complet depuis les Pals que tu possèdes."
        actions={
          <Link to="/breeding/arbre" className="btn">
            <Network size={16} /> Arbre de breeding
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <TabBtn active={tab === 'calc'} onClick={() => setTab('calc')} icon={<Shuffle size={15} />}>
          Calculateur
        </TabBtn>
        <TabBtn active={tab === 'combos'} onClick={() => setTab('combos')} icon={<Egg size={15} />}>
          Combinaisons pour un Pal
        </TabBtn>
        <TabBtn active={tab === 'path'} onClick={() => setTab('path')} icon={<Route size={15} />}>
          Chemin complet (Path Finder)
        </TabBtn>
      </div>

      {!graph ? (
        <div className="card grid place-items-center gap-2 py-16 text-[var(--color-muted)]">
          <Loader2 className="animate-spin" />
          Chargement du graphe de reproduction…
        </div>
      ) : tab === 'calc' ? (
        <ForwardCalc graph={graph} />
      ) : tab === 'combos' ? (
        <CombosFinder graph={graph} childParam={childParam} onChild={(k) => setParams(k ? { child: k } : {})} />
      ) : (
        <PathFinder graph={graph} />
      )}
    </>
  )
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-transparent bg-gradient-to-b from-[var(--color-brand)] to-[var(--color-brand-2)] text-[#05202a]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

/* ------------------------------ Calculateur direct ------------------------------ */
function ForwardCalc({ graph }: { graph: NonNullable<ReturnType<typeof useBreedingGraph>> }) {
  const [p1, setP1] = useState<Pal | null>(null)
  const [p2, setP2] = useState<Pal | null>(null)
  const childId = p1 && p2 ? childForPair(graph, p1.id, p2.id) : null
  const child = childId != null ? palById.get(childId) : null

  return (
    <div className="card p-5">
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <PalPickerButton value={p1} onChange={setP1} placeholder="Parent 1 ♂" />
        <Plus className="mx-auto hidden text-[var(--color-faint)] sm:block" />
        <PalPickerButton value={p2} onChange={setP2} placeholder="Parent 2 ♀" />
        <Equal className="mx-auto hidden text-[var(--color-faint)] sm:block" />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
          {child ? (
            <Link to={`/paldex/${child.key}`} className="flex items-center gap-3">
              <PalIcon pal={child} size={48} ring />
              <div>
                <div className="font-bold">{child.name}</div>
                <PalTypeBadges pal={child} size="sm" />
              </div>
            </Link>
          ) : (
            <div className="py-3 text-center text-sm text-[var(--color-muted)]">
              {p1 && p2 ? 'Aucun enfant pour cette paire.' : 'Choisis deux parents'}
            </div>
          )}
        </div>
      </div>
      {child && (
        <div className="mt-3 text-center text-xs text-[var(--color-faint)]">
          Astuce : l'ordre et le genre des parents n'ont pas d'importance pour le résultat.
        </div>
      )}
    </div>
  )
}

/* --------------------------- Combinaisons pour un Pal --------------------------- */
function CombosFinder({
  graph,
  childParam,
  onChild,
}: {
  graph: NonNullable<ReturnType<typeof useBreedingGraph>>
  childParam: string | null
  onChild: (key: string | null) => void
}) {
  const [target, setTarget] = useState<Pal | null>(childParam ? palByKey.get(childParam) ?? null : null)
  useEffect(() => {
    if (childParam) setTarget(palByKey.get(childParam) ?? null)
  }, [childParam])

  const combos = useMemo(() => (target ? combosForChild(graph, target.id) : []), [graph, target])

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Quel Pal veux-tu obtenir ?</div>
        <div className="max-w-md">
          <PalPickerButton
            value={target}
            onChange={(p) => {
              setTarget(p)
              onChild(p?.key ?? null)
            }}
            placeholder="Choisir le Pal à obtenir"
          />
        </div>
      </div>

      {target && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-muted)]">
              <b className="text-[var(--color-ink)]">{combos.length}</b> recette{combos.length > 1 ? 's' : ''} pour obtenir{' '}
              <b className="text-[var(--color-brand)]">{target.name}</b>
            </div>
            <Link to={`/breeding/arbre?target=${target.key}`} className="btn">
              <Network size={15} /> Explorer l'arbre
            </Link>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {combos.map(([a, b], i) => (
              <RecipeRow key={i} a={a} b={b} child={target.id} highlightChild />
            ))}
          </div>
          {combos.length === 0 && (
            <div className="card py-10 text-center text-[var(--color-muted)]">
              Aucune recette : ce Pal ne s'obtient pas par reproduction (uniquement capture / événement).
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* --------------------------------- Path finder --------------------------------- */
function PathFinder({ graph }: { graph: NonNullable<ReturnType<typeof useBreedingGraph>> }) {
  const { owned, toggleOwned, setOwned, importedSave, selectedPlayerUid } = useStore()
  const [target, setTarget] = useState<Pal | null>(null)
  const [pickOwned, setPickOwned] = useState(false)

  const importedKeys = useMemo(
    () => ownedKeysFromImport(importedSave, selectedPlayerUid),
    [importedSave, selectedPlayerUid],
  )

  const addCommons = () => {
    const commons = pals.filter((p) => p.rarity <= 4).map((p) => p.key)
    setOwned([...new Set([...owned, ...commons])])
  }

  // Pals disponibles = possédés manuellement ∪ Pals de la save importée
  const ownedIds = useMemo(() => {
    const s = new Set<number>()
    for (const k of new Set([...owned, ...importedKeys])) {
      const p = palByKey.get(k)
      if (p) s.add(p.id)
    }
    return s
  }, [owned, importedKeys])

  const result = useMemo(() => {
    if (!target || ownedIds.size === 0) return null
    const steps = computeShortestSteps(graph, ownedIds)
    if (!steps.dist.has(target.id)) return { reachable: false, tree: null, chain: [] as ReturnType<typeof treeToSteps> }
    const tree = buildOptimalTree(steps, target.id, ownedIds)
    const chain = tree ? treeToSteps(tree) : []
    return { reachable: true, tree, chain }
  }, [graph, target, ownedIds])

  return (
    <div className="space-y-4">
      {/* Pals possédés */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--color-muted)]">
            Tes Pals ({owned.length}
            {importedKeys.length > 0 && (
              <span className="text-[var(--color-brand)]"> + {importedKeys.length} de ta save</span>
            )}
            )
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setPickOwned(true)}>
              <Plus size={15} /> Ajouter
            </button>
            <button className="btn" onClick={addCommons} title="Ajoute tous les Pals communs (faciles à obtenir)">
              + Communs
            </button>
            {owned.length > 0 && (
              <button className="btn" onClick={() => setOwned([])}>
                Vider
              </button>
            )}
          </div>
        </div>
        {owned.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Ajoute les Pals que tu possèdes (ou peux capturer facilement). Le path finder trouvera le chemin d'élevage le plus court vers ta cible.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {owned.map((k) => {
              const p = palByKey.get(k)
              if (!p) return null
              return (
                <span key={k} className="chip bg-[var(--color-surface-2)] border border-[var(--color-border)] pr-1">
                  <PalIcon pal={p} size={20} />
                  {p.name}
                  <button className="ml-0.5 rounded p-0.5 hover:bg-[var(--color-surface-3)]" onClick={() => toggleOwned(k)}>
                    <X size={12} />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Cible */}
      <div className="card p-4">
        <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Pal à obtenir</div>
        <div className="max-w-md">
          <PalPickerButton value={target} onChange={setTarget} placeholder="Choisir la cible" />
        </div>
      </div>

      {/* Résultat */}
      {target && ownedIds.size === 0 && (
        <div className="card py-8 text-center text-[var(--color-muted)]">Ajoute d'abord au moins un Pal que tu possèdes.</div>
      )}
      {result && !result.reachable && (
        <div className="card py-8 text-center text-[var(--color-muted)]">
          Impossible d'atteindre <b className="text-[var(--color-ink)]">{target!.name}</b> par reproduction à partir de tes Pals actuels. Ajoute d'autres Pals de départ.
        </div>
      )}
      {result && result.reachable && (
        <PathResult chain={result.chain} target={target!} />
      )}

      <PalPickerModal
        open={pickOwned}
        onClose={() => setPickOwned(false)}
        onSelect={(p) => toggleOwned(p.key)}
        title="Ajouter des Pals possédés (clique pour ajouter/retirer)"
      />
    </div>
  )
}

function PathResult({
  chain,
  target,
}: {
  chain: ReturnType<typeof treeToSteps>
  target: Pal
}) {
  if (chain.length === 0) {
    return (
      <div className="card py-8 text-center">
        <div className="text-lg font-bold text-[var(--color-good)]">Tu possèdes déjà {target.name} !</div>
        <div className="text-sm text-[var(--color-muted)]">Aucune reproduction nécessaire.</div>
      </div>
    )
  }
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="chip bg-[var(--color-surface-2)] text-[var(--color-brand)]">{chain.length} élevage{chain.length > 1 ? 's' : ''}</span>
        <span className="text-sm text-[var(--color-muted)]">Chemin le plus court vers {target.name}</span>
      </div>
      {chain.length > 12 && (
        <div className="mb-3 flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)] p-2.5 text-xs text-[var(--color-warn)]">
          <span>💡</span>
          <span>
            Chaîne longue : tu possèdes peu de Pals de départ. Ajoute-en davantage (bouton «&nbsp;+ Communs&nbsp;») pour un chemin plus court.
          </span>
        </div>
      )}
      <ol className="space-y-2">
        {chain.map((step, i) => {
          const isFinal = step.childId === target.id
          return (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-3 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-brand)]">
                {i + 1}
              </span>
              <div className="flex-1">
                <RecipeRow a={step.a} b={step.b} child={step.childId} highlightChild={isFinal} />
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-[var(--color-faint)]">
        Les Pals de départ (que tu possèdes) servent de feuilles ; chaque étape produit un nouveau Pal réutilisé plus bas.
      </p>
    </div>
  )
}
