import { ArrowRight, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ComparisonBar } from '../components/ComparisonBar'
import { PlanCard } from '../components/PlanCard'
import { PlanDetailDialog } from '../components/PlanDetailDialog'
import { useState } from 'react'
import type { TravelPlan } from '../models/plan'
import { usePlans } from '../hooks/usePlans'
import { useSelection } from '../state/useSelection'
import { sortPlansByPrice } from '../utils/sortPlans'

export function PlansPage({ travelerCount }: { travelerCount: 1 | 2 }) {
  const { plans, loading, error } = usePlans(travelerCount)
  const { isSelected, isFull, toggle } = useSelection()
  const TravelersIcon = travelerCount === 1 ? UserRound : UsersRound
  const sortedPlans = sortPlansByPrice(plans)
  const [detailedPlan, setDetailedPlan] = useState<TravelPlan | null>(null)
  return <div className="page-container plans-page">
    <div className="page-heading"><div><p className="eyebrow">Explora tu experiencia</p><h1><TravelersIcon aria-hidden="true" />Plan {travelerCount} {travelerCount === 1 ? 'persona' : 'personas'}</h1><p>Compara precios, alojamiento e inclusiones. Cada valor indica claramente su procedencia.</p></div><Link className="switch-link" to={travelerCount === 1 ? '/planes/2-personas' : '/planes/1-persona'}>Ver plan para {travelerCount === 1 ? '2 personas' : '1 persona'} <ArrowRight aria-hidden="true" /></Link></div>
    {loading && <p className="notice">Cargando alternativas…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && plans.length === 0 && <p className="notice">Aún no hay alternativas publicadas para esta modalidad.</p>}
    {!loading && !error && <div className="plans-grid">{sortedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} selected={isSelected(plan.id)} disabled={isFull} onToggle={() => toggle(plan.id)} onOpenDetails={() => setDetailedPlan(plan)} />)}</div>}
    {detailedPlan && <PlanDetailDialog plan={detailedPlan} onClose={() => setDetailedPlan(null)} />}
    <ComparisonBar />
  </div>
}
