import { PageHeader } from '../components/PageHeader'
import { meta } from '../data'

export function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="PalGuide" title="À propos & données" />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card space-y-4 p-6 text-sm leading-relaxed text-[var(--color-muted)]">
          <p>
            <strong className="text-[var(--color-ink)]">PalGuide</strong> est un compagnon non
            officiel pour Palworld 1.0 : Paldex complet, calculateur de reproduction avec chemins
            complets, taux de capture et team builder — le tout en français.
          </p>
          <div>
            <div className="mb-1 font-bold text-[var(--color-ink)]">Sources des données</div>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>PalCalc</strong> (MIT) — noyau : liste des Pals, stats, breeding power et
                graphe de reproduction complet (combos spéciaux inclus).
              </li>
              <li>
                <strong>paldb.cc</strong> — éléments, drops, partner skills, compétences apprises et
                taux de capture.
              </li>
            </ul>
          </div>
          <p className="text-xs text-[var(--color-faint)]">
            Non affilié à Pocketpair. Régénère les données après un patch avec{' '}
            <code className="rounded bg-[var(--color-bg-soft)] px-1.5 py-0.5">npm run scrape-paldb</code>{' '}
            puis <code className="rounded bg-[var(--color-bg-soft)] px-1.5 py-0.5">npm run build-data</code>.
          </p>
          <p className="text-xs text-[var(--color-faint)]">
            Le taux de capture est une estimation calibrée : la formule native du jeu n'est pas
            publiée.
          </p>
        </div>

        <div className="card space-y-1 p-6">
          <div className="mb-2 text-sm font-bold text-[var(--color-brand)]">Version des données</div>
          <Row label="Version du jeu" value={meta.gameVersion} />
          <Row label="Base PalCalc" value={meta.dbVersion} />
          <Row label="Généré le" value={new Date(meta.generatedAt).toLocaleDateString('fr-FR')} />
          <Row label="Nombre de Pals" value={String(meta.palCount)} />
          <Row label="Recettes de breeding" value={meta.breedingPairs.toLocaleString('fr-FR')} />
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] py-1.5 text-sm last:border-0">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
