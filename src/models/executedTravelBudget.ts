import type { Money } from './plan'
import { getPersonalTripTaskDefinition } from './personalTripTask'
import type { PersonalTripTaskProgress } from './tripPreparation'
import type { BudgetItem, TravelBudget } from './travelBudget'
import { budgetItemTotal } from './travelBudget'

export interface ExecutedExpenseItem {
  taskId: string
  actualGroupAmount: number
  estimatedGroupAmount: number | null
  delta: number | null
  budgetCategory: BudgetItem['category'] | null
}

export interface ExecutedTravelBudget {
  currency: 'CLP'
  expenses: ExecutedExpenseItem[]
  estimatedTotal: Money | null
  actualPaid: Money | null
  actualPaidPerPerson: Money | null
  projectedTotal: Money | null
  projectedTotalPerPerson: Money | null
  remainingProjected: Money | null
  projectedDelta: Money | null
}

export function normalizeActualExpenseForGroup(progress: PersonalTripTaskProgress, travelerCount: number): number | null {
  if (!progress.actualExpense) return null
  return progress.actualExpense.amount * (progress.actualExpense.scope === 'PER_PERSON' ? travelerCount : 1)
}

export function getTaskEstimatedExpense(taskId: string, budget: TravelBudget): number | null {
  const definition = getPersonalTripTaskDefinition(taskId)
  if (!definition?.budgetCategory) return null
  const item = budget.items.find((candidate) => candidate.category === definition.budgetCategory)
  if (!item?.money || item.scope !== definition.expenseTracking) return null
  return budgetItemTotal(item)
}

export function calculateExecutedTravelBudget(budget: TravelBudget, progress: Readonly<Record<string, PersonalTripTaskProgress>>): ExecutedTravelBudget {
  const expenses = Object.entries(progress).flatMap(([taskId, itemProgress]) => {
    const actualGroupAmount = normalizeActualExpenseForGroup(itemProgress, budget.travelerCount)
    if (actualGroupAmount === null) return []
    const estimatedGroupAmount = getTaskEstimatedExpense(taskId, budget)
    const definition = getPersonalTripTaskDefinition(taskId)
    return [{ taskId, actualGroupAmount, estimatedGroupAmount, delta: estimatedGroupAmount === null ? null : actualGroupAmount - estimatedGroupAmount, budgetCategory: definition?.budgetCategory ?? null }]
  })
  const paidAmount = expenses.reduce((sum, expense) => sum + expense.actualGroupAmount, 0)
  const estimatedTotal = budget.total ? { ...budget.total } : null
  if (!budget.total) return {
    currency: 'CLP', expenses, estimatedTotal: null,
    actualPaid: expenses.length ? money(paidAmount) : null,
    actualPaidPerPerson: expenses.length ? money(paidAmount / budget.travelerCount) : null,
    projectedTotal: null, projectedTotalPerPerson: null, remainingProjected: null, projectedDelta: null,
  }
  const comparableDelta = expenses.reduce((sum, expense) => sum + (expense.delta ?? expense.actualGroupAmount), 0)
  const projectedAmount = budget.total.amount + comparableDelta
  const remainingAmount = projectedAmount - paidAmount
  return {
    currency: 'CLP', expenses, estimatedTotal,
    actualPaid: expenses.length ? money(paidAmount) : null,
    actualPaidPerPerson: expenses.length ? money(paidAmount / budget.travelerCount) : null,
    projectedTotal: money(projectedAmount), projectedTotalPerPerson: money(projectedAmount / budget.travelerCount),
    remainingProjected: money(remainingAmount), projectedDelta: money(projectedAmount - budget.total.amount),
  }
}

function money(amount: number): Money { return { amount, currency: 'CLP' } }
