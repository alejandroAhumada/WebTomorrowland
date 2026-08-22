import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearMyTrip, isValidSelectedPlanId, myTripFromStorageChange, persistMyTrip, readMyTrip, selectMyTrip } from '../models/myTrip'
import { MyTripContext } from './useMyTrip'

export function MyTripProvider({ children, initialPlanId }: { children: ReactNode; initialPlanId?: string | null }) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(() => initialPlanId !== undefined ? initialPlanId : readInitialPlanId())
  const selectPlan = useCallback((planId: string) => {
    if (!isValidSelectedPlanId(planId)) return false
    setSelectedPlanId((current) => selectMyTrip({ selectedPlanId: current }, planId).selectedPlanId)
    return true
  }, [])
  const clearPlan = useCallback(() => setSelectedPlanId(clearMyTrip().selectedPlanId), [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { persistMyTrip(window.localStorage, selectedPlanId) } catch { /* La selección permanece en memoria. */ }
    }
  }, [selectedPlanId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const synchronize = (event: StorageEvent) => {
      const next = myTripFromStorageChange(event.key, event.newValue)
      if (next) setSelectedPlanId(next.selectedPlanId)
    }
    window.addEventListener('storage', synchronize)
    return () => window.removeEventListener('storage', synchronize)
  }, [])

  const value = useMemo(() => ({ selectedPlanId, selectPlan, clearPlan, isMyPlan: (planId: string) => selectedPlanId === planId }), [selectedPlanId, selectPlan, clearPlan])
  return <MyTripContext.Provider value={value}>{children}</MyTripContext.Provider>
}

function readInitialPlanId(): string | null {
  if (typeof window === 'undefined') return null
  try { return readMyTrip(window.localStorage).selectedPlanId } catch { return null }
}
