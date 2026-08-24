import { BedDouble, BookmarkCheck, Check, Eye, Plane, TentTree, Ticket, UserRound, UsersRound } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTravelBudget } from '../hooks/useTravelBudget'
import { useTicketTiers } from '../hooks/useTicketTiers'
import type { TravelPlan } from '../models/plan'
import { getPlanCatalogEntry, getPlanClassificationLabel, getPlanTierOptions } from '../models/planCatalog'
import { budgetItemTotalMoney } from '../models/travelBudget'
import { useMyTrip } from '../state/useMyTrip'
import { formatMoney } from '../utils/format'
import { PriceBadge } from './PriceBadge'
import { TravelBudgetSummary } from './TravelBudgetView'

interface PlanCardProps { plan: TravelPlan; selected: boolean; disabled: boolean; onToggle: () => void; onOpenDetails: () => void }

export function PlanCard({ plan, selected, disabled, onToggle, onOpenDetails }: PlanCardProps) {
  const { budget, loading: budgetLoading } = useTravelBudget(plan)
  const PlanIcon = plan.category === 'GLOBAL_JOURNEY' ? Plane : plan.dreamVilleIncluded ? TentTree : Ticket
  const TravelersIcon = plan.travelerCount === 1 ? UserRound : UsersRound
  const { isMyPlan } = useMyTrip()
  const { tiers } = useTicketTiers()
  const availableTiers = getPlanTierOptions(plan, tiers)
  const catalogEntry = getPlanCatalogEntry(plan.id)
  const tomorrowlandItem = budget.items.find((item) => item.category === 'TOMORROWLAND')
  const clpPrice = tomorrowlandItem ? budgetItemTotalMoney(tomorrowlandItem) : null
  const accommodationLabel = budget.accommodationIncluded ? 'Alojamiento incluido' : 'Alojamiento por separado'
  const preventCardAction = (event: MouseEvent) => event.stopPropagation()

  return <article className={`plan-card decision-card ${selected ? 'selected' : ''}`} onClick={onOpenDetails}>
    <div className="card-topline"><span className="plan-type-icon"><PlanIcon aria-hidden="true" /></span><span className="card-badges"><PriceBadge type={plan.priceType} />{isMyPlan(plan.id) && <span className="my-plan-badge"><BookmarkCheck aria-hidden="true" />Mi plan</span>}</span></div>
    <p className="category">{getPlanClassificationLabel(plan)}</p>
    <h2>{plan.name}</h2>
    <p className="card-plan-summary"><TravelersIcon aria-hidden="true" />{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}<span aria-hidden="true">·</span><BedDouble aria-hidden="true" />{accommodationLabel}</p>
    {catalogEntry?.classification === 'DERIVED_SCENARIO' && <p className="catalog-kind"><strong>2 entradas individuales</strong> · no es un pack oficial 2P</p>}
    <div className="decision-price" aria-label="Precio del producto Tomorrowland">
      {plan.totalPrice ? <>
        <strong className="decision-clp">{clpPrice ? `≈ ${formatMoney(clpPrice)} CLP` : 'Equivalencia CLP no disponible'}</strong>
        <span className="decision-brl">{catalogEntry?.classification === 'DERIVED_SCENARIO' ? `${formatMoney(plan.totalPrice)} · cálculo total` : `${formatMoney(plan.totalPrice)} · precio oficial Tomorrowland`}</span>
        {catalogEntry?.classification === 'DERIVED_SCENARIO' && <small>{formatMoney({ amount: plan.totalPrice.amount / plan.travelerCount, currency: plan.totalPrice.currency })} × {plan.travelerCount}</small>}
      </> : <><strong className="pending-price">Precio aún no publicado</strong><span>Tomorrowland todavía no informa el precio</span></>}
    </div>
    <TravelBudgetSummary budget={budget} loading={budgetLoading} />
    {availableTiers.length > 0 && <p className="tier-summary"><span>Modalidades</span><strong>{availableTiers.map(({ tier }) => tier.name).join(' · ')}</strong></p>}
    <div className="card-actions"><button className="button detail-button" type="button" onClick={(event) => { preventCardAction(event); onOpenDetails() }}><Eye aria-hidden="true" />Ver plan</button><button className={`button secondary compare-button ${selected ? 'selected-button' : ''}`} type="button" onClick={(event) => { preventCardAction(event); onToggle() }} disabled={disabled && !selected} aria-pressed={selected}>{selected ? <><Check aria-hidden="true" />En comparación</> : 'Comparar'}</button></div>
  </article>
}
