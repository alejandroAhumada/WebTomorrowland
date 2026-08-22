import { isPersonalTripTaskId } from './personalTripTask.js'

export const tripPreparationStorageKey = 'webtomorrowland:trip-preparation:v1'

export interface PersonalTripTaskProgress {
  completed: true
  completedAt: string
}

export interface TripPreparationState {
  plans: Record<string, Record<string, PersonalTripTaskProgress>>
}

export interface StorageReader { getItem(key: string): string | null }
export interface StorageWriter { setItem(key: string, value: string): void; removeItem(key: string): void }

const planIdPattern = /^[a-z0-9][a-z0-9-]{0,99}$/

export function emptyTripPreparation(): TripPreparationState {
  return { plans: {} }
}

export function parseTripPreparation(value: string | null): TripPreparationState {
  if (!value) return emptyTripPreparation()
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.plans)) return emptyTripPreparation()
    const plans: TripPreparationState['plans'] = {}
    for (const [planId, rawTasks] of Object.entries(parsed.plans)) {
      if (!planIdPattern.test(planId) || !isRecord(rawTasks)) continue
      const tasks: Record<string, PersonalTripTaskProgress> = {}
      for (const [taskId, rawProgress] of Object.entries(rawTasks)) {
        if (!isPersonalTripTaskId(taskId) || !isValidProgress(rawProgress)) continue
        tasks[taskId] = { completed: true, completedAt: rawProgress.completedAt }
      }
      if (Object.keys(tasks).length > 0) plans[planId] = tasks
    }
    return { plans }
  } catch {
    return emptyTripPreparation()
  }
}

export function serializeTripPreparation(state: TripPreparationState): string {
  return JSON.stringify({ version: 1, plans: state.plans })
}

export function readTripPreparation(storage: StorageReader | null): TripPreparationState {
  if (!storage) return emptyTripPreparation()
  try { return parseTripPreparation(storage.getItem(tripPreparationStorageKey)) } catch { return emptyTripPreparation() }
}

export function persistTripPreparation(storage: StorageWriter | null, state: TripPreparationState): boolean {
  if (!storage) return false
  try {
    if (Object.keys(state.plans).length === 0) storage.removeItem(tripPreparationStorageKey)
    else storage.setItem(tripPreparationStorageKey, serializeTripPreparation(state))
    return true
  } catch { return false }
}

export function tripPreparationFromStorageChange(key: string | null, value: string | null): TripPreparationState | null {
  return key === tripPreparationStorageKey ? parseTripPreparation(value) : null
}

export function setTaskCompleted(state: TripPreparationState, planId: string, taskId: string, completed: boolean, now = new Date()): TripPreparationState {
  if (!planIdPattern.test(planId) || !isPersonalTripTaskId(taskId)) return state
  const currentPlan = state.plans[planId] ?? {}
  if (completed && currentPlan[taskId]) return state
  if (!completed && !currentPlan[taskId]) return state
  const nextPlan = { ...currentPlan }
  if (completed) nextPlan[taskId] = { completed: true, completedAt: now.toISOString() }
  else delete nextPlan[taskId]
  const plans = { ...state.plans }
  if (Object.keys(nextPlan).length > 0) plans[planId] = nextPlan
  else delete plans[planId]
  return { plans }
}

export function resetPlanPreparation(state: TripPreparationState, planId: string): TripPreparationState {
  if (!state.plans[planId]) return state
  const plans = { ...state.plans }
  delete plans[planId]
  return { plans }
}

export function getTaskProgress(state: TripPreparationState, planId: string, taskId: string): PersonalTripTaskProgress | null {
  return state.plans[planId]?.[taskId] ?? null
}

function isValidProgress(value: unknown): value is PersonalTripTaskProgress {
  return isRecord(value) && value.completed === true && typeof value.completedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.completedAt)
    && Number.isFinite(Date.parse(value.completedAt))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
