import type { ExchangeRate } from './exchangeRate'
import { convertMoney } from './exchangeRate'
import type { Money, PriceType, TravelPlan } from './plan'

export type BudgetCategory = 'TOMORROWLAND' | 'FLIGHT' | 'LOCAL_TRANSPORT' | 'FOOD' | 'PERSONAL_EXPENSES'
export type BudgetScope = 'PER_GROUP' | 'PER_PERSON'
export type BudgetValueType = PriceType | 'PENDING'

export interface BudgetEstimate {
  category: Exclude<BudgetCategory, 'TOMORROWLAND'>
  money: Money | null
  scope: BudgetScope
  description: string
  updatedAt: string
}

export interface BudgetItem {
  category: BudgetCategory
  money: Money | null
  scope: BudgetScope
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
}

export const budgetCategoryOrder: BudgetCategory[] = ['TOMORROWLAND', 'FLIGHT', 'LOCAL_TRANSPORT', 'FOOD', 'PERSONAL_EXPENSES']

export function createTravelBudget(plan: TravelPlan, estimates: readonly BudgetEstimate[], exchangeRate?: ExchangeRate | null): TravelBudget {
  const tomorrowlandMoney = convertMoney(plan.totalPrice, 'CLP', exchangeRate)
  const tomorrowlandItem: BudgetItem = {
      category: 'TOMORROWLAND', money: tomorrowlandMoney, scope: 'PER_GROUP', travelerCount: plan.travelerCount,
      valueType: plan.totalPrice && tomorrowlandMoney ? 'ESTIMATED' : 'PENDING',
      description: 'Precio Tomorrowland convertido referencialmente a CLP.', updatedAt: plan.updatedAt,
      ...(plan.totalPrice ? { originalMoney: { ...plan.totalPrice } } : {}),
      ...(plan.priceType ? { originalPriceType: plan.priceType } : {}),
    }
  const estimateItems: BudgetItem[] = estimates.map((estimate) => ({
      category: estimate.category, money: estimate.money ? { ...estimate.money } : null,
      scope: estimate.scope, travelerCount: plan.travelerCount,
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
    complete, pendingReason,
  }
}

export function budgetItemTotal(item: BudgetItem): number {
  if (!item.money) return 0
  return item.scope === 'PER_PERSON' ? item.money.amount * item.travelerCount : item.money.amount
}

export function budgetItemTotalMoney(item: BudgetItem): Money | null {
  return item.money ? { amount: budgetItemTotal(item), currency: item.money.currency } : null
}
