import { useMemo, useState } from 'react'
import { MapPin, Home, Castle } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PanZoom } from '../components/PanZoom'
import { useStore } from '../store/useStore'
import { basesFromImport, fastTravelUnlocked } from '../lib/savedata'
import mapData from '../data/map.json'

interface FastTravel {
  guid: string
  id: string
  name: string
  fx: number
  fy: number
}
interface Tower {
  guid: string
  name: string
  fx: number
  fy: number
}
const MAP = mapData as unknown as {
  image: string
  fastTravel: FastTravel[]
  towers: Tower[]
  bossFlagMap: Record<string, string>
}

const BASE_W = 1400

// coords save -> fraction d'image (île principale = plage in-game [-1000, 1000])
const TRANSL_X = 123888
const TRANSL_Y = 158000
const SCALE = 459
function savToFraction(x: number, y: number) {
  const mx = (y - TRANSL_Y) / SCALE
  const my = (x + TRANSL_X) / SCALE
  return { fx: (mx + 1000) / 2000, fy: (1000 - my) / 2000 }
}
const onIsland = (fx: number, fy: number) => fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1

function LayerToggle({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  color: string
  icon: ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="chip border transition-colors"
      style={{
        color: active ? color : 'var(--color-faint)',
        background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'var(--color-surface-2)',
        borderColor: active ? `color-mix(in srgb, ${color} 45%, transparent)` : 'var(--color-border)',
        opacity: active ? 1 : 0.55,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function FTMarker({ f, unlocked, known }: { f: FastTravel; unlocked: boolean; known: boolean }) {
  // known = une save est chargée (on distingue débloqué/verrouillé) ; sinon tout est neutre.
  const color = !known ? 'var(--color-brand)' : unlocked ? 'var(--color-good)' : 'var(--color-faint)'
  return (
    <div className="absolute" style={{ left: `${f.fx * 100}%`, top: `${f.fy * 100}%`, transform: 'translate(-50%, -50%)' }}>
      <div className="group relative" style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))' }}>
        <div
          className="rounded-full border border-white/90 shadow-[0_0_4px_rgba(0,0,0,0.85)]"
          style={{ width: 10, height: 10, background: color, opacity: known && !unlocked ? 0.6 : 1 }}
        />
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)] shadow-lg group-hover:block">
          {f.name}
          {known && <span className={unlocked ? 'text-[var(--color-good)]' : 'text-[var(--color-faint)]'}> · {unlocked ? 'débloqué' : 'verrouillé'}</span>}
        </div>
      </div>
    </div>
  )
}

function TowerMarker({ t }: { t: Tower }) {
  return (
    <div className="absolute" style={{ left: `${t.fx * 100}%`, top: `${t.fy * 100}%`, transform: 'translate(-50%, -50%)' }}>
      <div className="group relative" style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))' }}>
        <div className="grid place-items-center rounded-sm border border-white/90 text-white shadow-[0_0_5px_rgba(0,0,0,0.9)]" style={{ width: 20, height: 20, background: 'var(--color-bad)' }}>
          <Castle size={12} />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)] shadow-lg group-hover:block">
          {t.name.replace(' Entrance', '')}
        </div>
      </div>
    </div>
  )
}

function BaseMarker({ fx, fy, i }: { fx: number; fy: number; i: number }) {
  return (
    <div className="absolute" style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, transform: 'translate(-50%, -50%)' }}>
      <div className="group relative" style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))' }}>
        <div className="grid place-items-center rounded-sm border border-white/90 text-white shadow-[0_0_5px_rgba(0,0,0,0.9)]" style={{ width: 18, height: 18, background: 'var(--rar-legendary)' }}>
          <Home size={11} />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)] shadow-lg group-hover:block">
          Base #{i + 1}
        </div>
      </div>
    </div>
  )
}

export function MapPage() {
  const { importedSave, selectedPlayerUid } = useStore()
  const [showFT, setShowFT] = useState(true)
  const [showBases, setShowBases] = useState(true)
  const [showTowers, setShowTowers] = useState(true)

  const known = !!importedSave
  const unlockedSet = useMemo(() => fastTravelUnlocked(importedSave, selectedPlayerUid), [importedSave, selectedPlayerUid])
  const unlockedCount = useMemo(
    () => (known ? MAP.fastTravel.filter((f) => unlockedSet.has(f.guid)).length : 0),
    [known, unlockedSet],
  )

  const bases = useMemo(() => {
    return basesFromImport(importedSave)
      .map((b) => savToFraction(b.x, b.y))
      .filter((p) => onIsland(p.fx, p.fy))
  }, [importedSave])

  return (
    <>
      <PageHeader
        eyebrow="Carte"
        title="Carte interactive"
        subtitle="Explore le monde de Palworld : points de voyage rapide, tours de boss, tes bases — et bientôt les effigies."
      />

      <div className="card p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-faint)]">Calques :</span>
          <LayerToggle
            active={showFT}
            onClick={() => setShowFT((v) => !v)}
            color="var(--color-brand)"
            icon={<MapPin size={13} />}
            label={known ? `Voyage rapide (${unlockedCount}/${MAP.fastTravel.length})` : `Voyage rapide (${MAP.fastTravel.length})`}
          />
          <LayerToggle
            active={showTowers}
            onClick={() => setShowTowers((v) => !v)}
            color="var(--color-bad)"
            icon={<Castle size={13} />}
            label={`Tours (${MAP.towers.length})`}
          />
          <LayerToggle
            active={showBases}
            onClick={() => setShowBases((v) => !v)}
            color="var(--rar-legendary)"
            icon={<Home size={13} />}
            label={`Bases (${bases.length})`}
          />
          {known && (
            <span className="ml-1 inline-flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-good)]" /> débloqué</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-faint)] opacity-60" /> verrouillé</span>
            </span>
          )}
        </div>

        <PanZoom height="74vh">
          <div className="relative select-none" style={{ width: BASE_W }}>
            <img
              src={MAP.image}
              alt="Carte de Palworld"
              draggable={false}
              style={{ width: BASE_W, height: 'auto', display: 'block' }}
            />
            {showFT && MAP.fastTravel.map((f) => <FTMarker key={f.guid} f={f} known={known} unlocked={unlockedSet.has(f.guid)} />)}
            {showTowers && MAP.towers.map((t) => <TowerMarker key={t.guid} t={t} />)}
            {showBases && bases.map((b, i) => <BaseMarker key={i} fx={b.fx} fy={b.fy} i={i} />)}
          </div>
        </PanZoom>

        <p className="mt-2 text-[11px] text-[var(--color-faint)]">
          Molette : zoom · Glisser : déplacer.{' '}
          {known ? (
            'Voyage rapide coloré selon ta partie ; les bases affichées sont celles du monde.'
          ) : (
            <>Importe ta partie (onglet « Ma partie ») pour voir tes points débloqués et tes bases.</>
          )}{' '}
          Données de carte : PalworldSaveTools (MIT).
        </p>
      </div>
    </>
  )
}
