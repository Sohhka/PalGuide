import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalCard } from '../components/PalCard'
import { PalDetailModal } from '../components/PalDetailModal'
import { PalHoverPreview } from '../components/PalHoverPreview'
import { pals, palsSortedByDex, elements, workLabels } from '../data'
import { palMatches, rarityTier, totalWork } from '../lib/pal-helpers'
import type { Pal, RarityTier } from '../lib/types'

type SortKey = 'dex' | 'name' | 'rarity' | 'hp' | 'attack' | 'defense' | 'breeding' | 'work'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'dex', label: 'N° Paldex' },
  { key: 'name', label: 'Nom' },
  { key: 'rarity', label: 'Rareté' },
  { key: 'hp', label: 'PV' },
  { key: 'attack', label: 'Attaque' },
  { key: 'defense', label: 'Défense' },
  { key: 'breeding', label: 'Breeding power' },
  { key: 'work', label: 'Aptitude travail' },
]

const RARITIES: { key: RarityTier; label: string }[] = [
  { key: 'common', label: 'Commun' },
  { key: 'rare', label: 'Rare' },
  { key: 'epic', label: 'Épique' },
  { key: 'legendary', label: 'Légendaire' },
]

export function PaldexPage() {
  const [q, setQ] = useState('')
  const [els, setEls] = useState<Set<string>>(new Set())
  const [rars, setRars] = useState<Set<RarityTier>>(new Set())
  const [work, setWork] = useState<string>('')
  const [sort, setSort] = useState<SortKey>('dex')
  const [showFilters, setShowFilters] = useState(true)
  const [hovered, setHovered] = useState<{ pal: Pal; rect: DOMRect } | null>(null)
  const [selected, setSelected] = useState<Pal | null>(null)

  const toggle = <T,>(set: Set<T>, val: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set)
    next.has(val) ? next.delete(val) : next.add(val)
    setter(next)
  }

  const results = useMemo(() => {
    let list = palsSortedByDex.filter((p) => {
      if (!palMatches(p, q)) return false
      if (els.size && !p.elements.some((e) => els.has(e))) return false
      if (rars.size && !rars.has(rarityTier(p.rarity))) return false
      if (work && !(p.work[work] > 0)) return false
      return true
    })
    const cmp: Record<SortKey, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      dex: (a, b) => (a.dex ?? 9999) - (b.dex ?? 9999),
      name: (a, b) => a.name.localeCompare(b.name),
      rarity: (a, b) => b.rarity - a.rarity,
      hp: (a, b) => b.stats.hp - a.stats.hp,
      attack: (a, b) => Math.max(b.stats.meleeAttack, b.stats.shotAttack) - Math.max(a.stats.meleeAttack, a.stats.shotAttack),
      defense: (a, b) => b.stats.defense - a.stats.defense,
      breeding: (a, b) => b.breedingPower - a.breedingPower,
      work: (a, b) => (work ? (b.work[work] ?? 0) - (a.work[work] ?? 0) : totalWork(b) - totalWork(a)),
    }
    return [...list].sort(cmp[sort])
  }, [q, els, rars, work, sort])

  const activeFilters = els.size + rars.size + (work ? 1 : 0)

  return (
    <>
      <PageHeader
        eyebrow="Paldex"
        title="Tous les Pals"
        subtitle={`${pals.length} Pals de Palworld 1.0. Clique sur un Pal pour ouvrir sa fiche complète.`}
        actions={
          <button className="btn" onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal size={16} />
            Filtres{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        }
      />

      {/* Barre de recherche + tri */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
          <input className="input pl-9" placeholder="Rechercher un Pal (nom ou n°)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-muted)]">Trier&nbsp;:</span>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Panneau filtres */}
      {showFilters && (
        <div className="card mb-5 space-y-4 p-4">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-faint)]">Élément</div>
            <div className="flex flex-wrap gap-1.5">
              {elements.map((el) => {
                const on = els.has(el.key)
                return (
                  <button
                    key={el.key}
                    onClick={() => toggle(els, el.key, setEls)}
                    className="chip transition-all"
                    style={{
                      color: on ? '#0a0f1c' : el.color,
                      background: on ? el.color : `color-mix(in srgb, ${el.color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${el.color} 45%, transparent)`,
                    }}
                  >
                    {el.iconUrl && <img src={el.iconUrl} alt="" width={14} height={14} />}
                    {el.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-faint)]">Rareté</div>
              <div className="flex flex-wrap gap-1.5">
                {RARITIES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => toggle(rars, r.key, setRars)}
                    className={`chip border ${rars.has(r.key) ? 'bg-[var(--color-brand)] text-[#05202a]' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-faint)]">Aptitude de travail</div>
              <select className="input w-auto" value={work} onChange={(e) => setWork(e.target.value)}>
                <option value="">Toutes</option>
                {Object.entries(workLabels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeFilters > 0 && (
            <button
              className="inline-flex items-center gap-1 text-sm text-[var(--color-brand)] hover:underline"
              onClick={() => {
                setEls(new Set())
                setRars(new Set())
                setWork('')
              }}
            >
              <X size={14} /> Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="mb-3 text-sm text-[var(--color-muted)]">
        {results.length} résultat{results.length > 1 ? 's' : ''}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {results.map((p) => (
          <PalCard
            key={p.key}
            pal={p}
            onOpen={setSelected}
            onHover={(pal, rect) => setHovered({ pal, rect })}
            onLeave={() => setHovered(null)}
            selected={selected?.key === p.key}
          />
        ))}
      </div>
      {results.length === 0 && (
        <div className="card grid place-items-center py-16 text-center text-[var(--color-muted)]">
          Aucun Pal ne correspond à ces critères.
        </div>
      )}

      {hovered && !selected && <PalHoverPreview pal={hovered.pal} rect={hovered.rect} />}
      <PalDetailModal pal={selected} onClose={() => setSelected(null)} />
    </>
  )
}
