import { ArrowRight, Columns3, Hotel, Ticket, UserRound, UsersRound, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlanRecommendations } from '../hooks/usePlanRecommendations'
import { useExchangeRate } from '../hooks/useExchangeRate'
import { convertMoney } from '../models/exchangeRate'
import type { PlanRecommendation, PlanRecommendationCriterion, RecommendationHighlight } from '../models/planRecommendation'
import { useSelection } from '../state/useSelection'
import { formatMoney } from '../utils/format'
import { PlanDetailDialog } from './PlanDetailDialog'
import { PriceBadge } from './PriceBadge'
import { useMyTrip } from '../state/useMyTrip'

const criterionContent: Record<PlanRecommendationCriterion, { label: string; icon: LucideIcon }> = {
  LOWEST_TRIP_BUDGET: { label: 'Menor viaje estimado', icon: WalletCards },
  LOWEST_TOMORROWLAND_PRICE: { label: 'Menor precio Tomorrowland', icon: Ticket },
  LOWEST_BUDGET_WITH_ACCOMMODATION: { label: 'Alojamiento incluido', icon: Hotel },
}

export function PlanRecommendationsSection({ secondary = false }: { secondary?: boolean }) {
  const [travelerCount, setTravelerCount] = useState<1 | 2>(2)
  const [detailed, setDetailed] = useState<PlanRecommendation['plan'] | null>(null)
  const { recommendations, loading, error, customized } = usePlanRecommendations(travelerCount)
  const { replace } = useSelection()
  const navigate = useNavigate()
  const { isMyPlan } = useMyTrip()
  const compareIds = recommendations.map((item) => item.plan.id)

  return <section className={`recommendations-section ${secondary ? 'secondary' : ''}`} aria-labelledby="recommendations-title">
    <div className="recommendations-heading"><div><p className="eyebrow">{secondary ? 'Si quieres comparar' : 'Criterios para decidir'}</p><h2 id="recommendations-title">{secondary ? 'Otras alternativas' : '¿Qué opción te conviene mirar primero?'}</h2><p>{secondary ? 'Opciones calculadas con los mismos criterios y tu presupuesto actual.' : 'Comparamos datos objetivos. La decisión final siempre es tuya.'}</p></div><div className="traveler-switch" role="group" aria-label="Cantidad de viajeros"><button type="button" aria-pressed={travelerCount === 1} onClick={() => setTravelerCount(1)}><UserRound aria-hidden="true" />1 persona</button><button type="button" aria-pressed={travelerCount === 2} onClick={() => setTravelerCount(2)}><UsersRound aria-hidden="true" />2 personas</button></div></div>
    <p className="recommendation-basis">{customized ? 'Basado en tu presupuesto personalizado' : 'Basado en estimaciones referenciales'}</p>
    {loading && <p className="recommendations-notice">Calculando alternativas con precio conocido…</p>}
    {!loading && error && <p className="recommendations-notice error" role="alert">No pudimos calcular recomendaciones en este momento.</p>}
    {!loading && !error && recommendations.length === 0 && <p className="recommendations-notice">Todavía no existen alternativas con información suficiente para estos criterios.</p>}
    {!loading && !error && recommendations.length > 0 && <div className="recommendation-grid">{recommendations.map((recommendation) => <RecommendationCard key={recommendation.plan.id} recommendation={recommendation} onOpen={() => setDetailed(recommendation.plan)} isMyPlan={isMyPlan(recommendation.plan.id)} />)}</div>}
    {!loading && !error && compareIds.length >= 2 && <button className="button secondary recommendations-compare" type="button" onClick={() => { replace(compareIds); navigate('/comparar') }}><Columns3 aria-hidden="true" />Comparar recomendadas</button>}
    {detailed && <PlanDetailDialog plan={detailed} onClose={() => setDetailed(null)} />}
  </section>
}

export function RecommendationCard({ recommendation, onOpen, isMyPlan = false }: { recommendation: PlanRecommendation; onOpen: () => void; isMyPlan?: boolean }) {
  return <article className="recommendation-card"><header><span>{recommendation.plan.travelerCount === 1 ? <UserRound aria-hidden="true" /> : <UsersRound aria-hidden="true" />}{recommendation.plan.travelerCount} {recommendation.plan.travelerCount === 1 ? 'persona' : 'personas'}{isMyPlan && <em>Mi plan</em>}</span><h3>{recommendation.plan.name}</h3></header><div className="recommendation-highlights">{recommendation.highlights.map((highlight) => <RecommendationMetric key={highlight.criterion} highlight={highlight} priceType={recommendation.plan.priceType} />)}</div><button className="detail-button" type="button" onClick={onOpen}>Ver plan <ArrowRight aria-hidden="true" /></button></article>
}

function RecommendationMetric({ highlight, priceType }: { highlight: RecommendationHighlight; priceType: PlanRecommendation['plan']['priceType'] }) {
  const { label, icon: Icon } = criterionContent[highlight.criterion]
  const isTomorrowlandPrice = highlight.criterion === 'LOWEST_TOMORROWLAND_PRICE'
  return <section><p><Icon aria-hidden="true" />{label}</p>{isTomorrowlandPrice ? <RecommendationOfficialPrice money={highlight.metric} /> : <strong>≈ {formatMoney(highlight.metric)} <small>por persona</small></strong>}<span>{highlight.explanation}</span><PriceBadge type={isTomorrowlandPrice ? priceType : 'ESTIMATED'} /></section>
}

function RecommendationOfficialPrice({ money }: { money: RecommendationHighlight['metric'] }) {
  const { rate } = useExchangeRate(money.currency, 'CLP')
  const clp = convertMoney(money, 'CLP', rate)
  return <><strong>{clp ? `≈ ${formatMoney(clp)} CLP` : 'Equivalencia CLP no disponible'} <small>por persona</small></strong><span className="recommendation-brl">{formatMoney(money)} · precio oficial Tomorrowland</span></>
}
