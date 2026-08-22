import { createContext, useContext } from 'react'
import type { PersonalTripTaskProgress, TripPreparationState } from '../models/tripPreparation'

export interface TripPreparationContextValue {
  state: TripPreparationState
  getProgress: (planId: string, taskId: string) => PersonalTripTaskProgress | null
  setCompleted: (planId: string, taskId: string, completed: boolean) => void
  resetPlan: (planId: string) => void
}

export const TripPreparationContext = createContext<TripPreparationContextValue | null>(null)

export function useTripPreparation(): TripPreparationContextValue {
  const value = useContext(TripPreparationContext)
  if (!value) throw new Error('useTripPreparation debe usarse dentro de TripPreparationProvider.')
  return value
}
