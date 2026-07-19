import { useEffect, useMemo, useState } from 'react'
import { Search, Package, ArrowRight, Gift, ScrollText, Loader2, Coins } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { PalDetailModal } from '../components/PalDetailModal'
import { buildFullItemIndex, itemMatches, type ItemEntry } from '../lib/items'
import { loadItemsCatalog } from '../data'
import type { Pal } from '../lib/types'

const RARITY_LABEL = ['Commun', 'Inhabituel', 'Rare', 'Épique', 'Légendaire']
const RARITY_COLOR = ['#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24']
const CAT_LABEL: Record<string, string> = {
  Material: 'Matériaux', Weapon: 'Armes', Armor: 'Armures', Consumable: 'Consommables',
  Food: 'Nourriture', Accessory: 'Accessoires', Essential: 'Objets clés', Glider: 'Planeurs',
  'Sphere Modifier': 'Modif. sphère', 'Pal Weapon': 'Arme de Pal',
}
const catLabel = (c?: string) => (c ? CAT_LABEL[c] ?? c : 'Autres')
const LIMIT = 300

export function ItemsPage() {
  const [items, setItems] = useState<ItemEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [modalPal, setModalPal] = useState<Pal | null>(null)

  useEffect(() => {
    loadItemsCatalog().then((catalog) => {
      const idx = buildFullItemIndex(catalog)
      setItems(idx)
      setSelectedKey(idx[0]?.key ?? '')
      setLoading(false)
    })
  }, [])

  const cats = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) if (it.cat != null) s.add(it.cat)
    return [...s].sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'fr'))
  }, [items])

  const filtered = useMemo(
    () => items.filter((it) => (!cat || it.cat === cat || (cat === '__plan' && it.schematic)) && itemMatches(it, q)),
    [items, q, cat],
  )
  const displayed = filtered.slice(0, LIMIT)
  const selected = useMemo(() => items.find((it) => it.key === selectedKey) ?? null, [items, selectedKey])

  return (
    <>
      <PageHeader
        eyebrow="Objets"
        title="Encyclopédie des objets"
        subtitle="Tous les objets de Palworld : description, prix, recette, et les Pals/boss qui les lâchent."
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Liste */}
        <div className="card flex max-h-[calc(100vh-220px)] flex-col p-3">
          <div className="relative mb-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
            <input className="input pl-9" placeholder="Rechercher un objet…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input mb-2" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {cats.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
            <option value="__plan">Plans (schematics)</option>
          </select>
          <div className="mb-1.5 px-1 text-xs text-[var(--color-faint)]">
            {loading ? 'Chargement…' : `${filtered.length} objet${filtered.length > 1 ? 's' : ''}${filtered.length > LIMIT ? ` · ${LIMIT} affichés` : ''}`}
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {loading && <div className="grid place-items-center py-10 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>}
            {displayed.map((it) => (
              <button
                key={it.key}
                onClick={() => setSelectedKey(it.key)}
                className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${
                  it.key === selectedKey ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]' : 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-surface)]'
                }`}
              >
                <ItemIcon src={it.iconUrl} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{it.name}</span>
                  <span className="text-[10px]" style={{ color: RARITY_COLOR[it.schematic?.rarity ?? it.rarity ?? 0] }}>
                    {it.schematic ? 'Plan' : catLabel(it.cat)}
                  </span>
                </span>
                {it.sources.length > 0 && (
                  <span className="shrink-0 chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-brand)]" title="Lâché par des Pals">{it.sources.length}🐾</span>
                )}
              </button>
            ))}
            {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-[var(--color-muted)]">Aucun objet trouvé.</div>}
          </div>
        </div>

        {/* Détail */}
        <div>
          {selected ? (
            <ItemDetail entry={selected} onPal={setModalPal} />
          ) : (
            <div className="card grid place-items-center py-20 text-center text-[var(--color-muted)]">Choisis un objet dans la liste.</div>
          )}
        </div>
      </div>

      <PalDetailModal pal={modalPal} onClose={() => setModalPal(null)} />
    </>
  )
}

function ItemDetail({ entry, onPal }: { entry: ItemEntry; onPal: (pal: Pal) => void }) {
  if (entry.schematic) return <SchematicDetail entry={entry} onPal={onPal} />

  const rarity = entry.rarity ?? 0
  const color = RARITY_COLOR[rarity]
  const base = entry.sources.filter((s) => s.levelGate == null)
  const tiered = entry.sources.filter((s) => s.levelGate != null)

  return (
    <div className="space-y-4">
      {/* En-tête : icône + nom + catégorie + rareté */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <ItemIcon src={entry.iconUrl} size={56} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-extrabold tracking-tight text-[var(--color-brand)]">{entry.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="chip bg-[var(--color-surface-2)] text-[11px] text-[var(--color-muted)]">{catLabel(entry.cat)}</span>
              <span className="chip text-[11px] font-bold" style={{ color, borderColor: color + '55' }}>{RARITY_LABEL[rarity]}</span>
              {entry.nameEn && <span className="text-[11px] text-[var(--color-faint)]">{entry.nameEn}</span>}
            </div>
          </div>
        </div>

        {entry.desc && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--color-muted)]">{entry.desc}</p>}

        {entry.price != null && (
          <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-border-soft)] pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-faint)]">Prix</span>
            <span className="flex items-center gap-1.5 font-bold tabular-nums text-[var(--color-warn)]"><Coins size={15} /> {entry.price.toLocaleString('fr-FR')}</span>
          </div>
        )}
      </div>

      {/* Recette */}
      {entry.recipe && entry.recipe.length > 0 && (
        <section className="card p-4">
          <h3 className="hud-h mb-3 text-sm">Recette</h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {entry.recipe.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2.5 py-1.5">
                <ItemIcon src={m.icon} size={26} />
                {m.qty != null && <span className="shrink-0 font-bold tabular-nums text-[var(--color-ink)]">{m.qty}</span>}
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-muted)]">{m.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <SourceTable title="Lâché par (Pals)" sources={base} onPal={onPal} />
      {tiered.length > 0 && <SourceTable title="Drops de boss / haut niveau" sources={tiered} onPal={onPal} showGate />}
    </div>
  )
}

function SchematicDetail({ entry, onPal }: { entry: ItemEntry; onPal: (pal: Pal) => void }) {
  const sch = entry.schematic!
  const rarity = sch.rarity ?? 0
  const color = RARITY_COLOR[rarity]

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4 p-5" style={{ borderColor: color + '55' }}>
        <ItemIcon src={entry.iconUrl} size={56} fallback={<ScrollText size={28} />} />
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="chip text-[11px] font-bold" style={{ color, borderColor: color + '55' }}>Plan · {RARITY_LABEL[rarity]}</span>
            {sch.treasureBox && <span className="chip flex items-center gap-1 text-[11px] text-[var(--color-muted)]"><Gift size={12} /> Aussi en coffre</span>}
          </div>
          <h2 className="truncate text-2xl font-extrabold tracking-tight" style={{ color }}>{entry.name}</h2>
          <div className="text-sm text-[var(--color-muted)]">
            Lâché par <b className="text-[var(--color-ink)]">{sch.droppers.length}</b> boss / Pal{sch.droppers.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <section className="card p-4">
        <h3 className="hud-h mb-3 text-sm">Lâché par</h3>
        <div className="space-y-1.5">
          {sch.droppers.map((d, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-[var(--color-border-soft)] py-1.5 first:border-t-0">
              {d.pal ? (
                <button onClick={() => onPal(d.pal!)} className="group flex flex-1 items-center gap-2.5 text-left" title="Voir la fiche">
                  <PalIcon pal={d.pal} size={34} ring />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-[var(--color-brand)]">
                      {d.bossName}
                      <ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="block"><PalTypeBadges pal={d.pal} size="sm" /></span>
                  </span>
                </button>
              ) : (
                <span className="flex flex-1 items-center gap-2.5">
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-faint)]"><Package size={16} /></span>
                  <span className="text-sm font-semibold">{d.bossName}</span>
                </span>
              )}
              <span className="shrink-0 chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">Boss</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SourceTable({ title, sources, onPal, showGate = false }: {
  title: string
  sources: ItemEntry['sources']
  onPal: (pal: Pal) => void
  showGate?: boolean
}) {
  if (sources.length === 0) return null
  return (
    <section className="card p-4">
      <h3 className="hud-h mb-3 text-sm">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-faint)]">
              <th className="pb-2 font-semibold">Pal</th>
              {showGate && <th className="pb-2 font-semibold">Palier</th>}
              <th className="pb-2 font-semibold">Quantité</th>
              <th className="pb-2 text-right font-semibold">Taux</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => (
              <tr key={i} className="border-t border-[var(--color-border-soft)]">
                <td className="py-1.5">
                  <button onClick={() => onPal(s.pal)} className="group flex items-center gap-2 text-left" title="Voir la fiche">
                    <PalIcon pal={s.pal} size={30} ring />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-[var(--color-brand)]">
                        {s.pal.name}
                        <ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      <span className="block"><PalTypeBadges pal={s.pal} size="sm" /></span>
                    </span>
                  </button>
                </td>
                {showGate && <td className="py-1.5"><span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">Niv.{s.levelGate}</span></td>}
                <td className="py-1.5 text-sm text-[var(--color-muted)]">{s.quantity ?? '—'}</td>
                <td className="py-1.5 text-right text-sm font-bold">{s.rate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ItemIcon({ src, size = 28, fallback }: { src: string | null; size?: number; fallback?: React.ReactNode }) {
  const [err, setErr] = useState(false)
  if (!src || err) return <span className="grid shrink-0 place-items-center text-[var(--color-faint)]" style={{ width: size, height: size }}>{fallback ?? <Package size={size * 0.55} />}</span>
  return <img src={src} width={size} height={size} alt="" className="shrink-0" loading="lazy" onError={() => setErr(true)} />
}
