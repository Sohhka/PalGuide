import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { Heart, Check, Egg, Info, Zap, Swords, Users } from 'lucide-react'
import { pals, passives, elementByKey } from '../data'
import type { Pal } from '../lib/types'
import { PalIcon } from './PalIcon'
import { PalTypeBadges, RarityBadge, WorkBadge, ElementBadge } from './badges'
import { StatBar } from './StatBar'
import { palDexLabel, SIZE_LABEL, genderText, formatNumber } from '../lib/pal-helpers'
import { useStore } from '../store/useStore'

const MAX = {
  hp: Math.max(...pals.map((p) => p.stats.hp)),
  attack: Math.max(...pals.map((p) => Math.max(p.stats.meleeAttack, p.stats.shotAttack))),
  defense: Math.max(...pals.map((p) => p.stats.defense)),
  stamina: Math.max(...pals.map((p) => p.stats.stamina)),
  run: Math.max(...pals.map((p) => p.speeds.run)),
  price: Math.max(...pals.map((p) => p.price)),
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="hud-h mb-3 flex items-center gap-2 text-sm">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function DropsTable({ pal }: { pal: Pal }) {
  const base = pal.drops.filter((d) => !d.levelGate)
  const tiered = pal.drops.filter((d) => d.levelGate)
  if (!pal.drops.length) return <div className="py-2 text-sm text-[var(--color-muted)]">Aucun drop connu.</div>
  const Row = (d: (typeof pal.drops)[0], i: number) => (
    <tr key={i} className="border-t border-[var(--color-border-soft)]">
      <td className="py-1.5">
        <span className="flex items-center gap-2">
          {d.iconUrl && <img src={d.iconUrl} alt="" width={22} height={22} />}
          <span className="text-sm">{d.name}</span>
        </span>
      </td>
      <td className="py-1.5 text-sm text-[var(--color-muted)]">{d.quantity ?? '—'}</td>
      <td className="py-1.5 text-right text-sm font-semibold">{d.rate ?? '—'}</td>
    </tr>
  )
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-faint)]">
            <th className="pb-1 font-semibold">Objet</th>
            <th className="pb-1 font-semibold">Quantité</th>
            <th className="pb-1 text-right font-semibold">Taux</th>
          </tr>
        </thead>
        <tbody>{base.map(Row)}</tbody>
      </table>
      {tiered.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            Drops de boss / haut niveau ({tiered.length})
          </summary>
          <table className="mt-1 w-full">
            <tbody>
              {tiered.map((d, i) => (
                <tr key={i} className="border-t border-[var(--color-border-soft)]">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      {d.iconUrl && <img src={d.iconUrl} alt="" width={20} height={20} />}
                      <span className="text-sm">{d.name}</span>
                      <span className="chip bg-[var(--color-surface-2)] text-[10px] text-[var(--color-faint)]">Niv.{d.levelGate}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-sm text-[var(--color-muted)]">{d.quantity ?? '—'}</td>
                  <td className="py-1.5 text-right text-sm font-semibold">{d.rate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-faint)]">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  )
}

export function PalDetail({ pal, onNavigate }: { pal: Pal; onNavigate?: () => void }) {
  const { isOwned, toggleOwned, favorites, toggleFavorite, team, setTeamSlot } = useStore()
  const guaranteedPassives = useMemo(
    () => pal.guaranteedPassives.map((k) => passives[k]).filter(Boolean),
    [pal],
  )
  const owned = isOwned(pal.key)
  const fav = favorites.includes(pal.key)
  const inTeam = team.includes(pal.key)

  const addToTeam = () => {
    if (inTeam) return
    const slot = team.findIndex((t) => t === null)
    if (slot >= 0) setTeamSlot(slot, pal.key)
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <PalIcon pal={pal} size={104} ring className="mx-auto sm:mx-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-faint)]">{palDexLabel(pal)}</span>
              <RarityBadge rarity={pal.rarity} />
              <PalTypeBadges pal={pal} />
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--color-brand)]">{pal.name}</h1>
            <div className="text-sm text-[var(--color-muted)]">
              {pal.genus ?? '—'} · {SIZE_LABEL[pal.size] ?? pal.size}
              {pal.nocturnal && ' · 🌙 Nocturne'}
            </div>
            {pal.description && (
              <div className="mt-3 flex gap-2 border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2.5">
                <Info size={16} className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
                <p className="text-sm leading-relaxed text-[var(--color-muted)]">{pal.description}</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
            <button className={`btn ${owned ? 'btn-brand' : ''}`} onClick={() => toggleOwned(pal.key)}>
              {owned ? <Check size={16} /> : <Egg size={16} />}
              {owned ? 'Possédé' : 'Je le possède'}
            </button>
            <button className="btn" onClick={() => toggleFavorite(pal.key)}>
              <Heart size={16} fill={fav ? 'currentColor' : 'none'} className={fav ? 'text-[var(--color-accent-2)]' : ''} />
              Favori
            </button>
            <button className="btn" onClick={addToTeam} disabled={inTeam} title={inTeam ? 'Déjà dans l\'équipe' : 'Ajouter à l\'équipe'}>
              <Users size={16} /> {inTeam ? 'Dans l\'équipe' : 'Équipe'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section title="Statistiques" icon={<Swords size={15} />}>
            <div className="space-y-1.5">
              <StatBar label="PV" value={pal.stats.hp} max={MAX.hp} color="#ff7a8a" />
              <StatBar label="Attaque mêlée" value={pal.stats.meleeAttack} max={MAX.attack} color="#ff9f5f" />
              <StatBar label="Attaque à distance" value={pal.stats.shotAttack} max={MAX.attack} color="#ffb020" />
              <StatBar label="Défense" value={pal.stats.defense} max={MAX.defense} color="#5fd1ff" />
              <StatBar label="Endurance" value={pal.stats.stamina} max={MAX.stamina} color="#4ade80" />
              <StatBar label="Vitesse (course)" value={pal.speeds.run} max={MAX.run} color="#4fcdec" />
              <StatBar label="Prix" value={pal.price} max={MAX.price} color="#a78bfa" />
            </div>
          </Section>

          <Section title="Drops possibles">
            <DropsTable pal={pal} />
          </Section>

          <Section title="Reproduction & capture" icon={<Egg size={15} />}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info2 label="Breeding power" value={formatNumber(pal.breedingPower)} />
              <Info2 label="Genre" value={genderText(pal.maleProbability)} />
              <Info2 label="Niveau sauvage" value={pal.minLevel != null ? `${pal.minLevel}–${pal.maxLevel}` : 'Élevage/boss'} />
              <Info2 label="Capture (corr.)" value={`×${pal.captureRateCorrect}`} />
            </div>
            <Link to={`/breeding?child=${pal.key}`} onClick={onNavigate} className="btn btn-brand mt-3 w-full">
              Voir les combinaisons de breeding →
            </Link>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Aptitudes de travail">
            {Object.keys(pal.work).length ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(pal.work)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <WorkBadge key={k} workKey={k} level={v} />
                  ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--color-muted)]">Aucune aptitude de travail.</div>
            )}
          </Section>

          {pal.partnerSkill && (
            <Section title={`Partner Skill : ${pal.partnerSkill.title}`}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-muted)]">
                {pal.partnerSkill.description}
              </p>
              {pal.partnerSkill.noStack && (
                <div className="mt-2 inline-flex chip bg-[var(--color-surface-2)] text-[var(--color-warn)]">Ne se cumule pas</div>
              )}
            </Section>
          )}

          {guaranteedPassives.length > 0 && (
            <Section title="Passifs garantis">
              <div className="space-y-2">
                {guaranteedPassives.map((p, i) => (
                  <div key={i} className="border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2">
                    <div className="text-sm font-bold">{p.name}</div>
                    {p.description && <div className="text-xs text-[var(--color-muted)]">{p.description}</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Compétences actives" icon={<Zap size={15} />}>
            <div className="space-y-2">
              {pal.activeSkills.map((s, i) => {
                const el = s.element ? elementByKey.get(s.element) : null
                return (
                  <div key={i} className="border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {s.level != null && (
                        <span className="chip bg-[var(--color-surface-2)] text-[var(--color-faint)]">Niv. {s.level}</span>
                      )}
                      <span className="font-bold">{s.name}</span>
                      {el && <ElementBadge elementKey={el.key} size="sm" />}
                      {s.hasSkillFruit && <span className="chip bg-[var(--color-surface-2)] text-[var(--color-good)]">🍈 Fruit</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
                      {s.power != null && <span>Puissance <b className="text-[var(--color-ink)]">{s.power}</b></span>}
                      {s.cooldown != null && <span>Recharge <b className="text-[var(--color-ink)]">{s.cooldown}s</b></span>}
                      {s.rangeMin != null && <span>Portée <b className="text-[var(--color-ink)]">{s.rangeMin}–{s.rangeMax}</b></span>}
                    </div>
                  </div>
                )
              })}
              {pal.activeSkills.length === 0 && <div className="text-sm text-[var(--color-muted)]">Aucune compétence listée.</div>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
