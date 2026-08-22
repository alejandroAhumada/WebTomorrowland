import { Columns3 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSelection } from '../state/useSelection'
import { BrandMark } from './BrandMark'

export function Layout() {
  const { selectedIds } = useSelection()
  return <div className="app-shell">
    <header className="site-header">
      <NavLink className="brand" to="/" aria-label="WebTomorrowland, inicio"><BrandMark /><span><strong>Web</strong>Tomorrowland</span></NavLink>
      <nav aria-label="Navegación principal">
        <NavLink to="/planes/1-persona">Plan 1</NavLink>
        <NavLink to="/planes/2-personas">Plan 2</NavLink>
        <NavLink className="compare-nav" to="/comparar"><Columns3 aria-hidden="true" />Comparar <span>{selectedIds.length}</span></NavLink>
      </nav>
    </header>
    <main><Outlet /></main>
    <footer><div className="footer-brand"><BrandMark /><span>WebTomorrowland</span></div><p>Herramienta informativa independiente. Tomorrowland y sus marcas pertenecen a sus respectivos titulares.</p></footer>
  </div>
}
