import { Link } from 'react-router-dom'
import { useSelection } from '../state/useSelection'
export function ComparisonBar() {
  const { selectedIds, clear } = useSelection()
  if (selectedIds.length === 0) return null
  return <aside className="comparison-bar" aria-live="polite"><p><strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? 'alternativa seleccionada' : 'alternativas seleccionadas'}</p><div><button type="button" onClick={clear}>Limpiar</button><Link className="button" to="/comparar">Comparar ahora</Link></div></aside>
}
