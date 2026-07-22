import { useMemo, useState } from 'react'
import {
  Upload,
  Loader2,
  Trash2,
  Search,
  Info,
  AlertTriangle,
  Users,
  Box,
  Home,
  Swords,
  Pencil,
  UserCog,
  Backpack,
  Archive,
  Sparkles,
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalIcon } from '../components/PalIcon'
import { PalTypeBadges, StarRow } from '../components/badges'
import { PalDetailModal } from '../components/PalDetailModal'
import { PalEditModal } from '../components/PalEditModal'
import { PlayerEditModal } from '../components/PlayerEditModal'
import { InventoryEditModal } from '../components/InventoryEditModal'
import { RestoreBackupModal } from '../components/RestoreBackupModal'
import { CreatePalModal } from '../components/CreatePalModal'
import { FixHostModal } from '../components/FixHostModal'
import { palByKey } from '../data'
import { useStore } from '../store/useStore'
import { resolveImport, LOCATION_LABEL, ivTotal, palsOfPlayer } from '../lib/savedata'
import { palMatches } from '../lib/pal-helpers'
import type { ImportedPal, PalLocation, Pal } from '../lib/types'

const LOC_ICON: Record<PalLocation, typeof Users> = { party: Swords, palbox: Box, base: Home }

export function DataImportPage() {
  const { importedSave, setImportedSave, clearImportedSave, selectedPlayerUid, setSelectedPlayerUid,
    autoRefresh, setAutoRefresh, lastRefresh, refreshImportedSave } = useStore()
  const isElectron = !!window.electronAPI
  const multiplayer = (importedSave?.players.length ?? 0) > 1
  const canEdit = isElectron && !!window.electronAPI?.editSave && !!importedSave?.levelPath
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null)

  const [q, setQ] = useState('')
  const [locFilter, setLocFilter] = useState<PalLocation | ''>('')
  const [sort, setSort] = useState<'level' | 'iv' | 'name'>('level')
  const [modalPal, setModalPal] = useState<Pal | null>(null)
  const [editingPal, setEditingPal] = useState<ImportedPal | null>(null)
  const [editingPlayer, setEditingPlayer] = useState(false)
  const [editingInventory, setEditingInventory] = useState(false)
  const [creatingPal, setCreatingPal] = useState(false)
  const [fixingHost, setFixingHost] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const currentPlayer = useMemo(
    () => importedSave?.players.find((p) => p.uid === selectedPlayerUid) ?? importedSave?.players[0] ?? null,
    [importedSave, selectedPlayerUid],
  )

  const doImport = async () => {
    if (!window.electronAPI) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.importSave()
      if (res.canceled) return
      if (res.error) {
        setError({ code: res.error, detail: res.detail })
        return
      }
      if (res.ok && res.data) {
        // REMPLACE toujours (aucune fusion avec un import précédent)
        setImportedSave({ ...resolveImport(res.data), levelPath: res.levelPath })
      }
    } catch (e) {
      setError({ code: 'ERROR', detail: String((e as Error).message) })
    } finally {
      setLoading(false)
    }
  }

  const doRefresh = async () => {
    if (!window.electronAPI?.reimportSave || !importedSave?.levelPath) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await window.electronAPI.reimportSave(importedSave.levelPath)
      if (res.ok && res.data) refreshImportedSave({ ...resolveImport(res.data), levelPath: res.levelPath })
      else if (res.error) setError({ code: res.error, detail: res.detail })
    } catch (e) {
      setError({ code: 'ERROR', detail: String((e as Error).message) })
    } finally {
      setRefreshing(false)
    }
  }

  const myPals = useMemo(() => palsOfPlayer(importedSave, selectedPlayerUid), [importedSave, selectedPlayerUid])

  const counts = useMemo(() => {
    const c = { party: 0, palbox: 0, base: 0 }
    for (const p of myPals) c[p.location]++
    return c
  }, [myPals])

  const filtered = useMemo(() => {
    let list = myPals
    if (locFilter) list = list.filter((p) => p.location === locFilter)
    if (q.trim()) {
      list = list.filter((p) => {
        const pal = p.palKey ? palByKey.get(p.palKey) : null
        return (pal && palMatches(pal, q)) || (p.nickname ?? '').toLowerCase().includes(q.toLowerCase())
      })
    }
    const sorted = [...list]
    if (sort === 'level') sorted.sort((a, b) => b.level - a.level)
    else if (sort === 'iv') sorted.sort((a, b) => ivTotal(b.iv) - ivTotal(a.iv))
    else sorted.sort((a, b) => (palByKey.get(a.palKey!)?.name || '').localeCompare(palByKey.get(b.palKey!)?.name || ''))
    return sorted
  }, [myPals, locFilter, q, sort])

  return (
    <>
      <PageHeader
        eyebrow="Ma partie"
        title="Données & import"
        subtitle="Charge le fichier de sauvegarde de ta partie Palworld pour récupérer tes Pals (équipe, boîte, base) avec leurs niveaux, IVs et passifs."
        actions={
          importedSave ? (
            <div className="flex flex-wrap gap-2">
              {canEdit && currentPlayer && (
                <button className="btn btn-brand" onClick={() => setEditingPlayer(true)}>
                  <UserCog size={15} /> Éditer le personnage
                </button>
              )}
              {canEdit && currentPlayer && (
                <button className="btn" onClick={() => setEditingInventory(true)}>
                  <Backpack size={15} /> Inventaire
                </button>
              )}
              {canEdit && currentPlayer?.palboxId && (
                <button className="btn" onClick={() => setCreatingPal(true)}>
                  <Sparkles size={15} /> Créer un Pal
                </button>
              )}
              {canEdit && multiplayer && (
                <button className="btn" onClick={() => setFixingHost(true)} title="Jouer en solo une save multijoueur (échange de GUID)">
                  <ArrowLeftRight size={15} /> Solo depuis multi
                </button>
              )}
              {canEdit && (
                <button className="btn" onClick={() => setRestoring(true)} title="Restaurer une sauvegarde de secours">
                  <Archive size={15} /> Restaurer
                </button>
              )}
              <button className="btn" onClick={clearImportedSave}>
                <Trash2 size={15} /> Vider la save
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Bloc import */}
      <div className="card mb-5 p-5">
        <h2 className="hud-h mb-3 text-sm">Importer ma sauvegarde Palworld</h2>
        {!isElectron ? (
          <p className="text-sm text-[var(--color-muted)]">
            L'import de sauvegarde est disponible uniquement dans l'<strong>application de bureau</strong> PalGuide.
          </p>
        ) : (
          <>
            <div className="mb-3 space-y-1.5 text-sm text-[var(--color-muted)]">
              <p>
                Choisis le fichier <code className="rounded bg-[var(--color-bg-soft)] px-1.5 py-0.5">Level.sav</code> de
                ton monde. Emplacement typique :
              </p>
              <p className="text-xs">
                <code className="rounded bg-[var(--color-bg-soft)] px-1.5 py-0.5">
                  %LOCALAPPDATA%\Pal\Saved\SaveGames\&lt;SteamID&gt;\&lt;monde&gt;\Level.sav
                </code>
              </p>
              <p className="flex items-start gap-1.5 text-xs text-[var(--color-faint)]">
                <Info size={14} className="mt-0.5 shrink-0" />
                Nécessite <strong>Python</strong> + le paquet <code className="rounded bg-[var(--color-bg-soft)] px-1 py-0.5">palworld-save-tools</code>{' '}
                (<code className="rounded bg-[var(--color-bg-soft)] px-1 py-0.5">pip install palworld-save-tools</code>). L'import est en lecture seule ; tu peux ensuite <strong>éditer un Pal</strong> (icône crayon) — une <strong>sauvegarde de secours</strong> est créée avant toute écriture.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-brand" onClick={doImport} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {loading ? 'Lecture de la sauvegarde…' : 'Choisir Level.sav et importer'}
              </button>
              {importedSave && (
                <span className="text-xs text-[var(--color-faint)]">
                  Un nouvel import <strong>remplace</strong> les Pals actuellement importés.
                </span>
              )}
            </div>

            {error && (
              <div className="mt-3 flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-3 text-sm text-[var(--color-bad)]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  {error.code === 'PYTHON_MISSING' && (
                    <span>
                      <strong>Python introuvable.</strong> Installe Python (python.org) puis relance l'import.
                    </span>
                  )}
                  {error.code === 'MODULE_MISSING' && (
                    <span>
                      Le paquet <strong>palworld-save-tools</strong> est manquant. Ouvre un terminal et lance :{' '}
                      <code className="rounded bg-[var(--color-bg-soft)] px-1.5 py-0.5">pip install palworld-save-tools</code>
                    </span>
                  )}
                  {error.code === 'FILE_MISSING' && (
                    <span><strong>Fichier introuvable.</strong> Le <code>Level.sav</code> a peut-être été déplacé ou supprimé. Réimporte-le manuellement.</span>
                  )}
                  {error.code === 'FILE_BUSY' && (
                    <span><strong>Fichier occupé</strong> (le jeu est en train de sauvegarder). Réessaie dans un instant.</span>
                  )}
                  {error.code === 'ERROR' && (
                    <span>
                      Impossible de lire cette sauvegarde. Vérifie que c'est bien un <code>Level.sav</code>.
                      {error.detail && <span className="mt-1 block text-xs opacity-70">{error.detail}</span>}
                    </span>
                  )}
                </div>
              </div>
            )}

            {importedSave?.levelPath && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border-soft)] pt-3">
                <button className="btn" onClick={doRefresh} disabled={refreshing || loading}>
                  {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Actualiser maintenant
                </button>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Actualisation automatique <span className="text-xs text-[var(--color-faint)]">(toutes les 5 min)</span>
                </label>
                {lastRefresh && (
                  <span className="ml-auto text-xs text-[var(--color-faint)]">Dernière actualisation : {new Date(lastRefresh).toLocaleTimeString('fr-FR')}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sélecteur de personnage (saves coop / serveur) */}
      {importedSave && multiplayer && (
        <div className="card mb-5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)]">
            <Users size={15} /> Personnage à afficher
            <span className="text-xs font-normal text-[var(--color-faint)]">(sauvegarde multijoueur détectée)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...importedSave.players]
              .sort((a, b) => b.palCount - a.palCount)
              .map((pl) => (
                <button
                  key={pl.uid}
                  onClick={() => setSelectedPlayerUid(pl.uid)}
                  className={`chip border ${
                    selectedPlayerUid === pl.uid
                      ? 'border-transparent bg-[var(--color-brand)] text-[#04222c]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                  }`}
                >
                  {pl.name} · {pl.palCount}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Résumé + liste */}
      {importedSave && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Users size={16} />} label="Total Pals" value={myPals.length} accent />
            <StatCard icon={<Swords size={16} />} label="Équipe" value={counts.party} />
            <StatCard icon={<Box size={16} />} label="Boîte à Pals" value={counts.palbox} />
            <StatCard icon={<Home size={16} />} label="Base" value={counts.base} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
              <input className="input pl-9" placeholder="Rechercher (nom ou surnom)…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input w-auto" value={locFilter} onChange={(e) => setLocFilter(e.target.value as PalLocation | '')}>
              <option value="">Tous emplacements</option>
              <option value="party">Équipe</option>
              <option value="palbox">Boîte à Pals</option>
              <option value="base">Base</option>
            </select>
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="level">Trier : Niveau</option>
              <option value="iv">Trier : IVs</option>
              <option value="name">Trier : Nom</option>
            </select>
          </div>

          <div className="mb-2 text-sm text-[var(--color-muted)]">{filtered.length} Pal{filtered.length > 1 ? 's' : ''}</div>
          <div className="grid gap-2 lg:grid-cols-2">
            {filtered.map((p, i) => (
              <ImportedPalRow key={p.instanceId ?? i} pal={p} onOpen={setModalPal} onEdit={canEdit ? setEditingPal : undefined} />
            ))}
          </div>
        </>
      )}

      <PalDetailModal pal={modalPal} onClose={() => setModalPal(null)} />
      {editingPal && importedSave?.levelPath && (
        <PalEditModal pal={editingPal} levelPath={importedSave.levelPath} onClose={() => setEditingPal(null)} />
      )}
      {editingPlayer && currentPlayer && importedSave?.levelPath && (
        <PlayerEditModal player={currentPlayer} levelPath={importedSave.levelPath} onClose={() => setEditingPlayer(false)} />
      )}
      {editingInventory && currentPlayer && importedSave?.levelPath && (
        <InventoryEditModal player={currentPlayer} levelPath={importedSave.levelPath} onClose={() => setEditingInventory(false)} />
      )}
      {restoring && importedSave?.levelPath && (
        <RestoreBackupModal levelPath={importedSave.levelPath} onClose={() => setRestoring(false)} />
      )}
      {creatingPal && currentPlayer && importedSave?.levelPath && (
        <CreatePalModal player={currentPlayer} levelPath={importedSave.levelPath} onClose={() => setCreatingPal(false)} />
      )}
      {fixingHost && importedSave?.levelPath && (
        <FixHostModal players={importedSave.players} levelPath={importedSave.levelPath} onClose={() => setFixingHost(false)} />
      )}
    </>
  )
}

function StatCard({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card p-3 ${accent ? '' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-faint)]">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-extrabold ${accent ? 'text-[var(--color-brand)]' : ''}`}>{value}</div>
    </div>
  )
}

function IvBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'var(--color-good)' : value >= 40 ? 'var(--color-warn)' : 'var(--color-faint)'
  return (
    <div className="flex items-center gap-1.5" title={`${label} : ${value}/100`}>
      <span className="w-7 text-[10px] uppercase text-[var(--color-faint)]">{label}</span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </span>
      <span className="w-6 text-right text-[11px] font-bold tabular-nums">{value}</span>
    </div>
  )
}

function ImportedPalRow({ pal, onOpen, onEdit }: { pal: ImportedPal; onOpen: (p: Pal) => void; onEdit?: (p: ImportedPal) => void }) {
  const p = pal.palKey ? palByKey.get(pal.palKey) : null
  if (!p) return null
  const LocIcon = LOC_ICON[pal.location]
  return (
    <div className="group flex items-center gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-2)]">
      <button onClick={() => onOpen(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Voir la fiche">
        <PalIcon pal={p} size={44} ring />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{pal.nickname || p.name}</span>
            {pal.nickname && <span className="truncate text-xs text-[var(--color-faint)]">{p.name}</span>}
            {pal.isBoss && <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-warn)]">Alpha</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-muted)]">Niv. {pal.level}</span>
            {pal.stars > 0 && <StarRow stars={pal.stars} />}
            <PalTypeBadges pal={p} size="sm" />
            <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-brand)]">
              <LocIcon size={11} /> {LOCATION_LABEL[pal.location]}
            </span>
          </div>
        </div>
      </button>
      <div className="hidden shrink-0 flex-col gap-0.5 sm:flex">
        <IvBar label="PV" value={pal.iv.hp} />
        <IvBar label="ATQ" value={pal.iv.shot} />
        <IvBar label="DÉF" value={pal.iv.defense} />
      </div>
      {onEdit && (
        <button onClick={() => onEdit(pal)} title="Éditer ce Pal"
          className="btn-icon shrink-0 self-stretch text-[var(--color-faint)] hover:text-[var(--color-brand)]">
          <Pencil size={16} />
        </button>
      )}
    </div>
  )
}
