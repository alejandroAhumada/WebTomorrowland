import { describe, expect, it } from 'vitest'
import { createTravelBudgetEstimates, defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import { localExchangeRates } from '../data/localExchangeRates'
import { productionPlans } from '../../scripts/productionPlans'
import type { TravelPlan } from './plan'
import { createPlanRecommendations, lowestBudgetWithAccommodation, lowestTomorrowlandPrice, lowestTripBudget } from './planRecommendation'
import { createTravelBudget } from './travelBudget'

function budgets(plans: readonly TravelPlan[], accommodationPerNight = defaultBudgetPreferences.accommodationPerNight) {
  const estimates = createTravelBudgetEstimates({ ...defaultBudgetPreferences, accommodationPerNight })
  return new Map(plans.map((plan) => [plan.id, createTravelBudget(plan, estimates, localExchangeRates[0])]))
}

describe('recomendaciones objetivas de planes', () => {
  it.each([1, 2] as const)('calcula el menor presupuesto para %s persona(s)', (travelerCount) => {
    const filtered = productionPlans.filter((plan) => plan.travelerCount === travelerCount)
    const result = lowestTripBudget(filtered, budgets(filtered))
    expect(result?.plan.travelerCount).toBe(travelerCount)
    expect(result?.highlight.metric.amount).toBeGreaterThan(0)
  })

  it('compara el precio Tomorrowland original por persona', () => {
    const result = lowestTomorrowlandPrice(productionPlans.filter((plan) => plan.travelerCount === 2))
    expect(result?.highlight.metric).toEqual({ amount: 3160, currency: 'BRL' })
  })

  it('elige el menor presupuesto conocido entre alojamientos incluidos', () => {
    const result = lowestBudgetWithAccommodation(productionPlans, budgets(productionPlans))
    expect(result?.plan.dreamVilleIncluded || result?.plan.category === 'GLOBAL_JOURNEY').toBe(true)
    expect(result?.plan.totalPrice).not.toBeNull()
  })

  it('excluye PENDING y presupuestos desconocidos', () => {
    const pending = productionPlans.filter((plan) => !plan.totalPrice)
    expect(lowestTomorrowlandPrice(pending)).toBeNull()
    expect(lowestTripBudget(pending, budgets(pending))).toBeNull()
  })

  it('sin tasa BCCh conserva precio Tomorrowland pero no ranking CLP', () => {
    const known = productionPlans.filter((plan) => plan.totalPrice)
    const withoutRate = new Map(known.map((plan) => [plan.id, createTravelBudget(plan, createTravelBudgetEstimates(defaultBudgetPreferences))]))
    expect(lowestTripBudget(known, withoutRate)).toBeNull()
    expect(lowestTomorrowlandPrice(known)).not.toBeNull()
  })

  it('resuelve empates por precio original, nombre e ID de forma determinista', () => {
    const base = productionPlans.find((plan) => plan.id === 'easy-tent-2p-2027')!
    const alpha = { ...structuredClone(base), id: 'z-id', name: 'Álamo' }
    const beta = { ...structuredClone(base), id: 'a-id', name: 'Bosque' }
    expect(lowestTomorrowlandPrice([beta, alpha])?.plan.id).toBe('z-id')
    const sameName = { ...beta, name: alpha.name }
    expect(lowestTomorrowlandPrice([alpha, sameName])?.plan.id).toBe('a-id')
  })

  it('cambiar preferencias puede cambiar el ganador sin mutar planes', () => {
    const separate = structuredClone(productionPlans.find((plan) => plan.id === 'full-madness-2p-2027')!)
    const included = { ...structuredClone(productionPlans.find((plan) => plan.id === 'easy-tent-2p-2027')!), totalPrice: { amount: 7600, currency: 'BRL' as const } }
    const plans = [separate, included]
    const snapshot = structuredClone(plans)
    const normal = lowestTripBudget(plans, budgets(plans, 0))?.plan.id
    const expensiveHotel = lowestTripBudget(plans, budgets(plans, 1000000))?.plan.id
    expect(normal).not.toBe(expensiveHotel)
    expect(plans).toEqual(snapshot)
  })

  it('filtra travelerCount y agrupa un plan ganador de varios criterios', () => {
    const recommendations = createPlanRecommendations(productionPlans, budgets(productionPlans), 1)
    expect(recommendations.every((item) => item.plan.travelerCount === 1)).toBe(true)
    expect(recommendations.some((item) => item.highlights.length > 1)).toBe(true)
  })

  it('maneja cero y un candidato sin inventar recomendaciones', () => {
    expect(createPlanRecommendations([], new Map(), 2)).toEqual([])
    const only = productionPlans.find((plan) => plan.id === 'easy-tent-2p-2027')!
    const result = createPlanRecommendations([only], budgets([only]), 2)
    expect(result).toHaveLength(1)
    expect(result[0].highlights).toHaveLength(3)
  })
})
