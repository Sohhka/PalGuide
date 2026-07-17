import type { Pal } from '../lib/types'
import { PalIcon } from './PalIcon'
import { ElementDot, RarityBadge } from './badges'
import { palDexLabel } from '../lib/pal-helpers'

export function PalCard({
  pal,
  onOpen,
  onHover,
  onLeave,
  selected = false,
}: {
  pal: Pal
  onOpen: (pal: Pal) => void
  onHover?: (pal: Pal, rect: DOMRect) => void
  onLeave?: () => void
  selected?: boolean
}) {
  return (
    <button
      onClick={() => onOpen(pal)}
      onMouseEnter={(e) => onHover?.(pal, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onLeave?.()}
      className={`hud-corners group relative flex flex-col items-center gap-2 border bg-[var(--color-surface)] p-3 text-center transition-colors ${
        selected ? 'is-active border-[var(--color-brand)]' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
      }`}
    >
      <div className="absolute left-2 top-2 flex gap-1">
        {pal.elements.map((e) => (
          <ElementDot key={e} elementKey={e} />
        ))}
      </div>
      <div className="absolute right-2 top-2 text-[10px] font-semibold text-[var(--color-faint)]">{palDexLabel(pal)}</div>
      <PalIcon pal={pal} size={66} ring />
      <div className="w-full">
        <div className="truncate text-sm font-bold">{pal.name}</div>
        <div className="mt-1 flex justify-center">
          <RarityBadge rarity={pal.rarity} />
        </div>
      </div>
    </button>
  )
}
