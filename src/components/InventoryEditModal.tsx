import { useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2, AlertTriangle, Check, ShieldAlert, Trash2, Plus, Search, Package } from 'lucide-react'
import { loadItemsCatalog, type ItemCatalogEntry } from '../data'
import type { SavePlayer } from '../lib/types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || 0)))
const RARITY_COLOR = ['#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24']
const stripDia = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// L'équipement à données propres (DynamicItemSaveData) est identifié par le champ
// `dyn` du catalogue (source faisant autorité : items_dynamic du jeu). Absent =
// objet empilable normal. Les grenades (cat « Weapon » mais empilables) et les
// œufs (cat « Material » mais dynamiques) sont donc classés correctement.

interface Row { key: string; slotIndex: number | null; id: string; count: number; dyn: boolean }
let seq = 0

export function InventoryEditModal({
  player,
  levelPath,
  onClose,
}: {
  player: SavePlayer
  levelPath: string
  onClose: () => void
}) {
  const [catalog, setCatalog] = useState<ItemCatalogEntry[]>([])
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog])
  const [containerId, setContainerId] = useState<string>('')
  const [slotNum, setSlotNum] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [original, setOriginal] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: true; backupPath?: string; skipped?: number } | { ok: false; msg: string } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setLoadErr(null)
      try {
        const [cat, res] = await Promise.all([
          loadItemsCatalog(),
          window.electronAPI!.readInventory({ levelPath, uid: player.uid }),
        ])
        if (!alive) return
        setCatalog(cat)
        if (res.error || !res.inventory || res.inventory.error) {
          setLoadErr(res.detail || res.inventory?.error || res.error || 'Lecture impossible')
        } else {
          setContainerId(res.inventory.containerId)
          setSlotNum(res.inventory.slotNum)
          const rs = res.inventory.slots.map((s) => ({ key: `o${s.slotIndex}`, slotIndex: s.slotIndex, id: s.id, count: s.count, dyn: s.dyn }))
          setRows(rs)
          setOriginal(rs.map((r) => ({ ...r })))
        }
      } catch (e) {
        if (alive) setLoadErr(String((e as Error).message))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [levelPath, player.uid])

  const name = (id: string) => byId.get(id)?.name ?? id
  const icon = (id: string) => byId.get(id)?.icon ?? null
  const rarity = (id: string) => byId.get(id)?.rarity ?? 0

  // Les lignes affichées (existantes conservées + ajouts en attente) occuperont des slots.
  const usedSlots = rows.length
  const freeSlots = Math.max(0, slotNum - usedSlots)

  // Diff -> opérations d'inventaire
  const ops = useMemo(() => {
    if (!containerId) return [] as InventoryOp[]
    const out: InventoryOp[] = []
    const curByIdx = new Map(rows.filter((r) => r.slotIndex != null).map((r) => [r.slotIndex!, r]))
    for (const o of original) {
      const cur = curByIdx.get(o.slotIndex!)
      if (!cur) out.push({ containerId, action: 'remove', slotIndex: o.slotIndex! })
      else if (cur.count !== o.count) out.push({ containerId, action: 'count', slotIndex: o.slotIndex!, count: clamp(cur.count, 1, 9999999) })
    }
    for (const r of rows) {
      if (r.slotIndex == null) {
        const info = byId.get(r.id)?.dyn
        out.push({
          containerId, action: 'add', staticId: r.id,
          count: info ? 1 : clamp(r.count, 1, 9999999),
          ...(info ? { dynType: info.t, durability: info.d } : {}),
        })
      }
    }
    return out
  }, [rows, original, containerId, byId])

  const canSave = ops.length > 0 && !saving && !loading

  const addItem = (e: ItemCatalogEntry) => {
    setRows((rs) => [{ key: `n${seq++}`, slotIndex: null, id: e.id, count: 1, dyn: !!e.dyn }, ...rs])
    setAdding(false); setQ('')
  }

  const filtered = useMemo(() => {
    const qq = stripDia(q.trim())
    let list = catalog // TOUS les objets du jeu (équipement inclus)
    if (qq) list = list.filter((e) => stripDia(e.name).includes(qq) || (e.nameEn && stripDia(e.nameEn).includes(qq)) || e.id.toLowerCase().includes(qq))
    return list.slice(0, 80)
  }, [catalog, q])

  const save = async () => {
    if (!window.electronAPI?.editSave) return
    setSaving(true); setResult(null)
    try {
      const res = await window.electronAPI.editSave({ levelPath, edits: { inventory: ops } })
      if (res.error) {
        const MSG: Record<string, string> = {
          PYTHON_MISSING: 'Python est introuvable.',
          FILE_BUSY: 'Le fichier est verrouillé. Ferme Palworld (et le serveur) avant d\'enregistrer.',
          VERIFY_FAILED: 'La vérification a échoué : rien n\'a été écrit. Ta save d\'origine est intacte.',
          ERROR: 'Erreur lors de l\'écriture.',
        }
        setResult({ ok: false, msg: (MSG[res.error] ?? MSG.ERROR) + (res.detail ? `\n${res.detail}` : '') })
        return
      }
      // filet de sécurité : signale d'éventuels ajouts non écrits faute de place
      const inv = res.result?.applied?.find((a) => a.kind === 'inventory') as { changes?: Array<{ result?: string }> } | undefined
      const skipped = (inv?.changes ?? []).filter((c) => c.result === 'container_full').length
      // resynchronise l'état "original" sur les valeurs enregistrées (les ajouts deviennent des slots existants)
      setResult({ ok: true, backupPath: res.backupPath, skipped })
      setOriginal(rows.map((r) => ({ ...r })))
    } catch (e) {
      setResult({ ok: false, msg: String((e as Error).message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]"><Package size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-extrabold text-[var(--color-brand)]">Inventaire — {player.name}</div>
            <div className="text-xs text-[var(--color-faint)]">
              {loading ? 'Lecture…' : `${usedSlots}/${slotNum} emplacements · ${freeSlots} libre${freeSlots > 1 ? 's' : ''}`}
            </div>
          </div>
          <button className="btn" onClick={() => setAdding((a) => !a)} disabled={loading || !!loadErr || freeSlots <= 0}>
            <Plus size={15} /> Ajouter
          </button>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        {/* Sélecteur d'ajout */}
        {adding && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
            <div className="relative mb-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
              <input autoFocus className="input pl-9" placeholder="Rechercher parmi tous les objets (nom FR/EN ou ID)…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {filtered.map((e) => (
                <button key={e.id} onClick={() => addItem(e)}
                  className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left hover:bg-[var(--color-surface-2)]">
                  <ItemIcon icon={e.icon} />
                  <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                  <span className="chip text-[10px]" style={{ color: RARITY_COLOR[e.rarity], borderColor: RARITY_COLOR[e.rarity] + '55' }}>{e.cat || 'Item'}</span>
                </button>
              ))}
              {filtered.length === 0 && <div className="py-4 text-center text-xs text-[var(--color-faint)]">Aucun item.</div>}
            </div>
          </div>
        )}

        {/* Liste des items */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid place-items-center py-16 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
          ) : loadErr ? (
            <div className="flex gap-2 p-3 text-sm text-[var(--color-bad)]"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {loadErr}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted)]">Inventaire vide. Utilise « Ajouter ».</div>
          ) : (
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2.5 border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2.5 py-1.5">
                  <ItemIcon icon={icon(r.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{name(r.id)}</span>
                      {r.slotIndex == null && <span className="chip bg-[var(--color-brand)] text-[9px] text-[#04222c]">nouveau</span>}
                      {r.dyn && <span className="chip text-[9px] text-[var(--color-warn)]" title="Objet à données propres (arme/armure/œuf)">équipement</span>}
                    </div>
                    <span className="text-[10px]" style={{ color: RARITY_COLOR[rarity(r.id)] }}>{byId.get(r.id)?.cat || r.id}</span>
                  </div>
                  <input type="number" min={1} max={9999999} value={r.dyn ? 1 : r.count} disabled={r.dyn}
                    title={r.dyn ? 'L\'équipement ne s\'empile pas (quantité fixée à 1)' : undefined}
                    onChange={(ev) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, count: clamp(+ev.target.value, 1, 9999999) } : x)))}
                    className="input w-24 py-1 text-center tabular-nums disabled:opacity-40" />
                  <button className="btn-icon text-[var(--color-faint)] hover:text-[var(--color-bad)]" title="Retirer"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Avertissement + résultat */}
        <div className="space-y-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] p-2 text-[11px] text-[var(--color-warn)]">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>Ferme Palworld avant d'enregistrer. Backup auto de ton <code>Level.sav</code>. L'équipement (armes, armures, planeurs, accessoires…) est ajouté avec une <strong>durabilité maximale</strong> et une quantité de 1.</span>
          </div>
          {result?.ok === true && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] p-2 text-sm text-[var(--color-good)]">
              <Check size={16} className="mt-0.5 shrink-0" /><div><strong>Enregistré.</strong>{result.skipped ? <span className="mt-0.5 block text-xs text-[var(--color-warn)]">{result.skipped} objet{result.skipped > 1 ? 's' : ''} non ajouté{result.skipped > 1 ? 's' : ''} (inventaire plein).</span> : null}{result.backupPath && <span className="mt-0.5 block break-all text-xs opacity-80">Backup : {result.backupPath}</span>}</div>
            </div>
          )}
          {result?.ok === false && (
            <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-2 text-sm text-[var(--color-bad)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="whitespace-pre-wrap break-words">{result.msg}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--color-faint)]">{ops.length > 0 ? `${ops.length} changement${ops.length > 1 ? 's' : ''}` : 'Aucune modification'}</span>
            <div className="flex gap-2">
              <button className="btn" onClick={onClose}>Fermer</button>
              <button className="btn btn-brand" onClick={save} disabled={!canSave}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Enregistrement…' : 'Enregistrer dans la save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ItemIcon({ icon }: { icon: string | null }) {
  const [err, setErr] = useState(false)
  if (!icon || err) return <span className="grid h-8 w-8 shrink-0 place-items-center text-[var(--color-faint)]"><Package size={16} /></span>
  return <img src={icon} width={32} height={32} alt="" className="shrink-0" loading="lazy" onError={() => setErr(true)} />
}
