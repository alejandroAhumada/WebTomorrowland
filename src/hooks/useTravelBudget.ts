import { useMemo } from 'react'
import { initialTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import type { TravelPlan } from '../models/plan'
import { createTravelBudget } from '../models/travelBudget'
import { useExchangeRate } from './useExchangeRate'

export function useTravelBudget(plan: TravelPlan) {
  const sourceCurrency = plan.totalPrice?.currency ?? 'CLP'
  const { rate, loading, unavailable } = useExchangeRate(sourceCurrency, 'CLP')
  const requiresRate = sourceCurrency !== 'CLP'
  const budget = useMemo(
    () => createTravelBudget(plan, initialTravelBudgetEstimates, requiresRate ? rate : null),
    [plan, rate, requiresRate],
  )
  return { budget, loading: requiresRate && loading, unavailable: requiresRate && unavailable }
}
