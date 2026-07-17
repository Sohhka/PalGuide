import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, StickyNote, Save, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { palByKey } from '../data'
import { useStore } from '../store/useStore'
import type { Pal } from '../lib/types'

export function NotesPage() {
  const { notes, addNote, updateNote, deleteNote } = useStore()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Notes"
        title="Notes & projets"
        subtitle="Garde tes objectifs d'élevage, tes builds et tes idées. Tout est sauvegardé dans ton navigateur."
        actions={
          <button className="btn btn-brand" onClick={() => setEditing('new')}>
            <Plus size={16} /> Nouvelle note
          </button>
        }
      />

      {editing === 'new' && (
        <NoteEditor
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            addNote(data)
            setEditing(null)
          }}
        />
      )}

      {notes.length === 0 && editing !== 'new' ? (
        <div className="card grid place-items-center py-16 text-center text-[var(--color-muted)]">
          <StickyNote size={28} className="mb-2 text-[var(--color-faint)]" />
          Aucune note pour l'instant. Crée ta première note pour planifier tes projets Palworld.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notes.map((n) =>
            editing === n.id ? (
              <NoteEditor
                key={n.id}
                initial={n}
                onCancel={() => setEditing(null)}
                onSave={(data) => {
                  updateNote(n.id, data)
                  setEditing(null)
                }}
              />
            ) : (
              <div key={n.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <button className="text-left" onClick={() => setEditing(n.id)}>
                    <h3 className="font-bold">{n.title || 'Sans titre'}</h3>
                  </button>
                  <button
                    className="rounded-lg p-1 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-bad)]"
                    onClick={() => deleteNote(n.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {n.palKey && palByKey.get(n.palKey) && (
                  <Link to={`/paldex/${n.palKey}`} className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs text-[var(--color-brand)]">
                    <PalIcon pal={palByKey.get(n.palKey)!} size={18} /> {palByKey.get(n.palKey)!.name}
                  </Link>
                )}
                {n.body && <p className="mt-2 whitespace-pre-line text-sm text-[var(--color-muted)]">{n.body}</p>}
                <div className="mt-auto pt-3 text-[11px] text-[var(--color-faint)]">
                  Modifié le {new Date(n.updatedAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </>
  )
}

function NoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { title: string; body: string; palKey: string | null }
  onSave: (data: { title: string; body: string; palKey: string | null }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [pal, setPal] = useState<Pal | null>(initial?.palKey ? palByKey.get(initial.palKey) ?? null : null)

  return (
    <div className="card space-y-3 p-4 md:col-span-2">
      <input className="input text-base font-bold" placeholder="Titre de la note" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea
        className="input min-h-[120px] resize-y"
        placeholder="Ton contenu : objectifs d'élevage, passifs recherchés, build…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <PalPickerButton value={pal} onChange={setPal} placeholder="Associer un Pal (optionnel)" />
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={onCancel}>
            <X size={15} /> Annuler
          </button>
          <button className="btn btn-brand" onClick={() => onSave({ title, body, palKey: pal?.key ?? null })}>
            <Save size={15} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
