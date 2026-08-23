import { describe, expect, it } from 'vitest'
import { productionPlans } from '../../scripts/productionPlans'
import { initialTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import { localExchangeRates } from '../data/localExchangeRates'
import { calculateExecutedTravelBudget, getTaskEstimatedExpense, normalizeActualExpenseForGroup } from './executedTravelBudget'
import type { PersonalTripTaskProgress } from './tripPreparation'
import { createTravelBudget } from './travelBudget'

const budgetFor = (id: string) => createTravelBudget(productionPlans.find((plan) => plan.id === id)!, initialTravelBudgetEstimates, localExchangeRates[0])
const expense = (amount: number, scope: 'PER_PERSON' | 'PER_GROUP'): PersonalTripTaskProgress => ({ actualExpense: { amount, currency: 'CLP', scope } })

describe('presupuesto ejecutado', () => {
  it('normaliza PER_PERSON y PER_GROUP para 1P y 2P, incluyendo cero explícito', () => {
    expect(normalizeActualExpenseForGroup(expense(365000, 'PER_PERSON'), 1)).toBe(365000)
    expect(normalizeActualExpenseForGroup(expense(365000, 'PER_PERSON'), 2)).toBe(730000)
    expect(normalizeActualExpenseForGroup(expense(260000, 'PER_GROUP'), 1)).toBe(260000)
    expect(normalizeActualExpenseForGroup(expense(260000, 'PER_GROUP'), 2)).toBe(260000)
    expect(normalizeActualExpenseForGroup(expense(0, 'PER_GROUP'), 2)).toBe(0)
    expect(normalizeActualExpenseForGroup({}, 2)).toBeNull()
  })

  it('Full Madness 2P reemplaza vuelo y alojamiento comparables sin doble multiplicación', () => {
    const budget = budgetFor('full-madness-2p-2027')
    const executed = calculateExecutedTravelBudget(budget, { flight: expense(365000, 'PER_PERSON'), 'external-accommodation': expense(260000, 'PER_GROUP') })
    expect(getTaskEstimatedExpense('flight', budget)).toBe(800000)
    expect(getTaskEstimatedExpense('external-accommodation', budget)).toBe(280000)
    expect(executed.actualPaid?.amount).toBe(990000)
    expect(executed.projectedDelta?.amount).toBe(-90000)
    expect(executed.projectedTotal?.amount).toBe(budget.total!.amount - 90000)
    expect(executed.remainingProjected?.amount).toBe(executed.projectedTotal!.amount - 990000)
  })

  it('combina gasto bajo, sobre e igual a estimación con scopes mixtos', () => {
    const budget = budgetFor('full-madness-2p-2027')
    const executed = calculateExecutedTravelBudget(budget, { flight: expense(350000, 'PER_PERSON'), 'local-transport': expense(140000, 'PER_GROUP'), 'external-accommodation': expense(280000, 'PER_GROUP') })
    expect(executed.expenses.map((item) => item.delta)).toEqual([-100000, 20000, 0])
    expect(executed.projectedDelta?.amount).toBe(-80000)
    expect(executed.actualPaidPerPerson?.amount).toBe(560000)
  })

  it('incorpora seguro real sin estimación como gasto adicional', () => {
    const budget = budgetFor('full-madness-1p-2027')
    const executed = calculateExecutedTravelBudget(budget, { 'travel-insurance': expense(35000, 'PER_PERSON') })
    expect(executed.actualPaid?.amount).toBe(35000)
    expect(executed.expenses[0].estimatedGroupAmount).toBeNull()
    expect(executed.projectedTotal?.amount).toBe(budget.total!.amount + 35000)
    expect(executed.projectedDelta?.amount).toBe(35000)
  })

  it('sin gastos conserva estimación y completed sin monto no altera proyección', () => {
    const budget = budgetFor('full-madness-1p-2027')
    const empty = calculateExecutedTravelBudget(budget, {})
    const completed = calculateExecutedTravelBudget(budget, { flight: { completed: true, completedAt: '2026-08-22T00:00:00.000Z' } })
    expect(empty.actualPaid).toBeNull()
    expect(completed.actualPaid).toBeNull()
    expect(completed.projectedTotal?.amount).toBe(budget.total?.amount)
  })

  it('PENDING o falta de BCCh conserva pagado pero no inventa proyección', () => {
    const pendingPlan = productionPlans.find((plan) => plan.id === 'global-journey-hotel-2p-2027')!
    const pending = createTravelBudget(pendingPlan, initialTravelBudgetEstimates, localExchangeRates[0])
    const noRate = createTravelBudget(productionPlans.find((plan) => plan.id === 'full-madness-1p-2027')!, initialTravelBudgetEstimates)
    for (const budget of [pending, noRate]) {
      const executed = calculateExecutedTravelBudget(budget, { flight: expense(365000, 'PER_PERSON') })
      expect(executed.actualPaid?.amount).toBe(365000 * budget.travelerCount)
      expect(executed.estimatedTotal).toBeNull()
      expect(executed.projectedTotal).toBeNull()
      expect(executed.remainingProjected).toBeNull()
    }
  })
})
