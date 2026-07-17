import { useMemo, useState } from 'react'
import { Minus, Plus, Info } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges } from '../components/badges'
import { palByKey } from '../data'
import type { Pal } from '../lib/types'
import { captureForAllSpheres } from '../lib/capture'

export function CapturePage() {
  const [pal, setPal] = useState<Pal | null>(palByKey.get('ChickenPal') ?? null)
  const [level, setLevel] = useState(1)
  const [hp, setHp] = useState(100)
  const [capturePower, setCapturePower] = useState(1)

  const rows = useMemo(
    () => (pal ? captureForAllSpheres(pal, { level, hpPercent: hp, capturePower }) : []),
    [pal, level, hp, capturePower],
  )

  return (
    <>
      <PageHeader
        eyebrow="Capture"
        title="Calculateur de taux de capture"
        subtitle="Estime tes chances de capture selon le Pal, son niveau, ses PV restants, la sphère et le bonus dans le dos."
      />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Contrôles */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Pal à capturer</div>
            <PalPickerButton value={pal} onChange={setPal} placeholder="Choisir un Pal" />
            {pal && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
                <PalIcon pal={pal} size={44} ring />
                <div>
                  <div className="font-bold">{pal.name}</div>
                  <div className="flex items-center gap-2">
                    <PalTypeBadges pal={pal} size="sm" />
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-faint)]">
                    Taux de base ×{pal.captureRateCorrect}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card space-y-4 p-4">
            <Slider label="Niveau" value={level} min={1} max={60} onChange={setLevel} />
            <Slider label="PV restants" value={hp} min={1} max={100} suffix="%" onChange={setHp} color="var(--color-warn)" />
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Puissance de capture (effigies)</span>
                <span className="font-bold">{capturePower}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn px-2" onClick={() => setCapturePower((v) => Math.max(1, v - 1))}>
                  <Minus size={16} />
                </button>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                  <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${(capturePower / 20) * 100}%` }} />
                </div>
                <button className="btn px-2" onClick={() => setCapturePower((v) => Math.min(20, v + 1))}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 text-xs text-[var(--color-muted)]">
            <Info size={15} className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
            <p>
              Estimation calibrée sur les valeurs de référence. La formule exacte du jeu n'est pas publiée : baisser les PV
              sous 20 % et frapper dans le dos restent les meilleurs moyens d'augmenter tes chances.
            </p>
          </div>
        </div>

        {/* Résultats */}
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[var(--color-brand)]" /> Taux de capture
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[var(--color-good)]" /> Avec bonus dans le dos
            </span>
          </div>
          {pal ? (
            <div className="space-y-3">
              {rows.map(({ sphere, base, back }) => (
                <div key={sphere.key} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 text-sm font-semibold" style={{ color: sphere.color }}>
                    {sphere.name}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Bar pct={base * 100} color="var(--color-brand)" />
                    <Bar pct={back * 100} color="var(--color-good)" />
                  </div>
                  <div className="w-24 shrink-0 text-right text-sm">
                    <div className="font-bold">{(base * 100).toFixed(1)} %</div>
                    <div className="font-bold text-[var(--color-good)]">{(back * 100).toFixed(1)} %</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[var(--color-muted)]">Choisis un Pal pour voir les taux.</div>
          )}
        </div>
      </div>
    </>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  color = 'var(--color-brand)',
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  suffix?: string
  color?: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className="font-bold">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-brand)]"
        style={{ accentColor: color }}
      />
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-3)]">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}
