import { ArrowRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlans } from '../hooks/usePlans'
import { useSelection } from '../state/useSelection'
export function ComparisonBar() {
  const { selectedIds, clear } = useSelection()
  const { plans } = usePlans(undefined, selectedIds)
  if (selectedIds.length === 0) return null
  const selectedPlans = plans.filter((plan) => selectedIds.includes(plan.id))
  return <aside className="comparison-bar" aria-live="polite"><div className="comparison-summary"><strong>{selectedIds.length} {selectedIds.length === 1 ? 'plan seleccionado' : 'planes seleccionados'}</strong><span>{selectedPlans.map((plan) => plan.name).join(' · ')}</span></div><div className="comparison-actions"><button type="button" onClick={clear}><X aria-hidden="true" />Limpiar</button><Link className="button" to="/comparar">Comparar <ArrowRight aria-hidden="true" /></Link></div></aside>
}
