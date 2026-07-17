import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { palByKey } from '../data'
import { PalDetail } from '../components/PalDetail'

export function PalDetailPage() {
  const { palId } = useParams()
  const pal = palId ? palByKey.get(palId) : undefined

  if (!pal) {
    return (
      <div className="card grid place-items-center py-20 text-center">
        <div>
          <div className="mb-2 text-lg font-bold">Pal introuvable</div>
          <Link to="/paldex" className="text-brand hover:underline">
            ← Retour au Paldex
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/paldex" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft size={15} /> Paldex
      </Link>
      <PalDetail pal={pal} />
    </div>
  )
}
