import { ArrowUpRight, BookmarkCheck, Bus, Check, CircleCheck, CircleX, Eye, Hotel, Plane, TentTree, Ticket, UserRound, UsersRound } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTravelBudget } from '../hooks/useTravelBudget'
import type { TravelPlan } from '../models/plan'
import { getPricePerPerson } from '../models/plan'
import { categoryLabels, formatDate, formatMoney } from '../utils/format'
import { AvailabilityBadge } from './AvailabilityBadge'
import { PriceBadge } from './PriceBadge'
import { ClpConversion } from './ClpConversion'
import { TravelBudgetSummary } from './TravelBudgetView'
import { useMyTrip } from '../state/useMyTrip'
import { useTicketTiers } from '../hooks/useTicketTiers'
import { getPlanCatalogEntry, getPlanTierOptions } from '../models/planCatalog'

interface PlanCardProps { plan: TravelPlan; selected: boolean; disabled: boolean; onToggle: () => void; onOpenDetails: () => void }

export function PlanCard({ plan, selected, disabled, onToggle, onOpenDetails }: PlanCardProps) {
  const pricePerPerson = getPricePerPerson(plan)
  const { budget, loading: budgetLoading } = useTravelBudget(plan)
  const PlanIcon = plan.category === 'GLOBAL_JOURNEY' ? Plane : plan.dreamVilleIncluded ? TentTree : Ticket
  const TravelersIcon = plan.travelerCount === 1 ? UserRound : UsersRound
  const { isMyPlan } = useMyTrip()
  const { tiers } = useTicketTiers()
  const availableTiers = getPlanTierOptions(plan, tiers)
  const catalogEntry = getPlanCatalogEntry(plan.id)

  const preventCardAction = (event: MouseEvent) => event.stopPropagation()
  return <article className={`plan-card ${selected ? 'selected' : ''}`} onClick={onOpenDetails}>
    <div className="card-topline"><span className="plan-type-icon"><PlanIcon aria-hidden="true" /></span><span className="card-badges"><PriceBadge type={plan.priceType} />{isMyPlan(plan.id) && <span className="my-plan-badge"><BookmarkCheck aria-hidden="true" />Mi plan</span>}</span></div>
    <p className="category">{categoryLabels[plan.category]}</p>
    <h2>{plan.name}</h2>
    {catalogEntry?.classification === 'DERIVED_SCENARIO' && <p className="catalog-kind">Escenario derivado · no es un pack oficial 2P</p>}
    <p className="traveler-label"><TravelersIcon aria-hidden="true" />{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}</p>
    {availableTiers.length > 0 && <p className="tier-summary"><span>Modalidades disponibles</span><strong>{availableTiers.map(({ tier }) => tier.name).join(' · ')}</strong></p>}
    <div className="price-block">
      {plan.totalPrice && pricePerPerson ? <>
        <strong>{formatMoney(plan.totalPrice)}</strong><span>Precio total · {plan.totalPrice.currency}</span>
        <ClpConversion money={plan.totalPrice} />
        <p>{formatMoney(pricePerPerson)} <small>por persona</small></p>
      </> : <><strong className="pending-price">Precio pendiente</strong><span>Aún no publicado</span><p>Se actualizará al publicarse oficialmente</p></>}
    </div>
    <TravelBudgetSummary budget={budget} loading={budgetLoading} />
    <dl className="plan-details"><div><dt><Hotel aria-hidden="true" />Alojamiento</dt><dd>{plan.accommodation}</dd></div><div><dt><Bus aria-hidden="true" />Transporte</dt><dd>{plan.transport}</dd></div></dl>
    <FeatureList title="Incluye" items={plan.inclusions} included />
    {plan.notIncluded.length > 0 && <FeatureList title="No incluido" items={plan.notIncluded} />}
    <div className="card-meta"><AvailabilityBadge status={plan.status} />{plan.sources.length > 0 && <p className="source"><span>Verificado {formatDate(plan.sources[0].verifiedAt)}</span>{plan.sources.map((source) => source.url ? <a key={`${source.label}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" onClick={preventCardAction} aria-label={`${source.label}, abre en una nueva pestaña`}>{source.type === 'OFFICIAL' ? 'Fuente oficial' : source.label}<ArrowUpRight aria-hidden="true" /></a> : null)}</p>}</div>
    <div className="card-actions"><button className="button secondary detail-button" type="button" onClick={(event) => { preventCardAction(event); onOpenDetails() }}><Eye aria-hidden="true" />Ver detalles</button><button className={`button compare-button ${selected ? 'selected-button' : ''}`} type="button" onClick={(event) => { preventCardAction(event); onToggle() }} disabled={disabled && !selected} aria-pressed={selected}>{selected ? <><Check aria-hidden="true" />Seleccionado</> : 'Comparar'}</button></div>
  </article>
}

function FeatureList({ title, items, included = false }: { title: string; items: string[]; included?: boolean }) {
  const Icon = included ? CircleCheck : CircleX
  return <section className={`feature-list ${included ? 'included' : 'excluded'}`}><h3>{title}</h3><ul>{items.map((item) => <li key={item}><Icon aria-hidden="true" />{item}</li>)}</ul></section>
}
