import { useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { palById } from '../data'
import { PalIcon } from './PalIcon'

function PairMini({ a, b }: { a: number; b: number }) {
  const pa = palById.get(a)
  const pb = palById.get(b)
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
      {pa && <PalIcon pal={pa} size={20} />}
      <span className="truncate">{pa?.name}</span>
      <Plus size={11} className="shrink-0 text-[var(--color-faint)]" />
      {pb && <PalIcon pal={pb} size={20} />}
      <span className="truncate">{pb?.name}</span>
    </span>
  )
}

/** Sélecteur de recette (paire de parents) avec les têtes des Pals. */
export function RecipeSelect({
  combos,
  value,
  onChange,
}: {
  combos: [number, number][]
  value: number
  onChange: (i: number) => void
}) {
  const [open, setOpen] = useState(false)
  const cur = combos[Math.min(value, combos.length - 1)]
  if (!cur) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[280px] items-center gap-2 border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2 py-1.5 transition-colors hover:border-[var(--color-brand)]"
        title="Choisir la recette"
      >
        <PairMini a={cur[0]} b={cur[1]} />
        {combos.length > 1 && <ChevronDown size={14} className="ml-auto shrink-0 text-[var(--color-faint)]" />}
      </button>

      {open && combos.length > 1 && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 max-h-72 min-w-full overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            {combos.map(([a, b], i) => (
              <button
                key={i}
                onClick={() => {
                  onChange(i)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-2)] ${
                  i === value ? 'bg-[var(--color-surface-2)]' : ''
                }`}
              >
                <PairMini a={a} b={b} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
