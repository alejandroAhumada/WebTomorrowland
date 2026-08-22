import type { ExchangeRate } from './exchangeRate'
import { convertMoney } from './exchangeRate'
import type { Money, PriceType, TravelPlan } from './plan'

export type BudgetCategory = 'TOMORROWLAND' | 'FLIGHT' | 'EXTERNAL_ACCOMMODATION' | 'LOCAL_TRANSPORT' | 'FOOD' | 'PERSONAL_EXPENSES'
export type BudgetScope = 'PER_GROUP' | 'PER_PERSON'
export type BudgetUnit = 'TRIP' | 'NIGHT' | 'DAY'
export type BudgetValueType = PriceType | 'PENDING'

export interface BudgetEstimate {
  category: Exclude<BudgetCategory, 'TOMORROWLAND'>
  money: Money | null
  scope: BudgetScope
  unit: BudgetUnit
  quantity: number
  description: string
  updatedAt: string
}

export interface BudgetItem {
  category: BudgetCategory
  money: Money | null
  scope: BudgetScope
  unit: BudgetUnit
  quantity: number
  travelerCount: number
  valueType: BudgetValueType
  description: string
  updatedAt: string
  originalMoney?: Money
  originalPriceType?: PriceType
}

export interface TravelBudget {
  planId: string
  travelerCount: number
  currency: 'CLP'
  items: BudgetItem[]
  total: Money | null
  totalPerPerson: Money | null
  complete: boolean
  pendingReason: 'PLAN_PRICE' | 'CONVERSION' | 'COMPONENT' | null
  accommodationIncluded: boolean
}

export const budgetCategoryOrder: BudgetCategory[] = ['TOMORROWLAND', 'FLIGHT', 'EXTERNAL_ACCOMMODATION', 'LOCAL_TRANSPORT', 'FOOD', 'PERSONAL_EXPENSES']

export function planIncludesAccommodation(plan: TravelPlan): boolean {
  return plan.category === 'GLOBAL_JOURNEY' || plan.dreamVilleIncluded
}

export function createTravelBudget(plan: TravelPlan, estimates: readonly BudgetEstimate[], exchangeRate?: ExchangeRate | null): TravelBudget {
  const tomorrowlandMoney = convertMoney(plan.totalPrice, 'CLP', exchangeRate)
  const tomorrowlandItem: BudgetItem = {
      category: 'TOMORROWLAND', money: tomorrowlandMoney, scope: 'PER_GROUP', unit: 'TRIP', quantity: 1, travelerCount: plan.travelerCount,
      valueType: plan.totalPrice && tomorrowlandMoney ? 'ESTIMATED' : 'PENDING',
      description: 'Precio Tomorrowland convertido referencialmente a CLP.', updatedAt: plan.updatedAt,
      ...(plan.totalPrice ? { originalMoney: { ...plan.totalPrice } } : {}),
      ...(plan.priceType ? { originalPriceType: plan.priceType } : {}),
    }
  const accommodationIncluded = planIncludesAccommodation(plan)
  const applicableEstimates = estimates.filter((estimate) => estimate.category !== 'EXTERNAL_ACCOMMODATION' || !accommodationIncluded)
  const estimateItems: BudgetItem[] = applicableEstimates.map((estimate) => ({
      category: estimate.category, money: estimate.money ? { ...estimate.money } : null,
      scope: estimate.scope, unit: estimate.unit, quantity: estimate.quantity, travelerCount: plan.travelerCount,
      valueType: estimate.money ? 'ESTIMATED' as const : 'PENDING' as const,
      description: estimate.description, updatedAt: estimate.updatedAt,
    }))
  const items = [tomorrowlandItem, ...estimateItems]
    .sort((left, right) => budgetCategoryOrder.indexOf(left.category) - budgetCategoryOrder.indexOf(right.category))

  const complete = items.every((item) => item.money !== null)
  const pendingReason = !plan.totalPrice ? 'PLAN_PRICE' : !tomorrowlandMoney ? 'CONVERSION' : estimateItems.some((item) => !item.money) ? 'COMPONENT' : null
  const amount = complete ? items.reduce((sum, item) => sum + budgetItemTotal(item), 0) : null
  return {
    planId: plan.id, travelerCount: plan.travelerCount, currency: 'CLP', items,
    total: amount === null ? null : { amount, currency: 'CLP' },
    totalPerPerson: amount === null ? null : { amount: amount / plan.travelerCount, currency: 'CLP' },
    complete, pendingReason, accommodationIncluded,
  }
}

export function budgetItemTotal(item: BudgetItem): number {
  if (!item.money) return 0
  const travelers = item.scope === 'PER_PERSON' ? item.travelerCount : 1
  return item.money.amount * item.quantity * travelers
}

export function budgetItemTotalMoney(item: BudgetItem): Money | null {
  return item.money ? { amount: budgetItemTotal(item), currency: item.money.currency } : null
}
