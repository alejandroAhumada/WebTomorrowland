import type { Money, TravelPlan } from './plan'
import { getPricePerPerson } from './plan'
import type { TravelBudget } from './travelBudget'
import { planIncludesAccommodation } from './travelBudget'

export type PlanRecommendationCriterion = 'LOWEST_TRIP_BUDGET' | 'LOWEST_TOMORROWLAND_PRICE' | 'LOWEST_BUDGET_WITH_ACCOMMODATION'

export interface RecommendationHighlight {
  criterion: PlanRecommendationCriterion
  metric: Money
  explanation: string
}

export interface PlanRecommendation {
  plan: TravelPlan
  highlights: RecommendationHighlight[]
}

const criterionOrder: PlanRecommendationCriterion[] = ['LOWEST_TRIP_BUDGET', 'LOWEST_TOMORROWLAND_PRICE', 'LOWEST_BUDGET_WITH_ACCOMMODATION']

export function createPlanRecommendations(plans: readonly TravelPlan[], budgets: ReadonlyMap<string, TravelBudget>, travelerCount: 1 | 2): PlanRecommendation[] {
  const eligible = plans.filter((plan) => plan.travelerCount === travelerCount)
  const winners = [
    lowestTripBudget(eligible, budgets),
    lowestTomorrowlandPrice(eligible),
    lowestBudgetWithAccommodation(eligible, budgets),
  ]

  const grouped = new Map<string, PlanRecommendation>()
  for (const winner of winners) {
    if (!winner) continue
    const current = grouped.get(winner.plan.id)
    if (current) current.highlights.push(winner.highlight)
    else grouped.set(winner.plan.id, { plan: winner.plan, highlights: [winner.highlight] })
  }
  return [...grouped.values()].map((recommendation) => ({ ...recommendation, highlights: [...recommendation.highlights].sort((a, b) => criterionOrder.indexOf(a.criterion) - criterionOrder.indexOf(b.criterion)) }))
}

export function lowestTripBudget(plans: readonly TravelPlan[], budgets: ReadonlyMap<string, TravelBudget>) {
  const candidates = plans.flatMap((plan) => {
    const metric = budgets.get(plan.id)?.totalPerPerson
    return metric ? [{ plan, metric }] : []
  }).sort(compareBudgetCandidates)
  return candidates[0] ? { plan: candidates[0].plan, highlight: { criterion: 'LOWEST_TRIP_BUDGET' as const, metric: candidates[0].metric, explanation: 'Menor presupuesto completo estimado por persona entre las alternativas con precio conocido.' } } : null
}

export function lowestTomorrowlandPrice(plans: readonly TravelPlan[]) {
  const candidates = plans.flatMap((plan) => {
    const metric = getPricePerPerson(plan)
    return metric?.currency === 'BRL' ? [{ plan, metric }] : []
  }).sort((left, right) => compareAmountThenPlan(left.metric.amount, right.metric.amount, left.plan, right.plan))
  return candidates[0] ? { plan: candidates[0].plan, highlight: { criterion: 'LOWEST_TOMORROWLAND_PRICE' as const, metric: candidates[0].metric, explanation: 'Menor precio Tomorrowland original por persona; no representa el costo completo del viaje.' } } : null
}

export function lowestBudgetWithAccommodation(plans: readonly TravelPlan[], budgets: ReadonlyMap<string, TravelBudget>) {
  const candidates = plans.filter((plan) => planIncludesAccommodation(plan) === true).flatMap((plan) => {
    const metric = budgets.get(plan.id)?.totalPerPerson
    return metric ? [{ plan, metric }] : []
  }).sort(compareBudgetCandidates)
  return candidates[0] ? { plan: candidates[0].plan, highlight: { criterion: 'LOWEST_BUDGET_WITH_ACCOMMODATION' as const, metric: candidates[0].metric, explanation: 'Menor presupuesto completo estimado por persona entre los planes que incluyen alojamiento.' } } : null
}

function compareBudgetCandidates(left: { plan: TravelPlan; metric: Money }, right: { plan: TravelPlan; metric: Money }): number {
  const amount = left.metric.amount - right.metric.amount
  if (amount) return amount
  const leftOriginal = left.plan.totalPrice?.currency === 'BRL' ? left.plan.totalPrice.amount / left.plan.travelerCount : Number.POSITIVE_INFINITY
  const rightOriginal = right.plan.totalPrice?.currency === 'BRL' ? right.plan.totalPrice.amount / right.plan.travelerCount : Number.POSITIVE_INFINITY
  return compareAmountThenPlan(leftOriginal, rightOriginal, left.plan, right.plan)
}

function compareAmountThenPlan(leftAmount: number, rightAmount: number, left: TravelPlan, right: TravelPlan): number {
  return leftAmount - rightAmount || left.name.localeCompare(right.name, 'es') || left.id.localeCompare(right.id)
}
