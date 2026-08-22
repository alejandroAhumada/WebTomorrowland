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
import { MyTripDashboard } from './MyTripSection'
import { PlanCard } from './PlanCard'
import { PlanDetailDialog } from './PlanDetailDialog'
import { RecommendationCard } from './PlanRecommendationsSection'
import type { PlanRecommendation } from '../models/planRecommendation'

const plan = demoPlans[0]

function renderUi(node: ReactNode, options: { selectedId?: string | null; personalized?: boolean } = {}) {
  const preferences = options.personalized ? { ...defaultBudgetPreferences, flightPerPerson: 520000 } : defaultBudgetPreferences
  return renderToStaticMarkup(<MemoryRouter><BudgetPreferencesProvider initialPreferences={preferences}><MyTripProvider initialPlanId={options.selectedId ?? plan.id}><SelectionProvider>{node}</SelectionProvider></MyTripProvider></BudgetPreferencesProvider></MemoryRouter>)
}

describe('Mi viaje en la interfaz', () => {
  it('muestra plan, presupuesto, próximo hito, acciones y aclaración', () => {
    const markup = renderUi(<MyTripDashboard plan={plan} events={initialImportantEvents} />)
    expect(markup).toContain('Mi viaje')
    expect(markup).toContain(plan.name)
    expect(markup).toContain('Próximo hito')
    expect(markup).toContain('Ver mi plan')
    expect(markup).toContain('Ajustar presupuesto')
    expect(markup).toContain('Comparar')
    expect(markup).toContain('no representa una reserva, compra ni entrada confirmada')
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
    expect(markup).toContain('No hay nuevos hitos oficiales publicados')
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
})
