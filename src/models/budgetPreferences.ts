export interface BudgetPreferences {
  days: number
  nights: number
  flightPerPerson: number
  accommodationPerNight: number
  localTransportPerGroup: number
  foodPerPersonPerDay: number
  personalExpensesPerPerson: number
}

export type BudgetPreferenceKey = keyof BudgetPreferences
export const budgetPreferencesStorageKey = 'webtomorrowland:budget-preferences:v1'

export const budgetPreferenceLimits: Record<BudgetPreferenceKey, { min: number; max: number }> = {
  days: { min: 1, max: 30 },
  nights: { min: 0, max: 30 },
  flightPerPerson: { min: 0, max: 10000000 },
  accommodationPerNight: { min: 0, max: 5000000 },
  localTransportPerGroup: { min: 0, max: 5000000 },
  foodPerPersonPerDay: { min: 0, max: 1000000 },
  personalExpensesPerPerson: { min: 0, max: 10000000 },
}

export function validateBudgetPreference(key: BudgetPreferenceKey, value: number): string | null {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 'Ingresa un número entero válido.'
  const { min, max } = budgetPreferenceLimits[key]
  if (value < min || value > max) return `Debe estar entre ${min.toLocaleString('es-CL')} y ${max.toLocaleString('es-CL')}.`
  return null
}

export function parseBudgetPreferences(value: string | null, defaults: BudgetPreferences): BudgetPreferences {
  if (!value) return { ...defaults }
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.values)) return { ...defaults }
    const values = parsed.values
    const merged = { ...defaults }
    for (const key of Object.keys(defaults) as BudgetPreferenceKey[]) {
      const candidate = values[key]
      if (typeof candidate === 'number' && validateBudgetPreference(key, candidate) === null) merged[key] = candidate
    }
    return merged
  } catch {
    return { ...defaults }
  }
}

export function serializeBudgetPreferences(values: BudgetPreferences): string {
  return JSON.stringify({ version: 1, values })
}

export function isBudgetCustomized(values: BudgetPreferences, defaults: BudgetPreferences): boolean {
  return (Object.keys(defaults) as BudgetPreferenceKey[]).some((key) => values[key] !== defaults[key])
}

export function updateBudgetPreference(values: BudgetPreferences, key: BudgetPreferenceKey, value: number): BudgetPreferences {
  if (validateBudgetPreference(key, value)) return values
  return { ...values, [key]: value }
}

export function preferencesFromStorageChange(key: string | null, newValue: string | null, defaults: BudgetPreferences): BudgetPreferences | null {
  return key === budgetPreferencesStorageKey ? parseBudgetPreferences(newValue, defaults) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
