import { useMemo } from 'react'
import { createTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import type { TravelPlan } from '../models/plan'
import { createTravelBudget } from '../models/travelBudget'
import { useExchangeRate } from './useExchangeRate'
import { useBudgetPreferences } from '../state/useBudgetPreferences'

export function useTravelBudget(plan: TravelPlan) {
  const { preferences } = useBudgetPreferences()
  const sourceCurrency = plan.totalPrice?.currency ?? 'CLP'
  const { rate, loading, unavailable } = useExchangeRate(sourceCurrency, 'CLP')
  const requiresRate = sourceCurrency !== 'CLP'
  const budget = useMemo(
    () => createTravelBudget(plan, createTravelBudgetEstimates(preferences), requiresRate ? rate : null),
    [plan, preferences, rate, requiresRate],
  )
  return { budget, loading: requiresRate && loading, unavailable: requiresRate && unavailable }
}
