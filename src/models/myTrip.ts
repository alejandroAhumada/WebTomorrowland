import type { TravelPlan } from './plan'

export const myTripStorageKey = 'webtomorrowland:my-trip:v2'
export const legacyMyTripStorageKey = 'webtomorrowland:my-trip:v1'
const planIdPattern = /^[a-z0-9][a-z0-9-]{0,99}$/
const tierIdPattern = /^[a-z0-9][a-z0-9-]{0,49}$/

export interface MyTripState { selectedPlanId: string | null; consideredTierByPlan: Record<string, string> }
interface StorageReader { getItem(key: string): string | null }
interface StorageWriter extends StorageReader { setItem(key: string, value: string): void; removeItem(key: string): void }

export function isValidSelectedPlanId(value: unknown): value is string { return typeof value === 'string' && planIdPattern.test(value) }
export function isValidTierId(value: unknown): value is string { return typeof value === 'string' && tierIdPattern.test(value) }
export function emptyMyTrip(): MyTripState { return { selectedPlanId: null, consideredTierByPlan: {} } }

export function parseMyTrip(value: string | null): MyTripState {
  if (!value) return emptyMyTrip()
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.version !== 2 || !isValidSelectedPlanId(parsed.selectedPlanId)) return emptyMyTrip()
    return { selectedPlanId: parsed.selectedPlanId, consideredTierByPlan: parseTierMap(parsed.consideredTierByPlan) }
  } catch { return emptyMyTrip() }
}

export function parseLegacyMyTrip(value: string | null): MyTripState {
  if (!value) return emptyMyTrip()
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) && parsed.version === 1 && isValidSelectedPlanId(parsed.selectedPlanId)
      ? { selectedPlanId: parsed.selectedPlanId, consideredTierByPlan: {} }
      : emptyMyTrip()
  } catch { return emptyMyTrip() }
}

export function serializeMyTrip(stateOrPlanId: MyTripState | string): string {
  const state = typeof stateOrPlanId === 'string' ? { selectedPlanId: stateOrPlanId, consideredTierByPlan: {} } : stateOrPlanId
  if (!isValidSelectedPlanId(state.selectedPlanId)) throw new Error('El ID del plan seleccionado no es válido.')
  return JSON.stringify({ version: 2, selectedPlanId: state.selectedPlanId, consideredTierByPlan: parseTierMap(state.consideredTierByPlan) })
}

export function readMyTrip(storage: StorageReader | null): MyTripState {
  if (!storage) return emptyMyTrip()
  try { const current = storage.getItem(myTripStorageKey); return current ? parseMyTrip(current) : parseLegacyMyTrip(storage.getItem(legacyMyTripStorageKey)) } catch { return emptyMyTrip() }
}

export function persistMyTrip(storage: StorageWriter | null, stateOrPlanId: MyTripState | string | null): boolean {
  if (!storage) return false
  try {
    const state = typeof stateOrPlanId === 'string' ? { selectedPlanId: stateOrPlanId, consideredTierByPlan: {} } : stateOrPlanId
    if (state?.selectedPlanId) { storage.setItem(myTripStorageKey, serializeMyTrip(state)); storage.removeItem(legacyMyTripStorageKey) }
    else { storage.removeItem(myTripStorageKey); storage.removeItem(legacyMyTripStorageKey) }
    return true
  } catch { return false }
}

export function myTripFromStorageChange(key: string | null, newValue: string | null): MyTripState | null {
  if (key === myTripStorageKey) return parseMyTrip(newValue)
  if (key === legacyMyTripStorageKey) return newValue ? parseLegacyMyTrip(newValue) : null
  return null
}

export function resolveSelectedPlan(selectedPlanId: string | null, plans: readonly TravelPlan[]): TravelPlan | null { return selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) ?? null : null }
export function selectMyTrip(state: MyTripState, planId: string): MyTripState { return isValidSelectedPlanId(planId) ? { ...state, selectedPlanId: planId, consideredTierByPlan: { ...state.consideredTierByPlan } } : state }
export function setConsideredTier(state: MyTripState, planId: string, tierId: string): MyTripState { return isValidSelectedPlanId(planId) && isValidTierId(tierId) ? { ...state, consideredTierByPlan: { ...state.consideredTierByPlan, [planId]: tierId } } : state }
export function clearMyTrip(state: MyTripState = emptyMyTrip()): MyTripState { return { selectedPlanId: null, consideredTierByPlan: { ...state.consideredTierByPlan } } }

function parseTierMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const result: Record<string, string> = {}
  for (const [planId, tierId] of Object.entries(value)) if (isValidSelectedPlanId(planId) && isValidTierId(tierId)) result[planId] = tierId
  return result
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
