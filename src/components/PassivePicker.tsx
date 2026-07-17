import { useMemo, useState } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { standardPassives, passives } from '../data'

export function passiveRankColor(rank: number): string {
  if (rank >= 4) return '#ffb638' // or / légende
  if (rank >= 3) return '#4ade80' // vert
  if (rank >= 1) return '#4fcdec' // cyan
  return '#f4736f' // rouge (négatif)
}

export function PassiveChip({ passiveKey, onRemove }: { passiveKey: string; onRemove?: () => void }) {
  const p = passives[passiveKey]
  const name = p?.name ?? passiveKey
  const color = passiveRankColor(p?.rank ?? 1)
  return (
    <span
      className="chip"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      }}
      title={p?.description ?? undefined}
    >
      {name}
      {onRemove && (
        <button className="ml-0.5 rounded p-0.5 hover:bg-[var(--color-surface-3)]" onClick={(e) => { e.stopPropagation(); onRemove() }}>
          <X size={11} />
        </button>
      )}
    </span>
  )
}

export function PassivePicker({
  value,
  onChange,
  max = 4,
}: {
  value: string[]
  onChange: (keys: string[]) => void
  max?: number
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    return standardPassives
      .filter((p) => !value.includes(p.key))
      .filter((p) => !query || p.name.toLowerCase().includes(query))
      .slice(0, 40)
  }, [q, value])

  const canAdd = value.length < max

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {value.map((k) => (
          <PassiveChip key={k} passiveKey={k} onRemove={() => onChange(value.filter((x) => x !== k))} />
        ))}
        {value.length === 0 && <span className="text-sm text-[var(--color-faint)]">Aucun talent sélectionné</span>}
      </div>

      {canAdd && (
        <div className="relative">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
            <input
              className="input pl-9"
              placeholder={`Ajouter un talent (${value.length}/${max})…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
          </div>
          {open && results.length > 0 && (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
              {results.map((p) => (
                <button
                  key={p.key}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-surface-2)]"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange([...value, p.key])
                    setQ('')
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Plus size={13} className="text-[var(--color-faint)]" />
                    <span className="text-sm font-semibold" style={{ color: passiveRankColor(p.rank) }}>{p.name}</span>
                  </span>
                  {p.description && <span className="max-w-[55%] truncate text-[11px] text-[var(--color-faint)]">{p.description.split('\n')[0]}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
