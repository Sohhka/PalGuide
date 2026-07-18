import { createHashRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PaldexPage } from './pages/PaldexPage'
import { PalDetailPage } from './pages/PalDetailPage'
import { BreedingPage } from './pages/BreedingPage'
import { BreedingTreePage } from './pages/BreedingTreePage'
import { CapturePage } from './pages/CapturePage'
import { ItemsPage } from './pages/ItemsPage'
import { TeamBuilderPage } from './pages/TeamBuilderPage'
import { NotesPage } from './pages/NotesPage'
import { DataImportPage } from './pages/DataImportPage'
import { MapPage } from './pages/MapPage'
import { AboutPage } from './pages/AboutPage'

// HashRouter : fonctionne sans config serveur (ouverture directe du build, GitHub Pages, etc.)
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/paldex" replace /> },
      { path: 'paldex', element: <PaldexPage /> },
      { path: 'paldex/:palId', element: <PalDetailPage /> },
      { path: 'breeding', element: <BreedingPage /> },
      { path: 'breeding/arbre', element: <BreedingTreePage /> },
      { path: 'capture', element: <CapturePage /> },
      { path: 'objets', element: <ItemsPage /> },
      { path: 'equipe', element: <TeamBuilderPage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'ma-partie', element: <DataImportPage /> },
      { path: 'carte', element: <MapPage /> },
      { path: 'a-propos', element: <AboutPage /> },
      { path: '*', element: <Navigate to="/paldex" replace /> },
    ],
  },
])
