import { useMemo, useState } from 'react'
import { Search, Package, ArrowRight, Gift, ScrollText } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { PalDetailModal } from '../components/PalDetailModal'
import { getItemIndex, itemMatches, type ItemEntry } from '../lib/items'
import type { Pal } from '../lib/types'

const RARITY_LABEL = ['Commun', 'Inhabituel', 'Rare', 'Épique', 'Légendaire']
const RARITY_COLOR = ['#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24']

/** Nombre de sources d'un objet (Pals qui le lâchent, ou boss droppeurs pour un plan). */
const sourceCount = (it: ItemEntry) => (it.schematic ? it.schematic.droppers.length : it.sources.length)

export function ItemsPage() {
  const items = useMemo(() => getItemIndex(), [])
  const [q, setQ] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>(items[0]?.key ?? '')
  const [modalPal, setModalPal] = useState<Pal | null>(null)

  const filtered = useMemo(() => items.filter((it) => itemMatches(it, q)), [items, q])
  const selected = useMemo(
    () => items.find((it) => it.key === selectedKey) ?? null,
    [items, selectedKey],
  )

  return (
    <>
      <PageHeader
        eyebrow="Objets"
        title="Où trouver un objet"
        subtitle="Cherche un objet pour voir tous les Pals qui le lâchent, avec la quantité et le taux de drop. Inclut les plans d'armes/armures lâchés par les boss."
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Liste des objets */}
        <div className="card flex max-h-[calc(100vh-220px)] flex-col p-3">
          <div className="relative mb-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
            <input
              className="input pl-9"
              placeholder="Rechercher un objet…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mb-1.5 px-1 text-xs text-[var(--color-faint)]">{filtered.length} objet{filtered.length > 1 ? 's' : ''}</div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {filtered.map((it) => (
              <button
                key={it.key}
                onClick={() => setSelectedKey(it.key)}
                className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${
                  it.key === selectedKey
                    ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]'
                    : 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-surface)]'
                }`}
              >
                {it.iconUrl ? (
                  <img src={it.iconUrl} alt="" width={28} height={28} className="shrink-0" />
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center text-[var(--color-faint)]"><Package size={16} /></span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.name}</span>
                {it.schematic && (
                  <span
                    className="shrink-0 chip text-[10px] font-bold"
                    style={{ color: RARITY_COLOR[it.schematic.rarity ?? 0], borderColor: RARITY_COLOR[it.schematic.rarity ?? 0] + '55' }}
                  >
                    Plan
                  </span>
                )}
                <span className="shrink-0 chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">
                  {sourceCount(it)}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--color-muted)]">Aucun objet trouvé.</div>
            )}
          </div>
        </div>

        {/* Détail de l'objet sélectionné */}
        <div>
          {selected ? (
            <ItemDetail entry={selected} onPal={setModalPal} />
          ) : (
            <div className="card grid place-items-center py-20 text-center text-[var(--color-muted)]">
              Choisis un objet dans la liste.
            </div>
          )}
        </div>
      </div>

      <PalDetailModal pal={modalPal} onClose={() => setModalPal(null)} />
    </>
  )
}

function ItemDetail({ entry, onPal }: { entry: ItemEntry; onPal: (pal: Pal) => void }) {
  if (entry.schematic) return <SchematicDetail entry={entry} onPal={onPal} />

  const base = entry.sources.filter((s) => s.levelGate == null)
  const tiered = entry.sources.filter((s) => s.levelGate != null)

  return (
    <div className="space-y-4">
      {/* En-tête objet */}
      <div className="card flex items-center gap-4 p-5">
        {entry.iconUrl ? (
          <img src={entry.iconUrl} alt="" width={56} height={56} className="shrink-0" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center text-[var(--color-faint)]"><Package size={28} /></span>
        )}
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-brand)]">{entry.name}</h2>
          <div className="text-sm text-[var(--color-muted)]">
            Lâché par <b className="text-[var(--color-ink)]">{new Set(entry.sources.map((s) => s.pal.key)).size}</b> Pal
            {new Set(entry.sources.map((s) => s.pal.key)).size > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <SourceTable title="Sources principales" sources={base} onPal={onPal} />
      {tiered.length > 0 && (
        <SourceTable title="Drops de boss / haut niveau" sources={tiered} onPal={onPal} showGate />
      )}
    </div>
  )
}

function SchematicDetail({ entry, onPal }: { entry: ItemEntry; onPal: (pal: Pal) => void }) {
  const sch = entry.schematic!
  const rarity = sch.rarity ?? 0
  const color = RARITY_COLOR[rarity]

  return (
    <div className="space-y-4">
      {/* En-tête plan */}
      <div className="card flex items-center gap-4 p-5" style={{ borderColor: color + '55' }}>
        {entry.iconUrl ? (
          <img src={entry.iconUrl} alt="" width={56} height={56} className="shrink-0" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center text-[var(--color-faint)]"><ScrollText size={28} /></span>
        )}
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="chip text-[11px] font-bold" style={{ color, borderColor: color + '55' }}>
              Plan · {RARITY_LABEL[rarity]}
            </span>
            {sch.treasureBox && (
              <span className="chip flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                <Gift size={12} /> Aussi en coffre
              </span>
            )}
          </div>
          <h2 className="truncate text-2xl font-extrabold tracking-tight" style={{ color }}>{entry.name}</h2>
          <div className="text-sm text-[var(--color-muted)]">
            Lâché par <b className="text-[var(--color-ink)]">{sch.droppers.length}</b> boss / Pal{sch.droppers.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Boss / Pals qui lâchent le plan */}
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

function SourceTable({
  title,
  sources,
  onPal,
  showGate = false,
}: {
  title: string
  sources: ReturnType<typeof getItemIndex>[number]['sources']
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
                  <button
                    onClick={() => onPal(s.pal)}
                    className="group flex items-center gap-2 text-left"
                    title="Voir la fiche"
                  >
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
                {showGate && (
                  <td className="py-1.5">
                    <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">Niv.{s.levelGate}</span>
                  </td>
                )}
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
