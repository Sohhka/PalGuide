import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[var(--color-faint)]">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

