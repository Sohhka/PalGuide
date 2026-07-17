import { Modal } from './Modal'
import { PalDetail } from './PalDetail'
import { PalTypeBadges } from './badges'
import { PalIcon } from './PalIcon'
import type { Pal } from '../lib/types'
import { palDexLabel } from '../lib/pal-helpers'

export function PalDetailModal({ pal, onClose }: { pal: Pal | null; onClose: () => void }) {
  return (
    <Modal
      open={!!pal}
      onClose={onClose}
      maxWidth="64rem"
      title={
        pal ? (
          <div className="flex items-center gap-2.5">
            <PalIcon pal={pal} size={30} ring />
            <span>{pal.name}</span>
            <span className="text-xs font-semibold text-[var(--color-faint)]">{palDexLabel(pal)}</span>
            <PalTypeBadges pal={pal} size="sm" />
          </div>
        ) : undefined
      }
    >
      {pal && <PalDetail pal={pal} onNavigate={onClose} />}
    </Modal>
  )
}
