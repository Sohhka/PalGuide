export function StatBar({
  label,
  value,
  max,
  color = 'var(--color-brand)',
  suffix,
}: {
  label: string
  value: number
  max: number
  color?: string
  suffix?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-soft)] px-3 py-2">
      <div className="w-28 shrink-0 text-sm text-[var(--color-muted)]">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, #fff 10%))` }}
        />
      </div>
      <div className="w-12 shrink-0 text-right font-bold tabular-nums">
        {value}
        {suffix}
      </div>
    </div>
  )
}
