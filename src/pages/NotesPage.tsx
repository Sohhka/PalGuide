import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Trash2, StickyNote, Save, X, Bold, Italic, Strikethrough, Heading,
  List, ListOrdered, Quote, Code, Link as LinkIcon, CheckSquare, Smile, Eye, Pencil,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PalPickerButton } from '../components/PalPicker'
import { PalIcon } from '../components/PalIcon'
import { Markdown } from '../components/Markdown'
import { palByKey } from '../data'
import { useStore } from '../store/useStore'
import type { Pal } from '../lib/types'

const EMOJIS = ['⭐', '🎯', '⚔️', '🛡️', '🥚', '🔥', '💧', '🌱', '⚡', '❄️', '🌑', '🐲', '👑', '💰', '🔨', '🏠', '✅', '⬜', '📌', '💡', '❤️', '🎉']

export function NotesPage() {
  const { notes, addNote, updateNote, deleteNote } = useStore()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Notes"
        title="Notes & projets"
        subtitle="Garde tes objectifs d'élevage, tes builds et tes idées — avec mise en forme markdown, listes de tâches et emojis. Tout est sauvegardé en local."
        actions={
          <button className="btn btn-brand" onClick={() => setEditing('new')}>
            <Plus size={16} /> Nouvelle note
          </button>
        }
      />

      {editing === 'new' && (
        <NoteEditor onCancel={() => setEditing(null)} onSave={(data) => { addNote(data); setEditing(null) }} />
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
              <NoteEditor key={n.id} initial={n} onCancel={() => setEditing(null)} onSave={(data) => { updateNote(n.id, data); setEditing(null) }} />
            ) : (
              <div key={n.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 text-left" onClick={() => setEditing(n.id)}>
                    <h3 className="truncate font-bold">{n.title || 'Sans titre'}</h3>
                  </button>
                  <div className="flex shrink-0 gap-0.5">
                    <button className="btn-icon" title="Éditer" onClick={() => setEditing(n.id)}><Pencil size={15} /></button>
                    <button className="btn-icon hover:!text-[var(--color-bad)]" title="Supprimer" onClick={() => deleteNote(n.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {n.palKey && palByKey.get(n.palKey) && (
                  <Link to={`/paldex/${n.palKey}`} className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs text-[var(--color-brand)]">
                    <PalIcon pal={palByKey.get(n.palKey)!} size={18} /> {palByKey.get(n.palKey)!.name}
                  </Link>
                )}
                {n.body && <div className="mt-2"><Markdown>{n.body}</Markdown></div>}
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

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="btn-icon" title={title} onMouseDown={(e) => { e.preventDefault(); onClick() }}>
      {children}
    </button>
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
  const [preview, setPreview] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const edit = (fn: (val: string, s: number, e: number) => { text: string; selStart: number; selEnd: number }) => {
    const ta = taRef.current
    const s = ta?.selectionStart ?? body.length
    const e = ta?.selectionEnd ?? body.length
    const r = fn(body, s, e)
    setBody(r.text)
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(r.selStart, r.selEnd) })
  }
  const wrap = (pre: string, post = pre) => edit((val, s, e) => {
    const sel = val.slice(s, e) || 'texte'
    return { text: val.slice(0, s) + pre + sel + post + val.slice(e), selStart: s + pre.length, selEnd: s + pre.length + sel.length }
  })
  const prefix = (p: string) => edit((val, s, e) => {
    const ls = val.lastIndexOf('\n', s - 1) + 1
    return { text: val.slice(0, ls) + p + val.slice(ls), selStart: s + p.length, selEnd: e + p.length }
  })
  const link = () => edit((val, s, e) => {
    const sel = val.slice(s, e) || 'texte'
    const ins = `[${sel}](url)`
    return { text: val.slice(0, s) + ins + val.slice(e), selStart: s + ins.length - 4, selEnd: s + ins.length - 1 }
  })
  const insert = (str: string) => edit((val, s, e) => ({ text: val.slice(0, s) + str + val.slice(e), selStart: s + str.length, selEnd: s + str.length }))

  return (
    <div className="card space-y-3 p-4 md:col-span-2">
      <input className="input text-base font-bold" placeholder="Titre de la note" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-1 border-y border-[var(--color-border-soft)] py-1.5">
        <ToolBtn title="Gras" onClick={() => wrap('**')}><Bold size={15} /></ToolBtn>
        <ToolBtn title="Italique" onClick={() => wrap('*')}><Italic size={15} /></ToolBtn>
        <ToolBtn title="Barré" onClick={() => wrap('~~')}><Strikethrough size={15} /></ToolBtn>
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        <ToolBtn title="Titre" onClick={() => prefix('## ')}><Heading size={15} /></ToolBtn>
        <ToolBtn title="Liste" onClick={() => prefix('- ')}><List size={15} /></ToolBtn>
        <ToolBtn title="Liste numérotée" onClick={() => prefix('1. ')}><ListOrdered size={15} /></ToolBtn>
        <ToolBtn title="Case à cocher" onClick={() => prefix('- [ ] ')}><CheckSquare size={15} /></ToolBtn>
        <ToolBtn title="Citation" onClick={() => prefix('> ')}><Quote size={15} /></ToolBtn>
        <ToolBtn title="Code" onClick={() => wrap('`')}><Code size={15} /></ToolBtn>
        <ToolBtn title="Lien" onClick={link}><LinkIcon size={15} /></ToolBtn>
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        <button type="button" className={`btn-icon ${emojiOpen ? 'text-[var(--color-brand)]' : ''}`} title="Emojis" onClick={() => setEmojiOpen((o) => !o)}><Smile size={15} /></button>
        <div className="flex-1" />
        <button type="button" className="btn py-1" onClick={() => setPreview((p) => !p)}>
          {preview ? <><Pencil size={14} /> Éditer</> : <><Eye size={14} /> Aperçu</>}
        </button>
      </div>

      {emojiOpen && (
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((em) => (
            <button key={em} type="button" className="rounded px-1.5 py-1 text-lg hover:bg-[var(--color-surface-2)]" onMouseDown={(e) => { e.preventDefault(); insert(em) }}>{em}</button>
          ))}
        </div>
      )}

      {/* Zone d'édition / aperçu */}
      {preview ? (
        <div className="min-h-[120px] rounded border border-[var(--color-border-soft)] bg-[var(--color-bg-soft)] p-3">
          {body.trim() ? <Markdown>{body}</Markdown> : <span className="text-sm text-[var(--color-faint)]">Rien à prévisualiser.</span>}
        </div>
      ) : (
        <textarea
          ref={taRef}
          className="input min-h-[160px] resize-y font-mono text-sm"
          placeholder="Ton contenu en markdown : **gras**, listes, - [ ] tâches, emojis 🎯…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <PalPickerButton value={pal} onChange={setPal} placeholder="Associer un Pal (optionnel)" />
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={onCancel}><X size={15} /> Annuler</button>
          <button className="btn btn-brand" onClick={() => onSave({ title, body, palKey: pal?.key ?? null })}><Save size={15} /> Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
