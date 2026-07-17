import { useMemo, useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { palsSortedByDex, palByKey } from '../data'
import { palMatches, palDexLabel } from '../lib/pal-helpers'
import type { Pal } from '../lib/types'
import { Modal } from './Modal'
import { PalIcon } from './PalIcon'
import { PalTypeBadges } from './badges'

export function PalPickerButton({
  value,
  onChange,
  placeholder = 'Choisir un Pal',
  filter,
  allowClear = true,
  className = '',
}: {
  value: Pal | null
  onChange: (pal: Pal | null) => void
  placeholder?: string
  filter?: (p: Pal) => boolean
  allowClear?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className={`flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-brand)] ${className}`}
        onClick={() => setOpen(true)}
      >
        {value ? (
          <>
            <PalIcon pal={value} size={36} ring />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{value.name}</span>
              <span className="block truncate text-xs text-[var(--color-faint)]">{palDexLabel(value)}</span>
            </span>
          </>
        ) : (
          <>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-faint)]">
              +
            </span>
            <span className="flex-1 text-[var(--color-muted)]">{placeholder}</span>
          </>
        )}
        <ChevronDown size={16} className="text-[var(--color-faint)]" />
      </button>

      <PalPickerModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(p) => {
          onChange(p)
          setOpen(false)
        }}
        onClear={
          allowClear && value
            ? () => {
                onChange(null)
                setOpen(false)
              }
            : undefined
        }
        filter={filter}
        title={placeholder}
      />
    </>
  )
}

export function PalPickerModal({
  open,
  onClose,
  onSelect,
  onClear,
  filter,
  title = 'Choisir un Pal',
}: {
  open: boolean
  onClose: () => void
  onSelect: (pal: Pal) => void
  onClear?: () => void
  filter?: (p: Pal) => boolean
  title?: string
}) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    let list = palsSortedByDex
    if (filter) list = list.filter(filter)
    if (q.trim()) list = list.filter((p) => palMatches(p, q))
    return list
  }, [q, filter])

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="46rem">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
          <input
            autoFocus
            className="input pl-9"
            placeholder="Rechercher un Pal (nom ou n°)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {onClear && (
          <button className="btn" onClick={onClear}>
            Vider
          </button>
        )}
      </div>
      <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {results.map((p) => (
          <button
            key={p.key}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-left transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-3)]"
            onClick={() => onSelect(p)}
          >
            <PalIcon pal={p} size={38} ring />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="mt-0.5 block"><PalTypeBadges pal={p} size="sm" /></span>
            </span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-[var(--color-muted)]">Aucun Pal trouvé.</div>
        )}
      </div>
    </Modal>
  )
}

export { palByKey }
