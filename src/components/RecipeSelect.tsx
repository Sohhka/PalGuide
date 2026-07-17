import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { palById } from '../data'
import { PalIcon } from './PalIcon'

function PairMini({ a, b, size = 20 }: { a: number; b: number; size?: number }) {
  const pa = palById.get(a)
  const pb = palById.get(b)
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
      {pa && <PalIcon pal={pa} size={size} />}
      <span className="truncate">{pa?.name}</span>
      <Plus size={12} className="shrink-0 text-[var(--color-faint)]" />
      {pb && <PalIcon pal={pb} size={size} />}
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
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const cur = combos[Math.min(value, combos.length - 1)]

  useLayoutEffect(() => {
    if (!open) return
    const update = () => btnRef.current && setRect(btnRef.current.getBoundingClientRect())
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  if (!cur) return null

  // Position du menu (au-dessus si pas assez de place en dessous)
  const WIDTH = 340
  const MAXH = 380
  let style: React.CSSProperties = {}
  if (rect) {
    const left = Math.min(rect.left, window.innerWidth - WIDTH - 8)
    const below = window.innerHeight - rect.bottom
    const openUp = below < 240 && rect.top > below
    style = {
      position: 'fixed',
      left: Math.max(8, left),
      width: WIDTH,
      maxHeight: Math.min(MAXH, openUp ? rect.top - 12 : below - 12),
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[300px] items-center gap-2 border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2.5 py-2 transition-colors hover:border-[var(--color-brand)]"
        title="Choisir la recette"
      >
        <PairMini a={cur[0]} b={cur[1]} />
        {combos.length > 1 && <ChevronDown size={14} className="ml-auto shrink-0 text-[var(--color-faint)]" />}
      </button>

      {open &&
        combos.length > 1 &&
        rect &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <div className="card z-[71] overflow-y-auto p-1 shadow-2xl" style={style}>
              <div className="border-b border-[var(--color-border-soft)] px-2 py-1 text-[11px] text-[var(--color-faint)]">
                {combos.length} recettes
              </div>
              {combos.map(([a, b], i) => (
                <button
                  key={i}
                  onClick={() => {
                    onChange(i)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-surface-2)] ${
                    i === value ? 'bg-[var(--color-surface-2)]' : ''
                  }`}
                >
                  <PairMini a={a} b={b} size={24} />
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
