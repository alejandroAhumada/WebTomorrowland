import { ArrowRight, Check, Columns3, UserRound, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlanRecommendations } from '../hooks/usePlanRecommendations'
import { useExchangeRate } from '../hooks/useExchangeRate'
import { convertMoney } from '../models/exchangeRate'
import type { PlanRecommendation, PlanRecommendationCriterion } from '../models/planRecommendation'
import { getPlanCatalogEntry } from '../models/planCatalog'
import { useSelection } from '../state/useSelection'
import { formatMoney } from '../utils/format'
import { PlanDetailDialog } from './PlanDetailDialog'
import { useMyTrip } from '../state/useMyTrip'
import { usePlans } from '../hooks/usePlans'

const criterionLabels: Record<PlanRecommendationCriterion, string> = {
  LOWEST_TRIP_BUDGET: 'Viaje estimado más bajo',
  LOWEST_TOMORROWLAND_PRICE: 'Precio Tomorrowland más bajo',
  LOWEST_BUDGET_WITH_ACCOMMODATION: 'Menor costo de viaje con alojamiento incluido',
}

export function PlanRecommendationsSection({ secondary = false }: { secondary?: boolean }) {
  const [travelerChoice, setTravelerChoice] = useState<{ contextId: string | null; count: 1 | 2 } | null>(null)
  const [detailed, setDetailed] = useState<PlanRecommendation['plan'] | null>(null)
  const { replace } = useSelection()
  const navigate = useNavigate()
  const { selectedPlanId } = useMyTrip()
  const { plans: selectedPlans } = usePlans(undefined, secondary && selectedPlanId ? [selectedPlanId] : [])
  const travelerCount = travelerChoice?.contextId === (secondary ? selectedPlanId : null) ? travelerChoice.count : selectedPlans[0]?.travelerCount ?? 2
  const excludedPlanIds = useMemo(() => secondary && selectedPlanId ? [selectedPlanId] : [], [secondary, selectedPlanId])
  const { recommendations, loading, error, customized } = usePlanRecommendations(travelerCount, excludedPlanIds)
  const compareIds = recommendations.map((item) => item.plan.id)

  return <section className={`recommendations-section ${secondary ? 'secondary' : ''}`} aria-labelledby="recommendations-title">
    <div className="recommendations-heading"><div><p className="eyebrow">{secondary ? 'Para comparar' : 'Comparación objetiva'}</p><h2 id="recommendations-title">{secondary ? 'Alternativas para comparar' : 'Alternativas para empezar a comparar'}</h2><p>{secondary ? 'Opciones distintas de tu plan, calculadas con el mismo presupuesto.' : 'Destacamos opciones con menores costos según cada criterio. Tú decides cuál encaja contigo.'}</p></div><div className="traveler-switch" role="group" aria-label="Cantidad de viajeros"><button type="button" aria-pressed={travelerCount === 1} onClick={() => setTravelerChoice({ contextId: secondary ? selectedPlanId : null, count: 1 })}><UserRound aria-hidden="true" />1 persona</button><button type="button" aria-pressed={travelerCount === 2} onClick={() => setTravelerChoice({ contextId: secondary ? selectedPlanId : null, count: 2 })}><UsersRound aria-hidden="true" />2 personas</button></div></div>
    <p className="recommendation-basis">{customized ? 'Con tu presupuesto personalizado' : 'Con estimaciones referenciales del viaje'}</p>
    {loading && <p className="recommendations-notice">Calculando alternativas con precio conocido…</p>}
    {!loading && error && <p className="recommendations-notice error" role="alert">No pudimos calcular recomendaciones en este momento.</p>}
    {!loading && !error && recommendations.length === 0 && <p className="recommendations-notice">Aún no hay precios suficientes para destacar alternativas.</p>}
    {!loading && !error && recommendations.length > 0 && <div className="recommendation-grid" data-count={recommendations.length}>{recommendations.map((recommendation) => <RecommendationCard key={recommendation.plan.id} recommendation={recommendation} onOpen={() => setDetailed(recommendation.plan)} />)}</div>}
    {!loading && !error && compareIds.length >= 2 && <button className="button secondary recommendations-compare" type="button" onClick={() => { replace(compareIds); navigate('/comparar') }}><Columns3 aria-hidden="true" />Comparar estas alternativas <ArrowRight aria-hidden="true" /></button>}
    {detailed && <PlanDetailDialog plan={detailed} onClose={() => setDetailed(null)} />}
  </section>
}

export function RecommendationCard({ recommendation, onOpen }: { recommendation: PlanRecommendation; onOpen: () => void }) {
  const travelMetric = recommendation.highlights.find(({ criterion }) => criterion === 'LOWEST_TRIP_BUDGET' || criterion === 'LOWEST_BUDGET_WITH_ACCOMMODATION')?.metric
  const priceMetric = recommendation.highlights.find(({ criterion }) => criterion === 'LOWEST_TOMORROWLAND_PRICE')?.metric
  const derived = getPlanCatalogEntry(recommendation.plan.id)?.classification === 'DERIVED_SCENARIO'
  return <article className="recommendation-card">
    <header><h3>{recommendation.plan.name}</h3><span>{recommendation.plan.travelerCount === 1 ? <UserRound aria-hidden="true" /> : <UsersRound aria-hidden="true" />}{recommendation.plan.travelerCount} {recommendation.plan.travelerCount === 1 ? 'persona' : 'personas'}</span>{derived && <small>2 entradas individuales · cálculo para 2 personas</small>}</header>
    <div className="recommendation-reasons"><p>Por qué aparece</p><ul>{recommendation.highlights.map(({ criterion }) => <li key={criterion}><Check aria-hidden="true" />{criterionLabels[criterion]}</li>)}</ul></div>
    <div className="recommendation-metrics">
      {travelMetric && <section><p>Viaje estimado · WebTomorrowland</p><strong>≈ {formatMoney(travelMetric)} <small>CLP</small></strong><span>por persona</span></section>}
      {priceMetric && <RecommendationOfficialPrice money={priceMetric} plan={recommendation.plan} derived={derived} />}
    </div>
    <button className="detail-button" type="button" onClick={onOpen}>Ver plan <ArrowRight aria-hidden="true" /></button>
  </article>
}

function RecommendationOfficialPrice({ money, plan, derived }: { money: PlanRecommendation['highlights'][number]['metric']; plan: PlanRecommendation['plan']; derived: boolean }) {
  const { rate } = useExchangeRate(money.currency, 'CLP')
  const clp = convertMoney(money, 'CLP', rate)
  const officialTotal = plan.totalPrice && plan.priceType === 'OFFICIAL' ? plan.totalPrice : null
  return <section><p>Precio Tomorrowland</p>{clp ? <><strong>≈ {formatMoney(clp)} <small>CLP</small></strong><span>por persona</span></> : <strong className="unavailable">Equivalencia en CLP no disponible</strong>}{derived ? <small className="recommendation-brl">{formatMoney(money)} por entrada · precio individual oficial<br />2 entradas individuales × precio oficial</small> : officialTotal && plan.travelerCount > 1 ? <small className="recommendation-brl">{formatMoney(officialTotal)} total · precio oficial<br />{formatMoney(money)} por persona</small> : <small className="recommendation-brl">{formatMoney(money)} · precio oficial</small>}</section>
}
