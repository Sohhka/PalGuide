import { Link } from 'react-router-dom'
import { Plus, Equal } from 'lucide-react'
import { palById } from '../data'
import { PalIcon } from './PalIcon'
import { PalTypeBadges } from './badges'

function PalChip({ id, showTypes = false }: { id: number; showTypes?: boolean }) {
  const pal = palById.get(id)
  if (!pal) return <span>#{id}</span>
  return (
    <Link
      to={`/paldex/${pal.key}`}
      className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-[var(--color-surface-2)]"
    >
      <PalIcon pal={pal} size={34} ring />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{pal.name}</span>
        {showTypes && <span className="block"><PalTypeBadges pal={pal} size="sm" /></span>}
      </span>
    </Link>
  )
}

/** Ligne « Parent1 + Parent2 = Enfant ». */
export function RecipeRow({
  a,
  b,
  child,
  highlightChild = false,
}: {
  a: number
  b: number
  child: number
  highlightChild?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      <div className="min-w-0 flex-1"><PalChip id={a} /></div>
      <Plus size={14} className="shrink-0 text-[var(--color-faint)]" />
      <div className="min-w-0 flex-1"><PalChip id={b} /></div>
      <Equal size={14} className="shrink-0 text-[var(--color-faint)]" />
      <div className={`min-w-0 flex-1 rounded-lg ${highlightChild ? 'bg-[color-mix(in_srgb,var(--color-brand)_12%,transparent)]' : ''}`}>
        <PalChip id={child} />
      </div>
    </div>
  )
}
