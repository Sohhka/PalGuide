import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Plus, Minus, Maximize2 } from 'lucide-react'

const clampK = (k: number) => Math.min(2.5, Math.max(0.2, k))

/** Zone déplaçable + zoomable (molette pour zoomer, glisser pour déplacer).
 *  S'ajuste automatiquement quand l'arbre grandit, tant que l'utilisateur
 *  n'a pas zoomé/déplacé manuellement (le bouton « ajuster » réactive le suivi). */
export function PanZoom({ children, height = '74vh' }: { children: ReactNode; height?: string }) {
  const vpRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ x: 24, y: 16, k: 1 })
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null)
  const [grabbing, setGrabbing] = useState(false)
  // Tant que false, on ré-ajuste automatiquement à chaque changement de taille du contenu.
  const interacted = useRef(false)

  const fit = useCallback(() => {
    const v = vpRef.current
    const c = contentRef.current
    if (!v || !c) return
    const cw = c.scrollWidth || 1
    const ch = c.scrollHeight || 1
    const vw = v.clientWidth
    const vh = v.clientHeight
    const k = clampK(Math.min(1, (vw - 48) / cw, (vh - 48) / ch))
    setT({ x: Math.max(16, (vw - cw * k) / 2), y: 16, k })
  }, [])

  // Ajuste au montage puis à chaque fois que le contenu change de taille (dépliage/repliage),
  // sauf si l'utilisateur a pris la main sur le zoom/déplacement.
  useLayoutEffect(() => {
    const c = contentRef.current
    if (!c) return
    fit()
    const ro = new ResizeObserver(() => {
      if (!interacted.current) fit()
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [fit])

  // Zoom molette (écouteur natif non passif pour pouvoir preventDefault)
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      interacted.current = true
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setT((p) => {
        const k = clampK(p.k * (1 - e.deltaY * 0.0012))
        const r = k / p.k
        return { k, x: mx - (mx - p.x) * r, y: my - (my - p.y) * r }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Déplacement (glisser)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current
      if (!d) return
      setT((p) => ({ ...p, x: d.x + (e.clientX - d.sx), y: d.y + (e.clientY - d.sy) }))
    }
    const onUp = () => {
      drag.current = null
      setGrabbing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onDown = (e: React.MouseEvent) => {
    // Ne pas déplacer si on clique un élément interactif (bouton, lien, select…)
    if ((e.target as HTMLElement).closest('button, a, input, select, [data-nopan]')) return
    interacted.current = true
    drag.current = { sx: e.clientX, sy: e.clientY, x: t.x, y: t.y }
    setGrabbing(true)
  }

  const zoom = (f: number) => {
    interacted.current = true
    setT((p) => {
      const v = vpRef.current
      const cx = (v?.clientWidth ?? 0) / 2
      const cy = (v?.clientHeight ?? 0) / 2
      const k = clampK(p.k * f)
      const r = k / p.k
      return { k, x: cx - (cx - p.x) * r, y: cy - (cy - p.y) * r }
    })
  }

  const resetFit = () => {
    interacted.current = false
    fit()
  }

  return (
    <div
      ref={vpRef}
      onMouseDown={onDown}
      onContextMenu={(e) => e.preventDefault()}
      className="relative select-none overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-soft)]"
      style={{ height, cursor: grabbing ? 'grabbing' : 'grab' }}
    >
      <div
        ref={contentRef}
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: '0 0', width: 'max-content' }}
      >
        {children}
      </div>

      {/* Contrôles */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <button className="btn px-2 py-1.5" onClick={() => zoom(1.2)} title="Zoomer" data-nopan>
          <Plus size={16} />
        </button>
        <button className="btn px-2 py-1.5" onClick={() => zoom(1 / 1.2)} title="Dézoomer" data-nopan>
          <Minus size={16} />
        </button>
        <button className="btn px-2 py-1.5" onClick={resetFit} title="Recentrer / ajuster tout l'arbre" data-nopan>
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 chip bg-[var(--color-surface-2)] text-[var(--color-faint)]">
        {Math.round(t.k * 100)} %
      </div>
      <div className="pointer-events-none absolute left-3 top-3 chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">
        Molette : zoom · Glisser : déplacer
      </div>
    </div>
  )
}
