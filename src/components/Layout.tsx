import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Egg, Network, Target, Package, Users, StickyNote, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TitleBar } from './TitleBar'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

const NAV: NavItem[] = [
  { to: '/paldex', label: 'Paldex', icon: BookOpen },
  { to: '/breeding', label: 'Breeding', icon: Egg, end: true },
  { to: '/breeding/arbre', label: 'Arbre', icon: Network },
  { to: '/capture', label: 'Capture', icon: Target },
  { to: '/objets', label: 'Objets', icon: Package },
  { to: '/equipe', label: 'Équipe', icon: Users },
  { to: '/notes', label: 'Notes', icon: StickyNote },
]

const TAB_CLIP = 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)'

function Tab({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} className="group relative">
      {({ isActive }) => (
        <span
          className={[
            'flex items-center gap-2 px-4 py-2 text-sm font-bold tracking-wide transition-all',
            isActive
              ? 'bg-gradient-to-b from-[var(--color-brand)] to-[var(--color-accent)] text-[#04222c]'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
          ].join(' ')}
          style={{ clipPath: TAB_CLIP }}
        >
          <Icon size={16} />
          {item.label}
        </span>
      )}
    </NavLink>
  )
}

export function Layout() {
  return (
    <div className="flex h-screen flex-col">
      <TitleBar />

      {/* Barre d'onglets style jeu */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-soft)]/60 px-4 py-2 backdrop-blur">
        {NAV.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
        <div className="flex-1" />
        <NavLink
          to="/a-propos"
          className={({ isActive }) =>
            [
              'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors',
              isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-faint)] hover:text-[var(--color-ink)]',
            ].join(' ')
          }
        >
          <Info size={15} /> À propos
        </NavLink>
      </div>

      {/* Contenu */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
