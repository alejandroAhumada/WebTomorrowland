import { useMemo } from 'react'
import { createTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import { createPlanRecommendations } from '../models/planRecommendation'
import { createTravelBudget } from '../models/travelBudget'
import { useBudgetPreferences } from '../state/useBudgetPreferences'
import { useExchangeRate } from './useExchangeRate'
import { usePlans } from './usePlans'

export function usePlanRecommendations(travelerCount: 1 | 2) {
  const { plans, loading: plansLoading, error } = usePlans()
  const { preferences, customized } = useBudgetPreferences()
  const { rate, loading: rateLoading } = useExchangeRate('BRL', 'CLP')
  const recommendations = useMemo(() => {
    const estimates = createTravelBudgetEstimates(preferences)
    const budgets = new Map(plans.map((plan) => [plan.id, createTravelBudget(plan, estimates, rate)]))
    return createPlanRecommendations(plans, budgets, travelerCount)
  }, [plans, preferences, rate, travelerCount])
  return { recommendations, loading: plansLoading || rateLoading, error, customized }
}
