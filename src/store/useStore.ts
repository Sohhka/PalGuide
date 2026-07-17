import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ImportedSave } from '../lib/types'

export interface Note {
  id: string
  title: string
  body: string
  palKey: string | null
  createdAt: number
  updatedAt: number
}

interface AppState {
  // Pals possédés (par clé interne) — utilisés par le path finder
  owned: string[]
  toggleOwned: (key: string) => void
  setOwned: (keys: string[]) => void
  isOwned: (key: string) => boolean

  // Équipe : 5 emplacements (clé interne ou null)
  team: (string | null)[]
  setTeamSlot: (index: number, key: string | null) => void
  clearTeam: () => void

  // Sauvegarde importée (REMPLACÉE à chaque import — jamais fusionnée)
  importedSave: ImportedSave | null
  setImportedSave: (save: ImportedSave | null) => void
  clearImportedSave: () => void
  // Personnage sélectionné (saves coop/serveur multijoueur)
  selectedPlayerUid: string | null
  setSelectedPlayerUid: (uid: string | null) => void

  // Favoris
  favorites: string[]
  toggleFavorite: (key: string) => void

  // Notes
  notes: Note[]
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void
  deleteNote: (id: string) => void
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      owned: [],
      toggleOwned: (key) =>
        set((s) => ({
          owned: s.owned.includes(key) ? s.owned.filter((k) => k !== key) : [...s.owned, key],
        })),
      setOwned: (keys) => set({ owned: [...new Set(keys)] }),
      isOwned: (key) => get().owned.includes(key),

      team: [null, null, null, null, null],
      setTeamSlot: (index, key) =>
        set((s) => {
          const team = [...s.team]
          team[index] = key
          return { team }
        }),
      clearTeam: () => set({ team: [null, null, null, null, null] }),

      importedSave: null,
      selectedPlayerUid: null,
      // Remplace intégralement la save précédente (aucune fusion possible).
      // Sélectionne par défaut le personnage ayant le plus de Pals (ton perso principal).
      setImportedSave: (save) =>
        set({
          importedSave: save,
          selectedPlayerUid:
            save && save.players.length
              ? [...save.players].sort((a, b) => b.palCount - a.palCount)[0].uid
              : null,
        }),
      clearImportedSave: () => set({ importedSave: null, selectedPlayerUid: null }),
      setSelectedPlayerUid: (uid) => set({ selectedPlayerUid: uid }),

      favorites: [],
      toggleFavorite: (key) =>
        set((s) => ({
          favorites: s.favorites.includes(key)
            ? s.favorites.filter((k) => k !== key)
            : [...s.favorites, key],
        })),

      notes: [],
      addNote: (note) => {
        const id = uid()
        const now = Date.now()
        set((s) => ({ notes: [{ ...note, id, createdAt: now, updatedAt: now }, ...s.notes] }))
        return id
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
          ),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    { name: 'palguide-v1' },
  ),
)
