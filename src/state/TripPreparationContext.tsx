import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getTaskProgress, persistTripPreparation, readTripPreparation, removeTaskExpense, resetPlanPreparation, setTaskCompleted, setTaskExpense, tripPreparationFromStorageChange, type TripPreparationState } from '../models/tripPreparation'
import { TripPreparationContext } from './useTripPreparation'

export function TripPreparationProvider({ children, initialState }: { children: ReactNode; initialState?: TripPreparationState }) {
  const [state, setState] = useState<TripPreparationState>(() => initialState ? structuredClone(initialState) : readInitialState())
  const setCompleted = useCallback((planId: string, taskId: string, completed: boolean) => {
    setState((current) => setTaskCompleted(current, planId, taskId, completed))
  }, [])
  const resetPlan = useCallback((planId: string) => setState((current) => resetPlanPreparation(current, planId)), [])
  const setExpense = useCallback((planId: string, taskId: string, amount: number, purchasedAt?: string) => {
    setState((current) => setTaskExpense(current, planId, taskId, amount, purchasedAt))
  }, [])
  const removeExpense = useCallback((planId: string, taskId: string) => {
    setState((current) => removeTaskExpense(current, planId, taskId))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { persistTripPreparation(window.localStorage, state) } catch { /* El progreso continúa en memoria. */ }
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const synchronize = (event: StorageEvent) => {
      const synchronized = tripPreparationFromStorageChange(event.key, event.newValue)
      if (synchronized) setState(synchronized)
    }
    window.addEventListener('storage', synchronize)
    return () => window.removeEventListener('storage', synchronize)
  }, [])

  const value = useMemo(() => ({
    state,
    getProgress: (planId: string, taskId: string) => getTaskProgress(state, planId, taskId),
    setCompleted,
    setExpense,
    removeExpense,
    resetPlan,
  }), [state, setCompleted, setExpense, removeExpense, resetPlan])
  return <TripPreparationContext.Provider value={value}>{children}</TripPreparationContext.Provider>
}

function readInitialState(): TripPreparationState {
  if (typeof window === 'undefined') return { plans: {} }
  try { return readTripPreparation(window.localStorage) } catch { return { plans: {} } }
}
