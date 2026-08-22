import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import { budgetPreferencesStorageKey, isBudgetCustomized, parseBudgetPreferences, preferencesFromStorageChange, serializeBudgetPreferences, updateBudgetPreference as applyBudgetPreference, validateBudgetPreference, type BudgetPreferenceKey, type BudgetPreferences } from '../models/budgetPreferences'
import { BudgetPreferencesContext } from './useBudgetPreferences'

export function BudgetPreferencesProvider({ children, initialPreferences }: { children: ReactNode; initialPreferences?: BudgetPreferences }) {
  const [preferences, setPreferences] = useState<BudgetPreferences>(() => initialPreferences ? { ...initialPreferences } : readStoredPreferences())
  const customized = isBudgetCustomized(preferences, defaultBudgetPreferences)

  const updatePreference = useCallback((key: BudgetPreferenceKey, value: number) => {
    if (validateBudgetPreference(key, value)) return false
    setPreferences((current) => applyBudgetPreference(current, key, value))
    return true
  }, [])
  const resetPreferences = useCallback(() => setPreferences({ ...defaultBudgetPreferences }), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (customized) window.localStorage.setItem(budgetPreferencesStorageKey, serializeBudgetPreferences(preferences))
      else window.localStorage.removeItem(budgetPreferencesStorageKey)
    } catch {
      // La personalización continúa funcionando en memoria si el navegador bloquea el almacenamiento.
    }
  }, [customized, preferences])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncPreferences = (event: StorageEvent) => {
      const synchronized = preferencesFromStorageChange(event.key, event.newValue, defaultBudgetPreferences)
      if (synchronized) setPreferences(synchronized)
    }
    window.addEventListener('storage', syncPreferences)
    return () => window.removeEventListener('storage', syncPreferences)
  }, [])

  const value = useMemo(() => ({ preferences, customized, updatePreference, resetPreferences }), [preferences, customized, updatePreference, resetPreferences])
  return <BudgetPreferencesContext.Provider value={value}>{children}</BudgetPreferencesContext.Provider>
}

function readStoredPreferences(): BudgetPreferences {
  if (typeof window === 'undefined') return { ...defaultBudgetPreferences }
  try {
    return parseBudgetPreferences(window.localStorage.getItem(budgetPreferencesStorageKey), defaultBudgetPreferences)
  } catch {
    return { ...defaultBudgetPreferences }
  }
}
