import type { TravelPlan } from './plan'

export const myTripStorageKey = 'webtomorrowland:my-trip:v1'
const planIdPattern = /^[a-z0-9][a-z0-9-]{0,99}$/

export interface MyTripState {
  selectedPlanId: string | null
}

interface StorageReader { getItem(key: string): string | null }
interface StorageWriter { setItem(key: string, value: string): void; removeItem(key: string): void }

export function isValidSelectedPlanId(value: unknown): value is string {
  return typeof value === 'string' && planIdPattern.test(value)
}

export function parseMyTrip(value: string | null): MyTripState {
  if (!value) return { selectedPlanId: null }
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.version !== 1 || !isValidSelectedPlanId(parsed.selectedPlanId)) return { selectedPlanId: null }
    return { selectedPlanId: parsed.selectedPlanId }
  } catch {
    return { selectedPlanId: null }
  }
}

export function serializeMyTrip(selectedPlanId: string): string {
  if (!isValidSelectedPlanId(selectedPlanId)) throw new Error('El ID del plan seleccionado no es válido.')
  return JSON.stringify({ version: 1, selectedPlanId })
}

export function readMyTrip(storage: StorageReader | null): MyTripState {
  if (!storage) return { selectedPlanId: null }
  try { return parseMyTrip(storage.getItem(myTripStorageKey)) } catch { return { selectedPlanId: null } }
}

export function persistMyTrip(storage: StorageWriter | null, selectedPlanId: string | null): boolean {
  if (!storage) return false
  try {
    if (selectedPlanId) storage.setItem(myTripStorageKey, serializeMyTrip(selectedPlanId))
    else storage.removeItem(myTripStorageKey)
    return true
  } catch { return false }
}

export function myTripFromStorageChange(key: string | null, newValue: string | null): MyTripState | null {
  return key === myTripStorageKey ? parseMyTrip(newValue) : null
}

export function resolveSelectedPlan(selectedPlanId: string | null, plans: readonly TravelPlan[]): TravelPlan | null {
  return selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) ?? null : null
}

export function selectMyTrip(state: MyTripState, planId: string): MyTripState {
  return isValidSelectedPlanId(planId) ? { selectedPlanId: planId } : state
}

export function clearMyTrip(): MyTripState {
  return { selectedPlanId: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
