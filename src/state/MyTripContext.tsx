import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearMyTrip, emptyMyTrip, isValidSelectedPlanId, isValidTierId, myTripFromStorageChange, persistMyTrip, readMyTrip, selectMyTrip, setConsideredTier } from '../models/myTrip'
import { MyTripContext } from './useMyTrip'

export function MyTripProvider({ children, initialPlanId }: { children: ReactNode; initialPlanId?: string | null }) {
  const [state, setState] = useState(() => initialPlanId !== undefined ? { ...emptyMyTrip(), selectedPlanId: initialPlanId } : readInitialState())
  const { selectedPlanId, consideredTierByPlan } = state
  const selectPlan = useCallback((planId: string) => {
    if (!isValidSelectedPlanId(planId)) return false
    setState((current) => selectMyTrip(current, planId))
    return true
  }, [])
  const chooseTier = useCallback((planId: string, tierId: string) => {
    if (!isValidSelectedPlanId(planId) || !isValidTierId(tierId)) return false
    setState((current) => setConsideredTier(current, planId, tierId)); return true
  }, [])
  const clearPlan = useCallback(() => setState((current) => clearMyTrip(current)), [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { persistMyTrip(window.localStorage, state) } catch { /* La selección permanece en memoria. */ }
    }
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const synchronize = (event: StorageEvent) => {
      const next = myTripFromStorageChange(event.key, event.newValue)
      if (next) setState(next)
    }
    window.addEventListener('storage', synchronize)
    return () => window.removeEventListener('storage', synchronize)
  }, [])

  const value = useMemo(() => ({ selectedPlanId, consideredTierByPlan, selectPlan, setConsideredTier: chooseTier, clearPlan, isMyPlan: (planId: string) => selectedPlanId === planId }), [selectedPlanId, consideredTierByPlan, selectPlan, chooseTier, clearPlan])
  return <MyTripContext.Provider value={value}>{children}</MyTripContext.Provider>
}

function readInitialState() {
  if (typeof window === 'undefined') return emptyMyTrip()
  try { return readMyTrip(window.localStorage) } catch { return emptyMyTrip() }
}
