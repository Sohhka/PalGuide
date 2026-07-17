import { createPortal } from 'react-dom'
import type { Pal } from '../lib/types'
import { PalIcon } from './PalIcon'
import { PalTypeBadges, RarityBadge, WorkBadge } from './badges'
import { palDexLabel } from '../lib/pal-helpers'

// Petit aperçu façon jeu : infos de base au survol d'un Pal.
export function PalHoverPreview({ pal, rect }: { pal: Pal; rect: DOMRect }) {
  const W = 260
  const margin = 10
  let left = rect.right + margin
  if (left + W > window.innerWidth - 8) left = rect.left - W - margin
  if (left < 8) left = 8
  let top = rect.top
  const H = 250
  if (top + H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - H - 8)

  const topWork = Object.entries(pal.work).sort((a, b) => b[1] - a[1]).slice(0, 4)

  return createPortal(
    <div
      className="card pointer-events-none fixed z-[60] p-3 shadow-2xl"
      style={{ left, top, width: W }}
    >
      <div className="flex items-center gap-2.5">
        <PalIcon pal={pal} size={46} ring />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold">{pal.name}</span>
          </div>
          <div className="text-[11px] text-[var(--color-faint)]">{palDexLabel(pal)} · {pal.genus ?? '—'}</div>
          <div className="mt-1"><RarityBadge rarity={pal.rarity} /></div>
        </div>
      </div>

      <div className="mt-2"><PalTypeBadges pal={pal} size="sm" /></div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <Stat label="PV" value={pal.stats.hp} />
        <Stat label="ATQ" value={Math.max(pal.stats.meleeAttack, pal.stats.shotAttack)} />
        <Stat label="DÉF" value={pal.stats.defense} />
      </div>

      {topWork.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {topWork.map(([k, v]) => (
            <WorkBadge key={k} workKey={k} level={v} />
          ))}
        </div>
      )}

      {pal.partnerSkill && (
        <div className="mt-2 border-t border-[var(--color-border-soft)] pt-2 text-[11px]">
          <span className="font-bold text-[var(--color-brand)]">{pal.partnerSkill.title}</span>
        </div>
      )}
      <div className="mt-1.5 text-center text-[10px] text-[var(--color-faint)]">Cliquer pour tous les détails</div>
    </div>,
    document.body,
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--color-border-soft)] bg-[var(--color-bg-soft)] py-1">
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-faint)]">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  )
}
