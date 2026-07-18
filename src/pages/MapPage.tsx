import { useEffect, useMemo, useState } from 'react'
import { MapPin, Home, Castle, X, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PanZoom } from '../components/PanZoom'
import { PalPickerButton } from '../components/PalPicker'
import { useStore } from '../store/useStore'
import { basesFromImport, fastTravelUnlocked } from '../lib/savedata'
import { loadSpawns } from '../data'
import type { Pal } from '../lib/types'
import mapData from '../data/map.json'

interface FastTravel { guid: string; id: string; name: string; fx: number; fy: number }
interface Tower { guid: string; name: string; fx: number; fy: number }
interface PoiMeta { id: string; label: string; icon: string | null }
interface Poi { fx: number; fy: number; n?: string; lv?: number; time?: string }
const MAP = mapData as unknown as {
  image: string
  fastTravel: FastTravel[]
  towers: Tower[]
  poiMeta: PoiMeta[]
  poi: Record<string, Poi[]>
}

const BASE_W = 1400

// Couleur de repli pour les catégories sans icône officielle.
const POI_COLOR: Record<string, string> = { fishing: '#3aa6e0', ore: '#cf9a54' }
// Calques actifs par défaut (les légers ; les gros restent à activer à la demande).
const DEFAULT_ON = new Set(['fasttravel', 'towers', 'bases', 'effigy', 'dungeon', 'alpha'])

// coords save -> fraction d'image (voyage rapide / bases, constantes « new »)
const TRANSL_X = 375247
const TRANSL_Y = -18
const SCALE = 725
function savToFraction(x: number, y: number) {
  const mx = (y - TRANSL_Y) / SCALE
  const my = (x + TRANSL_X) / SCALE
  return { fx: (mx + 1000) / 2000, fy: (1000 - my) / 2000 }
}
const onIsland = (fx: number, fy: number) => fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1

function LayerToggle({ active, onClick, color, icon, label }: { active: boolean; onClick: () => void; color: string; icon: ReactNode; label: string }) {
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
  const locked = known && !unlocked // verrouillé (partie importée) -> icône grisée
  return (
    <div className="absolute" style={{ left: `${f.fx * 100}%`, top: `${f.fy * 100}%`, transform: 'translate(-50%, -50%)' }}>
      <div className="group relative grid place-items-center" style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))' }}>
        <img
          src="img/map-icons/T_icon_compass_FTtower.png"
          width={22}
          height={22}
          alt=""
          loading="lazy"
          className="block"
          style={
            locked
              ? { filter: 'grayscale(1) brightness(0.7) drop-shadow(0 0 2px rgba(0,0,0,0.9))', opacity: 0.55 }
              : known && unlocked
                ? { filter: 'drop-shadow(0 0 3px var(--color-good)) drop-shadow(0 0 2px rgba(0,0,0,0.9))' }
                : { filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.95))' }
          }
        />
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)] shadow-lg group-hover:block">
          {f.name}{known && <span className={unlocked ? 'text-[var(--color-good)]' : 'text-[var(--color-faint)]'}> · {unlocked ? 'débloqué' : 'verrouillé'}</span>}
        </div>
      </div>
    </div>
  )
}

function IconOnMap({ fx, fy, size, children }: { fx: number; fy: number; size?: number; children: ReactNode }) {
  return (
    <div className="absolute" style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, transform: 'translate(-50%, -50%)' }}>
      <div style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))', width: size, height: size }} className="grid place-items-center">
        {children}
      </div>
    </div>
  )
}

/** Marqueur POI léger (tooltip natif via title, pour supporter des milliers de points). */
function PoiMarker({ e, icon, color }: { e: Poi; icon: string | null; color: string }) {
  const title = `${e.n ?? ''}${e.lv ? ` · Nv ${e.lv}` : ''}${e.time ? ` · ${e.time === 'night' ? 'nuit' : 'jour'}` : ''}`.trim()
  return (
    <div className="absolute" style={{ left: `${e.fx * 100}%`, top: `${e.fy * 100}%`, transform: 'translate(-50%, -50%)' }} title={title || undefined}>
      <div style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))' }}>
        {icon ? (
          <img src={icon} width={20} height={20} alt="" className="block drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" loading="lazy" />
        ) : (
          <div className="rounded-full border border-white/70" style={{ width: 8, height: 8, background: color }} />
        )}
      </div>
    </div>
  )
}

export function MapPage() {
  const { importedSave, selectedPlayerUid } = useStore()
  const [active, setActive] = useState<Set<string>>(() => new Set(DEFAULT_ON))
  const toggle = (id: string) => setActive((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const known = !!importedSave
  const unlockedSet = useMemo(() => fastTravelUnlocked(importedSave, selectedPlayerUid), [importedSave, selectedPlayerUid])
  const unlockedCount = useMemo(() => (known ? MAP.fastTravel.filter((f) => unlockedSet.has(f.guid)).length : 0), [known, unlockedSet])
  const bases = useMemo(() => basesFromImport(importedSave).map((b) => savToFraction(b.x, b.y)).filter((p) => onIsland(p.fx, p.fy)), [importedSave])

  const activePoiCount = useMemo(() => MAP.poiMeta.filter((m) => active.has(m.id)).reduce((n, m) => n + MAP.poi[m.id].length, 0), [active])

  // Apparition d'un Pal : points rouges à ses lieux de spawn (données chargées à la demande)
  const [spawnPal, setSpawnPal] = useState<Pal | null>(null)
  const [spawnPts, setSpawnPts] = useState<[number, number][]>([])
  const [spawnLoading, setSpawnLoading] = useState(false)
  useEffect(() => {
    if (!spawnPal) { setSpawnPts([]); return }
    let cancel = false
    setSpawnLoading(true)
    loadSpawns().then((data) => { if (!cancel) { setSpawnPts(data[spawnPal.key] ?? []); setSpawnLoading(false) } })
    return () => { cancel = true }
  }, [spawnPal])

  return (
    <>
      <PageHeader eyebrow="Carte" title="Carte interactive" subtitle="Voyage rapide, tours, tes bases, coffres, œufs, effigies, donjons, PNJ, arbres à fruits… Active les calques." />

      <div className="card p-3">
        {/* Apparition d'un Pal */}
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[var(--color-border-soft)] pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-faint)]">Apparition d'un Pal :</span>
          <div className="w-60"><PalPickerButton value={spawnPal} onChange={setSpawnPal} placeholder="Choisir un Pal…" /></div>
          {spawnPal && (
            <span className="chip bg-[color-mix(in_srgb,var(--color-bad)_15%,transparent)] text-[var(--color-bad)]">
              {spawnLoading ? <Loader2 size={12} className="animate-spin" /> : <span className="h-2 w-2 rounded-full bg-[var(--color-bad)]" />}
              {spawnLoading ? 'chargement…' : spawnPts.length ? `${spawnPts.length} lieux d'apparition` : 'aucun spawn sauvage (boss/variant ?)'}
            </span>
          )}
          {spawnPal && (
            <button className="rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-bad)]" onClick={() => setSpawnPal(null)} title="Effacer">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-faint)]">Calques :</span>
          <LayerToggle active={active.has('fasttravel')} onClick={() => toggle('fasttravel')} color="var(--color-brand)" icon={<MapPin size={13} />} label={known ? `Voyage rapide (${unlockedCount}/${MAP.fastTravel.length})` : `Voyage rapide (${MAP.fastTravel.length})`} />
          <LayerToggle active={active.has('towers')} onClick={() => toggle('towers')} color="var(--color-bad)" icon={<Castle size={13} />} label={`Tours (${MAP.towers.length})`} />
          <LayerToggle active={active.has('bases')} onClick={() => toggle('bases')} color="var(--rar-legendary)" icon={<Home size={13} />} label={`Bases (${bases.length})`} />
          {MAP.poiMeta.map((m) => (
            <LayerToggle
              key={m.id}
              active={active.has(m.id)}
              onClick={() => toggle(m.id)}
              color={POI_COLOR[m.id] ?? 'var(--color-accent-2)'}
              icon={m.icon ? <img src={m.icon} width={14} height={14} alt="" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: POI_COLOR[m.id] ?? '#888' }} />}
              label={`${m.label} (${MAP.poi[m.id].length})`}
            />
          ))}
          {activePoiCount > 4000 && <span className="text-[10px] text-[var(--color-warn)]">Beaucoup de marqueurs actifs — le zoom peut ralentir.</span>}
        </div>

        <PanZoom height="74vh">
          <div className="relative select-none" style={{ width: BASE_W }}>
            <img src={MAP.image} alt="Carte de Palworld" draggable={false} style={{ width: BASE_W, height: 'auto', display: 'block' }} />
            {/* POI (calques paldb) */}
            {MAP.poiMeta.filter((m) => active.has(m.id)).map((m) =>
              MAP.poi[m.id].map((e, i) => <PoiMarker key={`${m.id}${i}`} e={e} icon={m.icon} color={POI_COLOR[m.id] ?? '#aaa'} />),
            )}
            {/* Voyage rapide (état save) */}
            {active.has('fasttravel') && MAP.fastTravel.map((f) => <FTMarker key={f.guid} f={f} known={known} unlocked={unlockedSet.has(f.guid)} />)}
            {/* Tours */}
            {active.has('towers') && MAP.towers.map((t) => (
              <IconOnMap key={t.guid} fx={t.fx} fy={t.fy} size={20}>
                <div className="grid place-items-center rounded-sm border border-white/90 text-white shadow-[0_0_5px_rgba(0,0,0,0.9)]" style={{ width: 20, height: 20, background: 'var(--color-bad)' }} title={t.name.replace(' Entrance', '')}>
                  <Castle size={12} />
                </div>
              </IconOnMap>
            ))}
            {/* Bases */}
            {active.has('bases') && bases.map((b, i) => (
              <IconOnMap key={i} fx={b.fx} fy={b.fy} size={18}>
                <div className="grid place-items-center rounded-sm border border-white/90 text-white shadow-[0_0_5px_rgba(0,0,0,0.9)]" style={{ width: 18, height: 18, background: 'var(--rar-legendary)' }} title={`Base #${i + 1}`}>
                  <Home size={11} />
                </div>
              </IconOnMap>
            ))}
            {/* Apparition d'un Pal : points rouges (au-dessus de tout) */}
            {spawnPts.map(([fx, fy], i) => (
              <div key={`sp${i}`} className="pointer-events-none absolute z-20" style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, transform: 'translate(-50%, -50%)' }}>
                <div style={{ transform: 'scale(calc(1 / var(--pz-scale, 1)))' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff3b3b', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 0 3px rgba(255,0,0,0.9)' }} />
                </div>
              </div>
            ))}
          </div>
        </PanZoom>

        <p className="mt-2 text-[11px] text-[var(--color-faint)]">
          Molette : zoom · Glisser : déplacer · Survole un marqueur pour son nom.{' '}
          {known ? 'Voyage rapide : icône pleine = débloqué, grisée = verrouillé.' : 'Importe ta partie (« Ma partie ») pour tes points débloqués et tes bases.'}{' '}
          Données : PalworldSaveTools (MIT) · POI &amp; emplacements : paldb.cc.
        </p>
      </div>
    </>
  )
}
