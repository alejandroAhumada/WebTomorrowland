import { createContext, useContext } from 'react'

export interface MyTripContextValue {
  selectedPlanId: string | null
  selectPlan: (planId: string) => boolean
  clearPlan: () => void
  isMyPlan: (planId: string) => boolean
}

export const MyTripContext = createContext<MyTripContextValue | null>(null)

export function useMyTrip(): MyTripContextValue {
  const value = useContext(MyTripContext)
  if (!value) throw new Error('useMyTrip debe usarse dentro de MyTripProvider.')
  return value
}
