import { createContext, useContext } from 'react'
import type { BudgetPreferenceKey, BudgetPreferences } from '../models/budgetPreferences'

export interface BudgetPreferencesContextValue {
  preferences: BudgetPreferences
  customized: boolean
  updatePreference: (key: BudgetPreferenceKey, value: number) => boolean
  resetPreferences: () => void
}

export const BudgetPreferencesContext = createContext<BudgetPreferencesContextValue | null>(null)

export function useBudgetPreferences(): BudgetPreferencesContextValue {
  const value = useContext(BudgetPreferencesContext)
  if (!value) throw new Error('useBudgetPreferences debe usarse dentro de BudgetPreferencesProvider.')
  return value
}
