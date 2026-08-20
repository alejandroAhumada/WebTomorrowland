import { NavLink, Outlet } from 'react-router-dom'
import { useSelection } from '../state/useSelection'
import { BrandMark } from './BrandMark'

export function Layout() {
  const { selectedIds } = useSelection()
  return <div className="app-shell">
    <header className="site-header">
      <NavLink className="brand" to="/" aria-label="WebTomorrowland, inicio"><BrandMark /><span>WebTomorrowland</span></NavLink>
      <nav aria-label="Navegación principal">
        <NavLink to="/planes/1-persona">1 persona</NavLink>
        <NavLink to="/planes/2-personas">2 personas</NavLink>
        <NavLink className="compare-nav" to="/comparar">Comparar <span>{selectedIds.length}</span></NavLink>
      </nav>
    </header>
    <main><Outlet /></main>
    <footer><BrandMark /><p>Planifica con información clara. Los valores demo son estimaciones, no precios oficiales.</p></footer>
  </div>
}
