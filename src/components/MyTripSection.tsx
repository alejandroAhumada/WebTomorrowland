import { ArrowUpRight, Bookmark, Circle, CircleCheck, CircleDot, Columns3, Eye, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useImportantEvents } from '../hooks/useImportantEvents'
import { usePlans } from '../hooks/usePlans'
import { useTravelBudget } from '../hooks/useTravelBudget'
import type { ImportantEvent } from '../models/importantEvent'
import type { TravelPlan } from '../models/plan'
import { resolveSelectedPlan } from '../models/myTrip'
import { useBudgetPreferences } from '../state/useBudgetPreferences'
import { useMyTrip } from '../state/useMyTrip'
import { useSelection } from '../state/useSelection'
import { formatImportantEventDate, getDaysUntilEvent } from '../utils/importantEventTime'
import { buildTripTimeline, type TripTimelineEntry } from '../utils/tripTimeline'
import { formatMoney } from '../utils/format'
import { AvailabilityBadge } from './AvailabilityBadge'
import { ClpConversion } from './ClpConversion'
import { PlanDetailDialog } from './PlanDetailDialog'
import { PriceBadge } from './PriceBadge'
import { PersonalTripPreparation } from './PersonalTripPreparation'
import { calculateExecutedTravelBudget } from '../models/executedTravelBudget'
import { useTripPreparation } from '../state/useTripPreparation'
import { ExecutedBudgetSummary } from './ExecutedBudgetView'

export function MyTripSection() {
  const { selectedPlanId } = useMyTrip()
  if (!selectedPlanId) return <section className="my-trip-invitation" aria-label="Mi viaje"><Bookmark aria-hidden="true" /><p><strong>Comienza a organizar tu viaje</strong>Abre el detalle de una alternativa y elige “Elegir como mi plan”.</p></section>
  return <SelectedMyTrip selectedPlanId={selectedPlanId} />
}

function SelectedMyTrip({ selectedPlanId }: { selectedPlanId: string }) {
  const { plans, loading, error } = usePlans(undefined, [selectedPlanId])
  const { clearPlan } = useMyTrip()
  const eventsState = useImportantEvents()
  const plan = resolveSelectedPlan(selectedPlanId, plans)

  useEffect(() => {
    if (!loading && !error && !plan) clearPlan()
  }, [loading, error, plan, clearPlan])

  if (loading) return <section className="my-trip-section my-trip-loading" aria-label="Cargando Mi viaje"><span /></section>
  if (error) return <section className="my-trip-invitation error" role="alert"><Bookmark aria-hidden="true" /><p><strong>Mi viaje no está disponible ahora</strong>No pudimos obtener los datos actuales de tu plan.</p></section>
  if (!plan) return null
  return <MyTripDashboard plan={plan} events={eventsState.events} eventsLoading={eventsState.loading} />
}

export function MyTripDashboard({ plan, events, eventsLoading = false, now = new Date() }: { plan: TravelPlan; events: ImportantEvent[]; eventsLoading?: boolean; now?: Date }) {
  const [dialogMode, setDialogMode] = useState<'DETAIL' | 'BUDGET' | null>(null)
  const { budget, loading: budgetLoading } = useTravelBudget(plan)
  const { customized } = useBudgetPreferences()
  const { state: preparation } = useTripPreparation()
  const { isSelected, isFull, toggle } = useSelection()
  const navigate = useNavigate()
  const TravelersIcon = plan.travelerCount === 1 ? UserRound : UsersRound
  const timeline = buildTripTimeline(plan, events, now)
  const comparisonFull = isFull && !isSelected(plan.id)
  const executed = calculateExecutedTravelBudget(budget, preparation.plans[plan.id] ?? {})

  const compare = () => {
    if (!isSelected(plan.id)) toggle(plan.id)
    navigate('/comparar')
  }

  const missingBudgetLabel = budget.pendingReason === 'PLAN_PRICE' ? 'Pendiente de precio oficial' : budget.pendingReason === 'CONVERSION' ? 'Presupuesto CLP no disponible' : 'Presupuesto pendiente'
  return <section className="my-trip-section" aria-labelledby="my-trip-title"><div className="my-trip-label"><Bookmark aria-hidden="true" /><span>Mi viaje</span><small>Alternativa seleccionada para planificación</small></div><div className="my-trip-grid"><article className="my-trip-plan"><p>Plan elegido</p><h2 id="my-trip-title">{plan.name}</h2><span><TravelersIcon aria-hidden="true" />{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}</span><small>Tomorrowland Brasil 2027 · 30 abril–2 mayo</small><div><PriceBadge type={plan.priceType} /><AvailabilityBadge status={plan.status} /></div></article><article className="my-trip-budget"><p>Precio Tomorrowland</p>{plan.totalPrice ? <><strong>{formatMoney(plan.totalPrice)}</strong><ClpConversion money={plan.totalPrice} compact /></> : <strong className="pending">Pendiente</strong>}<hr /><p>Presupuesto completo estimado</p>{budgetLoading ? <strong className="pending">Calculando…</strong> : budget.total && budget.totalPerPerson ? <><strong>≈ {formatMoney(budget.total)}</strong><span>≈ {formatMoney(budget.totalPerPerson)} por persona</span></> : <><strong className="pending">{missingBudgetLabel}</strong>{budget.pendingReason === 'CONVERSION' && <span>Conversión CLP no disponible</span>}</>}<small>{customized ? 'Presupuesto personalizado' : 'Estimaciones referenciales'}</small><ExecutedBudgetSummary executed={executed} /></article></div><MyTripTimeline entries={timeline.entries} loading={eventsLoading} now={now} /><PersonalTripPreparation plan={plan} budget={budget} /><div className="my-trip-actions"><button className="button" type="button" onClick={() => setDialogMode('DETAIL')}><Eye aria-hidden="true" />Ver mi plan</button><button className="button secondary" type="button" onClick={() => setDialogMode('BUDGET')}><SlidersHorizontal aria-hidden="true" />Ajustar presupuesto</button><button className="button secondary" type="button" onClick={compare} disabled={comparisonFull} title={comparisonFull ? 'La comparación ya tiene tres alternativas.' : undefined}><Columns3 aria-hidden="true" />{comparisonFull ? 'Comparación llena' : 'Comparar'}</button></div><p className="my-trip-disclaimer">Esta selección sirve para organizar tu viaje y no representa una reserva, compra ni entrada confirmada.</p>{dialogMode && <PlanDetailDialog plan={plan} openBudgetEditor={dialogMode === 'BUDGET'} onClose={() => setDialogMode(null)} />}</section>
}

function MyTripTimeline({ entries, loading, now }: { entries: TripTimelineEntry[]; loading: boolean; now: Date }) {
  if (loading) return <section className="my-trip-timeline" aria-labelledby="trip-timeline-title"><h3 id="trip-timeline-title">Mi ruta a Tomorrowland</h3><p>Consultando hitos oficiales relevantes…</p></section>
  if (entries.length === 0) return <section className="my-trip-timeline" aria-labelledby="trip-timeline-title"><h3 id="trip-timeline-title">Mi ruta a Tomorrowland</h3><p>No hay nuevos hitos oficiales asociados a esta alternativa.</p></section>
  return <section className="my-trip-timeline" aria-labelledby="trip-timeline-title"><header><div><p>Ruta oficial personalizada</p><h3 id="trip-timeline-title">Mi ruta a Tomorrowland</h3></div><small>Solo hitos oficiales relevantes para este plan</small></header><ol>{entries.map((entry) => <TripTimelineItem key={entry.event.id} entry={entry} now={now} />)}</ol></section>
}

function TripTimelineItem({ entry, now }: { entry: TripTimelineEntry; now: Date }) {
  const Icon = entry.state === 'PAST' ? CircleCheck : entry.state === 'TODAY' ? CircleDot : Circle
  const stateLabel = entry.state === 'PAST' ? 'Finalizado' : entry.state === 'TODAY' ? 'En curso' : 'Próximo'
  const days = entry.state === 'UPCOMING' ? getDaysUntilEvent(entry.event, now) : null
  return <li className={`${entry.state.toLowerCase()} ${entry.isPrimary ? 'primary' : ''}`}><span className="trip-route-marker"><Icon aria-hidden="true" /></span><div><div className="trip-route-meta"><span>{entry.isPrimary ? (entry.state === 'TODAY' ? 'Hito principal en curso' : 'Próximo hito') : stateLabel}</span>{days !== null && <small>Faltan {days} {days === 1 ? 'día' : 'días'}</small>}</div><h4>{entry.event.title}</h4><time dateTime={entry.event.startsAt}>{formatImportantEventDate(entry.event)}</time><a href={entry.event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Fuente oficial de ${entry.event.title}, abre en una nueva pestaña`}>Fuente oficial <ArrowUpRight aria-hidden="true" /></a></div></li>
}
