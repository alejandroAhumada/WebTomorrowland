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
import { PlanDetailDialog } from './PlanDetailDialog'
import { PriceBadge } from './PriceBadge'
import { PersonalTripPreparation } from './PersonalTripPreparation'
import { calculateExecutedTravelBudget } from '../models/executedTravelBudget'
import { useTripPreparation } from '../state/useTripPreparation'
import { ExecutedBudgetBreakdown } from './ExecutedBudgetView'
import { useTicketTiers } from '../hooks/useTicketTiers'
import { planForTierBudget, resolvePlanTierOption } from '../models/planCatalog'
import { budgetItemTotalMoney } from '../models/travelBudget'
import { buildPersonalTripTasks } from '../models/personalTripTask'
import { TravelBudgetBreakdown } from './TravelBudgetView'

export function MyTripSection() {
  const { selectedPlanId } = useMyTrip()
  if (!selectedPlanId) return null
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
  const { consideredTierByPlan } = useMyTrip()
  const { tiers } = useTicketTiers()
  const tierOption = resolvePlanTierOption(plan, tiers, consideredTierByPlan[plan.id] ?? null)
  const planningPlan = planForTierBudget(plan, tierOption)
  const { budget, loading: budgetLoading } = useTravelBudget(planningPlan)
  const { customized } = useBudgetPreferences()
  const { state: preparation } = useTripPreparation()
  const { isSelected, isFull, toggle } = useSelection()
  const navigate = useNavigate()
  const TravelersIcon = plan.travelerCount === 1 ? UserRound : UsersRound
  const timeline = buildTripTimeline(plan, events, now)
  const comparisonFull = isFull && !isSelected(plan.id)
  const executed = calculateExecutedTravelBudget(budget, preparation.plans[plan.id] ?? {})
  const tasks = buildPersonalTripTasks(plan)
  const completedTasks = tasks.filter((task) => preparation.plans[plan.id]?.[task.id]?.completed).length
  const tomorrowlandItem = budget.items.find((item) => item.category === 'TOMORROWLAND')
  const tomorrowlandClp = tomorrowlandItem ? budgetItemTotalMoney(tomorrowlandItem) : null
  const primaryEntry = timeline.entries.find((entry) => entry.isPrimary)

  const compare = () => {
    if (!isSelected(plan.id)) toggle(plan.id)
    navigate('/comparar')
  }

  const missingBudgetLabel = budget.pendingReason === 'PLAN_PRICE' ? 'Pendiente de precio oficial' : budget.pendingReason === 'CONVERSION' ? 'Presupuesto CLP no disponible' : 'Presupuesto pendiente'
  const travelValue = executed.projectedTotalPerPerson ?? budget.totalPerPerson
  return <section className="my-trip-section compact-dashboard" aria-labelledby="my-trip-title">
    <div className="my-trip-label"><Bookmark aria-hidden="true" /><span>Mi viaje</span><small>Tu alternativa para planificar</small></div>
    <div className="my-trip-overview">
      <article className="my-trip-plan"><p>Plan elegido</p><h2 id="my-trip-title">{plan.name}</h2><span><TravelersIcon aria-hidden="true" />{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}</span>{tierOption && <small className="considered-tier">Modalidad para planificar: <strong>{tierOption.tier.name}</strong></small>}<div><PriceBadge type={planningPlan.priceType} /><AvailabilityBadge status={plan.status} /></div></article>
      <article className="my-trip-milestone"><p>Próximo hito</p>{eventsLoading ? <strong>Consultando fechas…</strong> : primaryEntry ? <><strong>{primaryEntry.event.title}</strong><time dateTime={primaryEntry.event.startsAt}>{formatImportantEventDate(primaryEntry.event)}</time>{primaryEntry.state === 'UPCOMING' && <small>Faltan {getDaysUntilEvent(primaryEntry.event, now)} días</small>}</> : <strong>No hay nuevos hitos oficiales</strong>}</article>
      <article className="my-trip-money"><p>{tierOption?.priceNature === 'DERIVED' ? 'Equivalencia del cálculo' : 'Equivalencia del producto'}</p>{tomorrowlandClp ? <strong className="my-trip-clp">≈ {formatMoney(tomorrowlandClp)} CLP</strong> : <strong className="pending">Equivalencia CLP no disponible</strong>}{planningPlan.totalPrice ? <span>{formatMoney(planningPlan.totalPrice)} · {tierOption?.priceNature === 'DERIVED' ? 'cálculo para 2 personas' : 'precio oficial Tomorrowland'}</span> : <span>Precio aún no publicado</span>}<hr /><p>{executed.projectedTotalPerPerson ? 'Viaje proyectado' : 'Viaje estimado'}</p>{budgetLoading ? <strong>Calculando…</strong> : travelValue ? <strong>≈ {formatMoney(travelValue)} <small>por persona</small></strong> : <strong className="pending">{missingBudgetLabel}</strong>}<small>{customized ? 'Presupuesto personalizado' : 'Estimaciones referenciales'} · Preparación {completedTasks}/{tasks.length}</small>{executed.actualPaid && <span>Pagado registrado: {formatMoney(executed.actualPaid)}</span>}{executed.actualPaid && !executed.projectedTotal && <span>Presupuesto total pendiente del precio oficial o de la conversión CLP.</span>}</article>
    </div>
    <div className="my-trip-actions"><button className="button" type="button" onClick={() => setDialogMode('DETAIL')}><Eye aria-hidden="true" />Ver mi plan</button><button className="button secondary" type="button" onClick={() => setDialogMode('BUDGET')}><SlidersHorizontal aria-hidden="true" />Ajustar presupuesto</button><button className="my-trip-compare-link" type="button" onClick={compare} disabled={comparisonFull} title={comparisonFull ? 'Ya elegiste tres alternativas.' : undefined}><Columns3 aria-hidden="true" />{comparisonFull ? 'Ya elegiste 3 alternativas' : 'Comparar otra alternativa'}</button></div>
    <div className="my-trip-disclosures">
      <details className="my-trip-disclosure"><summary>Ver mi ruta</summary><MyTripTimeline entries={timeline.entries} loading={eventsLoading} now={now} /></details>
      <PersonalTripPreparation plan={plan} budget={budget} />
      <details className="my-trip-disclosure"><summary>Ver presupuesto</summary><TravelBudgetBreakdown budget={budget} loading={budgetLoading} /><ExecutedBudgetBreakdown executed={executed} /></details>
    </div>
    <p className="my-trip-disclaimer">No representa una compra, reserva, disponibilidad garantizada ni entrada confirmada. Esta selección sirve solo para planificar; las compras se realizan exclusivamente en los canales oficiales de Tomorrowland.</p>{dialogMode && <PlanDetailDialog plan={plan} openBudgetEditor={dialogMode === 'BUDGET'} onClose={() => setDialogMode(null)} />}
  </section>
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
