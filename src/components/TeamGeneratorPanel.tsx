import { useMemo, useState } from 'react'
import { Wand2, Sparkles, Check, AlertTriangle, Globe, User, Lock } from 'lucide-react'
import { PalIcon } from './PalIcon'
import { PalTypeBadges, StarRow } from './badges'
import { palsSortedByDex, palByKey, workLabels } from '../data'
import { useStore } from '../store/useStore'
import { ownedKeysFromImport, importByKey } from '../lib/savedata'
import { parsePrompt, buildTeam, INTENT_BY_ID, ELEMENT_LABEL } from '../lib/teamAdvisor'
import type { BuildResult, ParsedPrompt, Candidate } from '../lib/teamAdvisor'

const EXAMPLES = [
  'team endgame qui augmente les dégâts de mon personnage',
  'team feu pour boss',
  'des bons mineurs pour ma base',
  'équipe tank qui encaisse sans mourir',
]

export function TeamGeneratorPanel() {
  const { importedSave, selectedPlayerUid, setTeam } = useStore()
  const [prompt, setPrompt] = useState('')
  const [pool, setPool] = useState<'all' | 'owned'>('all')
  const [globalStars, setGlobalStars] = useState(4)
  const [result, setResult] = useState<BuildResult | null>(null)
  const [parsed, setParsed] = useState<ParsedPrompt | null>(null)
  const [applied, setApplied] = useState(false)

  const ownedCount = useMemo(
    () => ownedKeysFromImport(importedSave, selectedPlayerUid).length,
    [importedSave, selectedPlayerUid],
  )
  const canOwned = ownedCount > 0

  function generate(text: string) {
    const t = text.trim()
    if (!t) return
    const p = parsePrompt(t)
    const usingOwned = pool === 'owned' && canOwned
    let candidates: Candidate[]
    if (usingOwned) {
      const byKey = importByKey(importedSave, selectedPlayerUid)
      candidates = ownedKeysFromImport(importedSave, selectedPlayerUid)
        .map((k) => palByKey.get(k))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((pal) => ({ pal, stars: Math.max(0, ...(byKey.get(pal.key)?.map((i) => i.stars ?? 0) ?? [0])) }))
    } else {
      candidates = palsSortedByDex.map((pal) => ({ pal, stars: globalStars }))
    }
    setParsed(p)
    setResult(buildTeam(candidates, p))
    setApplied(false)
  }

  function apply() {
    if (!result || result.team.length === 0) return
    setTeam(result.team.map((p) => p.key))
    setApplied(true)
  }

  return (
    <div className="card mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-h flex items-center gap-2 text-sm">
          <Wand2 size={15} /> Générateur d'équipe par description
        </h2>
        <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">100 % hors-ligne</span>
      </div>

      <p className="mb-2 text-xs text-[var(--color-faint)]">
        Décris l'équipe voulue en français : PalGuide détecte l'objectif et compose une équipe optimisée
        (partner skills, cumuls, rareté et étoiles de condensation).
      </p>

      <textarea
        className="input mb-2 resize-none"
        rows={2}
        placeholder="ex. : team feu pour boss endgame · des mineurs pour ma base · équipe tank…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate(prompt)
        }}
      />

      {/* Exemples cliquables */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="chip border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[10px] text-[var(--color-muted)] hover:border-[var(--color-brand-2)]"
            onClick={() => { setPrompt(ex); generate(ex) }}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Contrôles : source des Pals + étoiles + générer */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-[var(--color-border)]">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${pool === 'all' ? 'bg-[var(--color-surface-3)] text-[var(--color-brand)]' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'}`}
            onClick={() => setPool('all')}
          >
            <Globe size={14} /> Tous les Pals
          </button>
          <button
            className={`flex items-center gap-1.5 border-l border-[var(--color-border)] px-3 py-1.5 text-sm ${pool === 'owned' ? 'bg-[var(--color-surface-3)] text-[var(--color-brand)]' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'} ${!canOwned ? 'cursor-not-allowed opacity-40' : ''}`}
            onClick={() => canOwned && setPool('owned')}
            disabled={!canOwned}
            title={canOwned ? '' : 'Importe ta partie (onglet « Ma partie »)'}
          >
            <User size={14} /> Mes Pals {canOwned ? `(${ownedCount})` : ''}
          </button>
        </div>

        {pool === 'all' && (
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            Étoiles supposées
            <select className="input w-auto py-1 text-sm" value={globalStars} onChange={(e) => setGlobalStars(Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}★</option>
              ))}
            </select>
          </label>
        )}

        <button className="btn btn-brand ml-auto" onClick={() => generate(prompt)} disabled={!prompt.trim()}>
          <Sparkles size={15} /> Générer l'équipe
        </button>
      </div>

      {/* Résultat */}
      {result && parsed && (
        <div className="mt-4 border-t border-[var(--color-border-soft)] pt-4">
          {/* Intentions détectées */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--color-faint)]">Détecté :</span>
            {parsed.intents.map((id) => (
              <span key={id} className="chip bg-[color-mix(in_srgb,var(--color-brand)_15%,transparent)] text-[var(--color-brand)]">
                {INTENT_BY_ID[id].label}
              </span>
            ))}
            {parsed.element && (
              <span className="chip bg-[var(--color-surface-2)] text-[var(--color-accent-2)]">{ELEMENT_LABEL[parsed.element]}</span>
            )}
            {parsed.work && (
              <span className="chip bg-[var(--color-surface-2)] text-[var(--color-accent-2)]">{workLabels[parsed.work] ?? parsed.work}</span>
            )}
            {parsed.endgame && <span className="chip bg-[color-mix(in_srgb,var(--rar-legendary)_18%,transparent)] text-[var(--rar-legendary)]">Endgame</span>}
            {parsed.requiredKeys.map((k) => (
              <span key={k} className="chip bg-[color-mix(in_srgb,var(--color-good)_16%,transparent)] text-[var(--color-good)]">
                <Lock size={11} /> {palByKey.get(k)?.name ?? k}
              </span>
            ))}
            {parsed.negated.intents.map((id) => (
              <span key={id} className="chip bg-[var(--color-surface-2)] text-[var(--color-faint)] line-through">
                {INTENT_BY_ID[id].label}
              </span>
            ))}
          </div>

          {/* Explication */}
          <div className="mb-3 space-y-1">
            {result.reasons.map((r, i) => (
              <p key={i} className={`flex items-start gap-1.5 text-xs ${!parsed.matched && i === 0 ? 'text-[var(--color-warn)]' : 'text-[var(--color-muted)]'}`}>
                {!parsed.matched && i === 0 && <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
                {r}
              </p>
            ))}
          </div>

          {result.team.length === 0 ? (
            <p className="text-sm text-[var(--color-warn)]">
              Aucun Pal ne correspond{pool === 'owned' ? ' dans ta partie' : ''}. Essaie une autre description
              {pool === 'owned' ? ' ou bascule sur « Tous les Pals ».' : '.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {result.perPal.map(({ pal, stars, why, locked }, i) => (
                  <div
                    key={i}
                    className={`relative flex flex-col items-center gap-1 border p-2 text-center ${
                      locked
                        ? 'border-[color-mix(in_srgb,var(--color-good)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_8%,transparent)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-soft)]'
                    }`}
                  >
                    {locked && (
                      <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-[color-mix(in_srgb,var(--color-good)_20%,transparent)] px-1 py-0.5 text-[9px] font-bold text-[var(--color-good)]">
                        <Lock size={9} /> Imposé
                      </span>
                    )}
                    <PalIcon pal={pal} size={52} ring />
                    <div className="text-xs font-bold leading-tight">{pal.name}</div>
                    <StarRow stars={stars} />
                    <PalTypeBadges pal={pal} size="sm" />
                    {why.length > 0 && (
                      <div className="mt-0.5 text-[10px] leading-tight text-[var(--color-faint)]">{why.join(' · ')}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button className="btn btn-brand" onClick={apply}>
                  <Check size={15} /> Appliquer à mon équipe
                </button>
                {applied && <span className="text-sm text-[var(--color-good)]">✓ Équipe appliquée ci-dessous</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
