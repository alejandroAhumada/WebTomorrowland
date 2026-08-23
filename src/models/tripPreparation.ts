import { getPersonalTripTaskDefinition, isPersonalTripTaskId } from './personalTripTask.js'

export const tripPreparationStorageKey = 'webtomorrowland:trip-preparation:v1'
export const tripPreparationStorageVersion = 2
export const maximumActualExpenseClp = 100_000_000

export interface ActualExpense {
  amount: number
  currency: 'CLP'
  scope: 'PER_PERSON' | 'PER_GROUP'
}

export interface PersonalTripTaskProgress {
  completed?: true
  completedAt?: string
  actualExpense?: ActualExpense
  purchasedAt?: string
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
    if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== 2) || !isRecord(parsed.plans)) return emptyTripPreparation()
    const plans: TripPreparationState['plans'] = {}
    for (const [planId, rawTasks] of Object.entries(parsed.plans)) {
      if (!planIdPattern.test(planId) || !isRecord(rawTasks)) continue
      const tasks: Record<string, PersonalTripTaskProgress> = {}
      for (const [taskId, rawProgress] of Object.entries(rawTasks)) {
        if (!isPersonalTripTaskId(taskId)) continue
        const progress = normalizeProgress(rawProgress, taskId, parsed.version)
        if (progress) tasks[taskId] = progress
      }
      if (Object.keys(tasks).length > 0) plans[planId] = tasks
    }
    return { plans }
  } catch {
    return emptyTripPreparation()
  }
}

export function serializeTripPreparation(state: TripPreparationState): string {
  return JSON.stringify({ version: tripPreparationStorageVersion, plans: state.plans })
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
  if (completed && currentPlan[taskId]?.completed) return state
  if (!completed && !currentPlan[taskId]?.completed) return state
  const nextPlan = { ...currentPlan }
  if (completed) nextPlan[taskId] = { ...currentPlan[taskId], completed: true, completedAt: now.toISOString() }
  else {
    const expenseOnly = { ...currentPlan[taskId] }
    delete expenseOnly.completed
    delete expenseOnly.completedAt
    if (Object.keys(expenseOnly).length > 0) nextPlan[taskId] = expenseOnly
    else delete nextPlan[taskId]
  }
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

export function setTaskExpense(state: TripPreparationState, planId: string, taskId: string, amount: number, purchasedAt?: string, today = currentCivilDate()): TripPreparationState {
  const definition = getPersonalTripTaskDefinition(taskId)
  if (!planIdPattern.test(planId) || !definition || definition.expenseTracking === 'NONE' || !isValidExpenseAmount(amount)) return state
  if (purchasedAt !== undefined && !isValidPurchasedAt(purchasedAt, today)) return state
  const currentPlan = state.plans[planId] ?? {}
  const nextProgress: PersonalTripTaskProgress = {
    ...currentPlan[taskId],
    actualExpense: { amount, currency: 'CLP', scope: definition.expenseTracking },
    ...(purchasedAt ? { purchasedAt } : {}),
  }
  if (!purchasedAt) delete nextProgress.purchasedAt
  return { plans: { ...state.plans, [planId]: { ...currentPlan, [taskId]: nextProgress } } }
}

export function removeTaskExpense(state: TripPreparationState, planId: string, taskId: string): TripPreparationState {
  const current = state.plans[planId]?.[taskId]
  if (!current?.actualExpense) return state
  const completion = { ...current }
  delete completion.actualExpense
  delete completion.purchasedAt
  const nextPlan = { ...state.plans[planId] }
  if (Object.keys(completion).length > 0) nextPlan[taskId] = completion
  else delete nextPlan[taskId]
  const plans = { ...state.plans }
  if (Object.keys(nextPlan).length > 0) plans[planId] = nextPlan
  else delete plans[planId]
  return { plans }
}

export function isValidExpenseAmount(amount: number): boolean {
  return Number.isInteger(amount) && Number.isFinite(amount) && amount >= 0 && amount <= maximumActualExpenseClp
}

export function isValidPurchasedAt(value: string, today = currentCivilDate()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const calendar = new Date(Date.UTC(year, month - 1, day))
  const exists = calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day
  return exists && value <= today
}

function normalizeProgress(value: unknown, taskId: string, version: number): PersonalTripTaskProgress | null {
  if (!isRecord(value)) return null
  const progress: PersonalTripTaskProgress = {}
  if (value.completed === true && isValidCompletedAt(value.completedAt)) {
    progress.completed = true
    progress.completedAt = value.completedAt
  } else if (version === 1 || value.completed !== undefined || value.completedAt !== undefined) {
    return null
  }
  if (version === 2 && value.actualExpense !== undefined) {
    const definition = getPersonalTripTaskDefinition(taskId)
    if (!definition || definition.expenseTracking === 'NONE' || !isValidActualExpense(value.actualExpense, definition.expenseTracking)) return null
    progress.actualExpense = { ...value.actualExpense }
    if (value.purchasedAt !== undefined) {
      if (typeof value.purchasedAt !== 'string' || !isValidPurchasedAt(value.purchasedAt)) return null
      progress.purchasedAt = value.purchasedAt
    }
  } else if (value.purchasedAt !== undefined) return null
  return Object.keys(progress).length > 0 ? progress : null
}

function isValidActualExpense(value: unknown, expectedScope: 'PER_PERSON' | 'PER_GROUP'): value is ActualExpense {
  return isRecord(value) && isValidExpenseAmount(value.amount as number) && value.currency === 'CLP' && value.scope === expectedScope
}

function isValidCompletedAt(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value))
}

function currentCivilDate(now = new Date()): string {
  const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
