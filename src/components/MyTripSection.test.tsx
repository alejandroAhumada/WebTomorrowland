import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import { demoPlans } from '../data/demoPlans'
import { initialImportantEvents } from '../data/importantEvents'
import { BudgetPreferencesProvider } from '../state/BudgetPreferencesContext'
import { MyTripProvider } from '../state/MyTripContext'
import { SelectionProvider } from '../state/SelectionContext'
import { TripPreparationProvider } from '../state/TripPreparationContext'
import { MyTripDashboard, MyTripSection } from './MyTripSection'
import { PlanCard } from './PlanCard'
import { PlanDetailDialog } from './PlanDetailDialog'
import { RecommendationCard } from './PlanRecommendationsSection'
import type { PlanRecommendation } from '../models/planRecommendation'
import { productionPlans } from '../../scripts/productionPlans'
import type { PersonalTripTaskProgress } from '../models/tripPreparation'

const plan = demoPlans[0]

function renderUi(node: ReactNode, options: { selectedId?: string | null; personalized?: boolean; completedTaskIds?: string[]; planId?: string; progress?: Record<string, PersonalTripTaskProgress> } = {}) {
  const preferences = options.personalized ? { ...defaultBudgetPreferences, flightPerPerson: 520000 } : defaultBudgetPreferences
  const progress = { ...Object.fromEntries((options.completedTaskIds ?? []).map((taskId) => [taskId, { completed: true as const, completedAt: '2026-08-22T18:00:00.000Z' }])), ...options.progress }
  const initialState = { plans: { [options.planId ?? plan.id]: progress } }
  return renderToStaticMarkup(<MemoryRouter><BudgetPreferencesProvider initialPreferences={preferences}><TripPreparationProvider initialState={initialState}><MyTripProvider initialPlanId={options.selectedId !== undefined ? options.selectedId : plan.id}><SelectionProvider>{node}</SelectionProvider></MyTripProvider></TripPreparationProvider></BudgetPreferencesProvider></MemoryRouter>)
}

describe('Mi viaje en la interfaz', () => {
  it('muestra plan, presupuesto, próximo hito, acciones y aclaración', () => {
    const markup = renderUi(<MyTripDashboard plan={plan} events={initialImportantEvents} />)
    expect(markup).toContain('Mi viaje')
    expect(markup).toContain(plan.name)
    expect(markup).toContain('Mi ruta a Tomorrowland')
    expect(markup).toContain('Mi preparación')
    expect(markup).toContain('0 de 7 completados')
    expect(markup).toContain('Hito principal en curso')
    expect(markup).toContain('Ver mi plan')
    expect(markup).toContain('Ajustar presupuesto')
    expect(markup).toContain('Comparar')
    expect(markup).toContain('No representa una compra, reserva, disponibilidad garantizada ni entrada confirmada')
  })

  it('muestra progreso personal, checkbox accesible y estado completado', () => {
    const markup = renderUi(<MyTripDashboard plan={plan} events={[]} />, { completedTaskIds: ['flight', 'documentation'] })
    expect(markup).toContain('2 de 7 completados')
    expect(markup).toContain('aria-valuenow="2"')
    expect(markup).toContain('checked=""')
    expect(markup).toContain('Restablecer preparación')
    expect(markup).toContain('Tu organización personal')
  })

  it('muestra preparación completada al 100% y no aparece sin MyTrip', () => {
    const allTasks = ['documentation', 'flight', 'travel-insurance', 'local-transport', 'payment-method', 'luggage', 'flight-check-in']
    const completed = renderUi(<MyTripDashboard plan={plan} events={[]} />, { completedTaskIds: allTasks })
    expect(completed).toContain('Preparación completada')
    expect(completed).toContain('aria-valuenow="7"')
    expect(renderUi(<MyTripSection />, { selectedId: null })).not.toContain('Mi preparación')
  })

  it('agrega alojamiento a Full Madness y lo excluye de Easy Tent y Global Journey PENDING', () => {
    const fullMadness = productionPlans.find((item) => item.id === 'full-madness-1p-2027')!
    const easyTent = productionPlans.find((item) => item.id === 'easy-tent-2p-2027')!
    const pendingJourney = productionPlans.find((item) => item.id === 'global-journey-hotel-1p-2027')!
    expect(renderUi(<MyTripDashboard plan={fullMadness} events={[]} />)).toContain('Reservar alojamiento externo')
    expect(renderUi(<MyTripDashboard plan={easyTent} events={[]} />)).not.toContain('Reservar alojamiento externo')
    const pendingMarkup = renderUi(<MyTripDashboard plan={pendingJourney} events={[]} />)
    expect(pendingMarkup).not.toContain('Reservar alojamiento externo')
    expect(pendingMarkup).toContain('Comprar vuelos')
  })

  it('recalcula con BudgetPreferences y muestra el indicador personalizado', () => {
    const defaults = renderUi(<MyTripDashboard plan={plan} events={[]} />)
    const personalized = renderUi(<MyTripDashboard plan={plan} events={[]} />, { personalized: true })
    expect(defaults).toContain('Estimaciones referenciales')
    expect(defaults).toContain('$3.300.000')
    expect(personalized).toContain('Presupuesto personalizado')
    expect(personalized).toContain('$3.420.000')
  })

  it('maneja PENDING y ausencia de acontecimientos', () => {
    const pending = { ...plan, totalPrice: null, priceType: null }
    const markup = renderUi(<MyTripDashboard plan={pending} events={[]} />)
    expect(markup).toContain('Precio Tomorrowland')
    expect(markup).toContain('Pendiente de precio oficial')
    expect(markup).toContain('No hay nuevos hitos oficiales asociados')
  })

  it('muestra hitos Global Journey solo para esa categoría', () => {
    const globalJourney = productionPlans.find((item) => item.id === 'global-journey-hotel-2p-2027')!
    const easyTent = productionPlans.find((item) => item.id === 'easy-tent-2p-2027')!
    const fullMadness = productionPlans.find((item) => item.id === 'full-madness-1p-2027')!
    const now = new Date('2026-09-01T12:00:00Z')
    const journeyMarkup = renderUi(<MyTripDashboard plan={globalJourney} events={initialImportantEvents} now={now} />)
    const easyTentMarkup = renderUi(<MyTripDashboard plan={easyTent} events={initialImportantEvents} now={now} />)
    const fullMadnessMarkup = renderUi(<MyTripDashboard plan={fullMadness} events={initialImportantEvents} now={now} />)
    expect(journeyMarkup).toContain('Simulador Global Journey')
    expect(easyTentMarkup).not.toContain('Simulador Global Journey')
    expect(fullMadnessMarkup).not.toContain('Venta Global Journey')
    expect([journeyMarkup, easyTentMarkup, fullMadnessMarkup].every((markup) => markup.includes('Tomorrowland Brasil 2027'))).toBe(true)
  })

  it('marca Mi plan en card y recomendación', () => {
    const card = renderUi(<PlanCard plan={plan} selected={false} disabled={false} onToggle={() => undefined} onOpenDetails={() => undefined} />)
    const recommendation: PlanRecommendation = { plan, highlights: [{ criterion: 'LOWEST_TRIP_BUDGET', metric: { amount: 1000000, currency: 'CLP' }, explanation: 'Criterio objetivo.' }] }
    const recommended = renderToStaticMarkup(<RecommendationCard recommendation={recommendation} isMyPlan onOpen={() => undefined} />)
    expect(card).toContain('Mi plan')
    expect(recommended).toContain('Mi plan')
  })

  it('detalle permite elegir, cambiar, quitar y abrir presupuesto', () => {
    const selected = renderUi(<PlanDetailDialog plan={plan} openBudgetEditor onClose={() => undefined} />)
    const other = renderUi(<PlanDetailDialog plan={demoPlans[1]} onClose={() => undefined} />)
    expect(selected).toContain('Este es mi plan')
    expect(selected).toContain('Dejar de usar como mi plan')
    expect(selected).toContain('<details class="budget-editor" open=""')
    expect(other).toContain('Elegir como mi plan')
  })

  it('muestra gasto real, proyección y formulario sin confundirlos con la estimación', () => {
    const progress = { flight: { actualExpense: { amount: 365000, currency: 'CLP' as const, scope: 'PER_PERSON' as const }, purchasedAt: '2026-08-20' } }
    const markup = renderUi(<MyTripDashboard plan={plan} events={[]} />, { progress })
    expect(markup).toContain('Pagado: $365.000 por persona')
    expect(markup).toContain('35.000 bajo la estimación')
    expect(markup).toContain('Proyección actual')
    expect(markup).toContain('Editar gasto')
    expect(markup).toContain('Eliminar gasto')
    expect(markup).toContain('0 de 7 completados')
  })

  it('muestra seguro sin estimación y gastos conocidos en plan PENDING', () => {
    const pending = productionPlans.find((item) => item.id === 'global-journey-hotel-1p-2027')!
    const progress = { 'travel-insurance': { actualExpense: { amount: 35000, currency: 'CLP' as const, scope: 'PER_PERSON' as const } } }
    const markup = renderUi(<MyTripDashboard plan={pending} events={[]} />, { planId: pending.id, progress })
    expect(markup).toContain('Pagado: $35.000 por persona')
    expect(markup).toContain('no incluida en el presupuesto referencial')
    expect(markup).toContain('Presupuesto total pendiente del precio oficial')
  })

  it('detalle del plan elegido muestra ejecución separada', () => {
    const progress = { flight: { actualExpense: { amount: 365000, currency: 'CLP' as const, scope: 'PER_PERSON' as const } } }
    const markup = renderUi(<PlanDetailDialog plan={plan} onClose={() => undefined} />, { progress })
    expect(markup).toContain('Ejecución del presupuesto')
    expect(markup).toContain('Estimación original')
    expect(markup).toContain('Pagado registrado')
  })
})
