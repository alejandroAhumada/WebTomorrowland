import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import type { PlanRecommendation } from '../models/planRecommendation'
import { productionPlans } from '../../scripts/productionPlans'
import { BudgetPreferencesProvider } from '../state/BudgetPreferencesContext'
import { SelectionProvider } from '../state/SelectionContext'
import { HomePage } from '../pages/HomePage'
import { MyTripProvider } from '../state/MyTripContext'
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
  it('agrupa razones y muestra cada métrica semántica una sola vez sin badges', () => {
    const markup = renderToStaticMarkup(<RecommendationCard recommendation={recommendation} onOpen={() => undefined} />)
    expect(markup).toContain('Viaje estimado más bajo')
    expect(markup).toContain('Precio Tomorrowland más bajo')
    expect(markup).toContain('Viaje estimado · WebTomorrowland')
    expect(markup).toContain('$1.467.000')
    expect(markup).toContain('R$ 3.805')
    expect(markup).not.toContain('price-badge')
    expect(markup).not.toContain('Explicación objetiva')
    expect(markup).toContain('Ver plan')
  })

  it('deduplica la cifra de viaje cuando un plan gana ambos criterios de presupuesto', () => {
    const markup = renderToStaticMarkup(<RecommendationCard recommendation={{ plan, highlights: [
      { criterion: 'LOWEST_TRIP_BUDGET', metric: { amount: 1467000, currency: 'CLP' }, explanation: '' },
      { criterion: 'LOWEST_BUDGET_WITH_ACCOMMODATION', metric: { amount: 1467000, currency: 'CLP' }, explanation: '' },
    ] }} onOpen={() => undefined} />)
    expect(markup).toContain('Viaje estimado más bajo')
    expect(markup).toContain('Menor costo de viaje con alojamiento incluido')
    expect(markup.match(/\$1\.467\.000/g)).toHaveLength(1)
  })

  it('presenta Full Madness 2P como dos precios individuales y nunca como pack oficial', () => {
    const derived = productionPlans.find((item) => item.id === 'full-madness-2p-2027')!
    const markup = renderToStaticMarkup(<RecommendationCard recommendation={{ plan: derived, highlights: [
      { criterion: 'LOWEST_TOMORROWLAND_PRICE', metric: { amount: 3160, currency: 'BRL' }, explanation: '' },
    ] }} onOpen={() => undefined} />)
    expect(markup).toContain('2 entradas individuales · cálculo para 2 personas')
    expect(markup).toContain('R$ 3.160 por entrada · precio individual oficial')
    expect(markup).not.toContain('R$ 6.320')
    expect(markup).not.toContain('R$ 6.320 · precio oficial')
  })

  it('Home incluye selector accesible, loading e indicador personalizado', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><BudgetPreferencesProvider initialPreferences={{ ...defaultBudgetPreferences, flightPerPerson: 520000 }}><MyTripProvider initialPlanId={null}><SelectionProvider><HomePage /></SelectionProvider></MyTripProvider></BudgetPreferencesProvider></MemoryRouter>)
    expect(markup).toContain('Alternativas para empezar a comparar')
    expect(markup).toContain('aria-label="Cantidad de viajeros"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Con tu presupuesto personalizado')
    expect(markup).toContain('Calculando alternativas')
  })
})
