import { describe, expect, it } from 'vitest'
import { initialTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import { localExchangeRates } from '../data/localExchangeRates'
import { demoPlans } from '../data/demoPlans'
import type { TravelPlan } from './plan'
import { budgetCategoryOrder, budgetItemTotal, createTravelBudget } from './travelBudget'

function plan(travelerCount: 1 | 2, totalPrice: TravelPlan['totalPrice'] = { amount: 1000, currency: 'BRL' }): TravelPlan {
  return { ...structuredClone(demoPlans.find((item) => item.travelerCount === travelerCount)!), id: `budget-${travelerCount}`, travelerCount, totalPrice, priceType: totalPrice ? 'OFFICIAL' : null }
}

describe('presupuesto completo del viaje', () => {
  it('calcula un plan de una persona', () => {
    const budget = createTravelBudget(plan(1), initialTravelBudgetEstimates, localExchangeRates[0])
    expect(budget.total?.amount).toBe(1028010)
    expect(budget.totalPerPerson?.amount).toBe(1028010)
  })

  it('multiplica gastos por persona en un plan de dos personas', () => {
    const budget = createTravelBudget(plan(2), initialTravelBudgetEstimates, localExchangeRates[0])
    expect(budget.items.find((item) => item.category === 'FLIGHT')).toSatisfy((item) => item && budgetItemTotal(item) === 800000)
    expect(budget.total?.amount).toBe(1758010)
    expect(budget.totalPerPerson?.amount).toBe(879005)
  })

  it('no multiplica el transporte definido por grupo', () => {
    const item = createTravelBudget(plan(2), initialTravelBudgetEstimates, localExchangeRates[0]).items.find((candidate) => candidate.category === 'LOCAL_TRANSPORT')!
    expect(budgetItemTotal(item)).toBe(120000)
  })

  it('preserva el precio BRL original y usa la tasa BCCh directamente', () => {
    const source = plan(1)
    const budget = createTravelBudget(source, initialTravelBudgetEstimates, localExchangeRates[0])
    expect(source.totalPrice).toEqual({ amount: 1000, currency: 'BRL' })
    expect(budget.items[0]).toMatchObject({ money: { amount: 178010, currency: 'CLP' }, originalMoney: { amount: 1000, currency: 'BRL' }, originalPriceType: 'OFFICIAL' })
  })

  it('un precio PENDING conserva componentes pero no inventa total', () => {
    const budget = createTravelBudget(plan(1, null), initialTravelBudgetEstimates)
    expect(budget.complete).toBe(false)
    expect(budget.pendingReason).toBe('PLAN_PRICE')
    expect(budget.total).toBeNull()
    expect(budget.totalPerPerson).toBeNull()
    expect(budget.items.find((item) => item.category === 'FLIGHT')?.money).not.toBeNull()
  })

  it('un monto desconocido impide declarar un total completo', () => {
    const estimates = initialTravelBudgetEstimates.map((item) => item.category === 'FOOD' ? { ...item, money: null } : item)
    expect(createTravelBudget(plan(1), estimates, localExchangeRates[0])).toMatchObject({ complete: false, pendingReason: 'COMPONENT', total: null, totalPerPerson: null })
  })

  it('distingue una conversión CLP ausente de un precio no publicado', () => {
    expect(createTravelBudget(plan(1), initialTravelBudgetEstimates)).toMatchObject({ pendingReason: 'CONVERSION', total: null })
  })

  it('mantiene el orden de categorías', () => {
    const reversed = [...initialTravelBudgetEstimates].reverse()
    expect(createTravelBudget(plan(1), reversed, localExchangeRates[0]).items.map((item) => item.category)).toEqual(budgetCategoryOrder)
  })

  it('no muta plan, estimaciones ni tasa', () => {
    const source = plan(2); const estimates = structuredClone(initialTravelBudgetEstimates); const rate = structuredClone(localExchangeRates[0])
    const snapshot = structuredClone({ source, estimates, rate })
    createTravelBudget(source, estimates, rate)
    expect({ source, estimates, rate }).toEqual(snapshot)
  })

  it('maneja configuración vacía sin tratarla como error', () => {
    const budget = createTravelBudget(plan(1), [], localExchangeRates[0])
    expect(budget.items).toHaveLength(1)
    expect(budget.total?.amount).toBe(178010)
  })
})
