import { Link } from 'react-router-dom'
import { ComparisonBar } from '../components/ComparisonBar'
import { PlanCard } from '../components/PlanCard'
import { usePlans } from '../hooks/usePlans'
import { useSelection } from '../state/useSelection'

export function PlansPage({ travelerCount }: { travelerCount: 1 | 2 }) {
  const { plans, loading, error } = usePlans(travelerCount)
  const { isSelected, isFull, toggle } = useSelection()
  return <div className="page-container plans-page">
    <div className="page-heading"><div><p className="eyebrow">Explorar alternativas</p><h1>Plan {travelerCount} {travelerCount === 1 ? 'persona' : 'personas'}</h1><p>Cada precio indica claramente si es estimado u oficial.</p></div><Link className="switch-link" to={travelerCount === 1 ? '/planes/2-personas' : '/planes/1-persona'}>Ver plan para {travelerCount === 1 ? '2 personas' : '1 persona'} →</Link></div>
    {loading && <p className="notice">Cargando alternativas…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && plans.length === 0 && <p className="notice">Aún no hay alternativas publicadas para esta modalidad.</p>}
    {!loading && !error && <div className="plans-grid">{plans.map((plan) => <PlanCard key={plan.id} plan={plan} selected={isSelected(plan.id)} disabled={isFull} onToggle={() => toggle(plan.id)} />)}</div>}
    <ComparisonBar />
  </div>
}
