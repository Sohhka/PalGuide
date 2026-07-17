import { useState } from 'react'
import type { Pal } from '../lib/types'
import { rarityTier, RARITY_COLOR } from '../lib/pal-helpers'

export function PalIcon({
  pal,
  size = 48,
  ring = false,
  className = '',
}: {
  pal: Pal
  size?: number
  ring?: boolean
  className?: string
}) {
  const [error, setError] = useState(false)
  const color = RARITY_COLOR[rarityTier(pal.rarity)]
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-soft)] ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      {error ? (
        <div className="grid h-full w-full place-items-center text-[var(--color-faint)]" style={{ fontSize: size * 0.4 }}>
          ?
        </div>
      ) : (
        <img
          src={pal.iconUrl}
          alt={pal.name}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setError(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
