import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Sparkles } from 'lucide-react'

// Logo de l'app : affiche public/logo.png s'il existe, sinon un repli.
function LogoMark() {
  const [ok, setOk] = useState(true)
  if (ok) {
    return (
      <img
        src="logo.png"
        alt="PalGuide"
        className="h-5 w-5 rounded-[3px] object-contain"
        onError={() => setOk(false)}
      />
    )
  }
  return (
    <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-accent)] text-[#04222c]">
      <Sparkles size={12} />
    </span>
  )
}

export function TitleBar() {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!api) return
    api.isMaximized().then(setMaximized)
    const off = api.onMaximizeChange(setMaximized)
    return off
  }, [api])

  return (
    <div className="drag-region flex h-9 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-soft)]/80 pl-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <LogoMark />
        <span className="text-xs font-extrabold tracking-wide">
          PalGuide
          <span className="ml-2 font-semibold text-[var(--color-faint)]">Palworld 1.0</span>
        </span>
      </div>

      {api && (
        <div className="no-drag flex h-full">
          <button
            className="grid h-full w-11 place-items-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            onClick={() => api.minimize()}
            title="Réduire"
          >
            <Minus size={15} />
          </button>
          <button
            className="grid h-full w-11 place-items-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            onClick={() => api.toggleMaximize()}
            title={maximized ? 'Restaurer' : 'Agrandir'}
          >
            {maximized ? <Copy size={13} /> : <Square size={12} />}
          </button>
          <button
            className="grid h-full w-11 place-items-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-bad)] hover:text-white"
            onClick={() => api.close()}
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
