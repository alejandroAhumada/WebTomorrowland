import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import type { PlanRecommendation } from '../models/planRecommendation'
import { productionPlans } from '../../scripts/productionPlans'
import { BudgetPreferencesProvider } from '../state/BudgetPreferencesContext'
import { SelectionProvider } from '../state/SelectionContext'
import { HomePage } from '../pages/HomePage'
import { RecommendationCard } from './PlanRecommendationsSection'

const plan = productionPlans.find((item) => item.id === 'easy-tent-2p-2027')!
const recommendation: PlanRecommendation = {
  plan,
  highlights: [
    { criterion: 'LOWEST_TRIP_BUDGET', metric: { amount: 1467000, currency: 'CLP' }, explanation: 'Explicación objetiva.' },
    { criterion: 'LOWEST_TOMORROWLAND_PRICE', metric: { amount: 3804.5, currency: 'BRL' }, explanation: 'Solo producto Tomorrowland.' },
  ],
}

describe('sección de recomendaciones', () => {
  it('muestra criterio, métricas, estado y acción de detalle', () => {
    const markup = renderToStaticMarkup(<RecommendationCard recommendation={recommendation} onOpen={() => undefined} />)
    expect(markup).toContain('Menor presupuesto completo')
    expect(markup).toContain('$1.467.000')
    expect(markup).toContain('BRL 3.805')
    expect(markup).toContain('Precio oficial')
    expect(markup).toContain('Ver detalles')
  })

  it('Home incluye selector accesible, loading e indicador personalizado', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><BudgetPreferencesProvider initialPreferences={{ ...defaultBudgetPreferences, flightPerPerson: 520000 }}><SelectionProvider><HomePage /></SelectionProvider></BudgetPreferencesProvider></MemoryRouter>)
    expect(markup).toContain('¿Qué opción te conviene mirar primero?')
    expect(markup).toContain('aria-label="Cantidad de viajeros"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Basado en tu presupuesto personalizado')
    expect(markup).toContain('Calculando alternativas')
  })
})
