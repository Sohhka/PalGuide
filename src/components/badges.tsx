import { elementByKey, workLabels, workIcons } from '../data'
import { rarityTier, RARITY_LABEL, RARITY_COLOR } from '../lib/pal-helpers'
import type { Pal } from '../lib/types'

export function ElementBadge({ elementKey, size = 'md' }: { elementKey: string; size?: 'sm' | 'md' }) {
  const el = elementByKey.get(elementKey)
  if (!el) return null
  const small = size === 'sm'
  return (
    <span
      className="chip"
      style={{
        color: el.color,
        background: `color-mix(in srgb, ${el.color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${el.color} 40%, transparent)`,
        fontSize: small ? '0.66rem' : undefined,
        padding: small ? '0.1rem 0.45rem' : undefined,
      }}
      title={el.name}
    >
      {el.iconUrl && <img src={el.iconUrl} alt="" width={small ? 12 : 15} height={small ? 12 : 15} />}
      {el.name}
    </span>
  )
}

export function ElementDot({ elementKey, size = 18 }: { elementKey: string; size?: number }) {
  const el = elementByKey.get(elementKey)
  if (!el) return null
  if (el.iconUrl) {
    return (
      <img
        src={el.iconUrl}
        alt={el.name}
        title={el.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', filter: `drop-shadow(0 0 3px ${el.color}66)` }}
      />
    )
  }
  return (
    <span
      title={el.name}
      style={{ display: 'inline-block', width: size, height: size, borderRadius: 999, background: el.color }}
    />
  )
}

export function RarityBadge({ rarity }: { rarity: number }) {
  const tier = rarityTier(rarity)
  const color = RARITY_COLOR[tier]
  return (
    <span
      className="chip"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    >
      {RARITY_LABEL[tier]}
    </span>
  )
}

export function WorkBadge({ workKey, level }: { workKey: string; level: number }) {
  const icon = workIcons[workKey]
  const label = workLabels[workKey] || workKey
  return (
    <span className="chip bg-[var(--color-surface-2)] border border-[var(--color-border)]" title={`${label} Niv. ${level}`}>
      {icon && <img src={icon} alt="" width={16} height={16} />}
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-bold text-[var(--color-ink)]">{level}</span>
    </span>
  )
}

/** Rangée d'étoiles de condensation (0..4). */
export function StarRow({ stars, size = 11 }: { stars: number; size?: number }) {
  const n = Math.max(0, Math.min(4, Math.round(stars)))
  return (
    <span
      className="inline-flex items-center leading-none text-[var(--color-brand)]"
      style={{ fontSize: size }}
      title={`${n} étoile${n > 1 ? 's' : ''} de condensation`}
      aria-label={`${n} étoiles`}
    >
      {'★'.repeat(n)}
      <span className="text-[var(--color-faint)] opacity-50">{'★'.repeat(4 - n)}</span>
    </span>
  )
}

export function PalTypeBadges({ pal, size = 'md' }: { pal: Pal; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {pal.elements.map((e) => (
        <ElementBadge key={e} elementKey={e} size={size} />
      ))}
    </span>
  )
}
