import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, Swords, Hammer } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { loadEquipment } from '../data'
import type { EquipData, EquipItem } from '../data'

const RARITY_LABEL = ['Commun', 'Inhabituel', 'Rare', 'Épique', 'Légendaire']
const RARITY_COLOR = ['var(--rar-common)', 'var(--color-good)', 'var(--rar-rare)', 'var(--rar-epic)', 'var(--rar-legendary)']

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Lignes de stats affichées dans le tableau par rareté
const STAT_ROWS: { key: keyof EquipItem['variants'][number]; label: string }[] = [
  { key: 'attack', label: 'Attaque' },
  { key: 'defense', label: 'Défense' },
  { key: 'hp', label: 'PV' },
  { key: 'durability', label: 'Durabilité' },
  { key: 'magazine', label: 'Chargeur' },
  { key: 'weight', label: 'Poids' },
  { key: 'gold', label: "Pièces d'or" },
]

function ItemIcon({ src, size = 28 }: { src: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  if (!src || err) return <div className="grid place-items-center rounded bg-[var(--color-bg-soft)] text-[var(--color-faint)]" style={{ width: size, height: size, fontSize: size * 0.5 }}>?</div>
  return <img src={src} width={size} height={size} alt="" loading="lazy" onError={() => setErr(true)} className="rounded object-contain" />
}

function Detail({ item }: { item: EquipItem }) {
  const variants = item.variants
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <ItemIcon src={item.icon} size={52} />
        <div>
          <h2 className="text-lg font-bold">{item.name}</h2>
          <div className="text-xs text-[var(--color-faint)]">
            {item.category === 'weapon' ? 'Arme' : item.category === 'armor' ? 'Armure' : item.category === 'glider' ? 'Planeur' : 'Accessoire'}
            {item.rank ? ` · Rang techno ${item.rank}` : ''}
          </div>
        </div>
      </div>

      {/* Stats par rareté */}
      {variants.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-faint)]">
                <th className="py-1 pr-3 font-semibold">Stat</th>
                {variants.map((v) => (
                  <th key={v.rarity} className="px-3 py-1 text-right font-bold" style={{ color: RARITY_COLOR[v.rarity] }}>
                    {RARITY_LABEL[v.rarity] ?? v.rarity}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAT_ROWS.filter((r) => variants.some((v) => v[r.key] != null)).map((r) => (
                <tr key={r.key} className="border-t border-[var(--color-border-soft)]">
                  <td className="py-1.5 pr-3 text-[var(--color-muted)]">{r.label}</td>
                  {variants.map((v) => (
                    <td key={v.rarity} className="px-3 py-1.5 text-right font-semibold tabular-nums">
                      {v[r.key] != null ? (v[r.key] as number).toLocaleString('fr-FR') : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recette / matériaux */}
      {item.materials.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-faint)]">
            <Hammer size={13} /> Matériaux de fabrication
          </div>
          <div className="flex flex-wrap gap-2">
            {item.materials.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs">
                <ItemIcon src={m.icon} size={20} /> {m.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function EquipmentPage() {
  const [data, setData] = useState<EquipData | null>(null)
  const [category, setCategory] = useState('weapon')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => { loadEquipment().then(setData) }, [])

  const list = useMemo(() => {
    if (!data) return []
    const q = norm(query.trim())
    return data.items.filter((it) => it.category === category && (!q || norm(it.name).includes(q)))
  }, [data, category, query])

  const current = useMemo(() => data?.items.find((it) => it.slug === selected) ?? list[0] ?? null, [data, selected, list])

  return (
    <>
      <PageHeader
        eyebrow="Équipement"
        title="Armes & armures"
        subtitle="Stats par rareté (Commun → Légendaire) et matériaux de fabrication des armes, armures, planeurs et accessoires."
        actions={<Swords size={20} className="text-[var(--color-brand)]" />}
      />

      {!data ? (
        <div className="card grid place-items-center gap-2 py-20 text-[var(--color-muted)]">
          <Loader2 size={24} className="animate-spin" /> Chargement de l'équipement…
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {data.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCategory(c.id); setSelected(null) }}
                className={`chip border ${category === c.id ? 'border-[var(--color-brand-2)] bg-[color-mix(in_srgb,var(--color-brand)_15%,transparent)] text-[var(--color-brand)]' : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]'}`}
              >
                {c.label} ({data.items.filter((it) => it.category === c.id).length})
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Liste */}
            <div className="card flex max-h-[74vh] flex-col p-3">
              <div className="relative mb-2">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
                <input className="input pl-9" placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                {list.map((it) => (
                  <button
                    key={it.slug}
                    onClick={() => setSelected(it.slug)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${current?.slug === it.slug ? 'bg-[var(--color-surface-3)] text-[var(--color-brand)]' : 'hover:bg-[var(--color-surface-2)]'}`}
                  >
                    <ItemIcon src={it.icon} size={24} />
                    <span className="flex-1 truncate">{it.name}</span>
                    {it.variants.length > 1 && <span className="text-[10px] text-[var(--color-faint)]">{it.variants.length}★</span>}
                  </button>
                ))}
                {list.length === 0 && <div className="p-3 text-sm text-[var(--color-faint)]">Aucun résultat.</div>}
              </div>
            </div>

            {/* Détail */}
            {current ? <Detail item={current} /> : <div className="card grid place-items-center py-16 text-[var(--color-muted)]">Choisis un équipement.</div>}
          </div>

          <p className="mt-3 text-[11px] text-[var(--color-faint)]">Données : paldb.cc.</p>
        </>
      )}
    </>
  )
}
