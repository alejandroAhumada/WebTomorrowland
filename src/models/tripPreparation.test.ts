import { describe, expect, it } from 'vitest'
import { emptyTripPreparation, getTaskProgress, isValidExpenseAmount, isValidPurchasedAt, parseTripPreparation, persistTripPreparation, readTripPreparation, removeTaskExpense, resetPlanPreparation, serializeTripPreparation, setTaskCompleted, setTaskExpense, tripPreparationFromStorageChange, tripPreparationStorageKey } from './tripPreparation'

const easyTent = 'easy-tent-2p-2027'
const fullMadness = 'full-madness-2p-2027'
const completedAt = new Date('2026-08-22T18:00:00.000Z')

describe('progreso de preparación', () => {
  it('completa y desmarca de forma inmutable e idempotente', () => {
    const original = emptyTripPreparation()
    const completed = setTaskCompleted(original, easyTent, 'flight', true, completedAt)
    expect(getTaskProgress(completed, easyTent, 'flight')).toEqual({ completed: true, completedAt: completedAt.toISOString() })
    expect(original).toEqual({ plans: {} })
    expect(setTaskCompleted(completed, easyTent, 'flight', true, new Date())).toBe(completed)
    expect(setTaskCompleted(completed, easyTent, 'flight', false)).toEqual({ plans: {} })
  })

  it('separa progreso por plan y lo conserva al cambiar y volver', () => {
    const easyProgress = setTaskCompleted(emptyTripPreparation(), easyTent, 'flight', true, completedAt)
    const both = setTaskCompleted(easyProgress, fullMadness, 'documentation', true, completedAt)
    expect(getTaskProgress(both, easyTent, 'flight')).not.toBeNull()
    expect(getTaskProgress(both, fullMadness, 'flight')).toBeNull()
    expect(getTaskProgress(both, fullMadness, 'documentation')).not.toBeNull()
  })

  it('preserva progreso válido aunque una tarea no sea aplicable actualmente', () => {
    const state = setTaskCompleted(emptyTripPreparation(), easyTent, 'external-accommodation', true, completedAt)
    expect(getTaskProgress(state, easyTent, 'external-accommodation')).not.toBeNull()
    expect(parseTripPreparation(serializeTripPreparation(state))).toEqual(state)
  })

  it('restablece solo el plan actual', () => {
    const first = setTaskCompleted(emptyTripPreparation(), easyTent, 'flight', true, completedAt)
    const both = setTaskCompleted(first, fullMadness, 'flight', true, completedAt)
    expect(resetPlanPreparation(both, easyTent)).toEqual({ plans: { [fullMadness]: both.plans[fullMadness] } })
  })

  it('ignora JSON corrupto, versiones desconocidas, IDs y tareas desconocidas', () => {
    expect(parseTripPreparation('{oops')).toEqual({ plans: {} })
    expect(parseTripPreparation(JSON.stringify({ version: 2, plans: { [easyTent]: {} } }))).toEqual({ plans: {} })
    const parsed = parseTripPreparation(JSON.stringify({ version: 1, plans: { 'invalid id': { flight: { completed: true, completedAt: completedAt.toISOString() } }, [easyTent]: { unknown: { completed: true, completedAt: completedAt.toISOString() }, flight: { completed: false }, documentation: { completed: true, completedAt: completedAt.toISOString() } } } }))
    expect(parsed).toEqual({ plans: { [easyTent]: { documentation: { completed: true, completedAt: completedAt.toISOString() } } } })
    expect(parseTripPreparation(JSON.stringify({ version: 1, plans: { [easyTent]: { flight: { completed: true, completedAt: 'tomorrow' } } } }))).toEqual({ plans: {} })
  })

  it('tolera localStorage bloqueado y sincroniza storage events', () => {
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    expect(readTripPreparation(blocked)).toEqual({ plans: {} })
    expect(persistTripPreparation(blocked, emptyTripPreparation())).toBe(false)
    const state = setTaskCompleted(emptyTripPreparation(), easyTent, 'flight', true, completedAt)
    expect(tripPreparationFromStorageChange(tripPreparationStorageKey, serializeTripPreparation(state))).toEqual(state)
    expect(tripPreparationFromStorageChange('other:key', null)).toBeNull()
  })

  it('registra, edita y elimina gasto sin cambiar completed', () => {
    const expenseOnly = setTaskExpense(emptyTripPreparation(), easyTent, 'flight', 365000, '2026-08-20', '2026-08-22')
    expect(getTaskProgress(expenseOnly, easyTent, 'flight')).toEqual({ actualExpense: { amount: 365000, currency: 'CLP', scope: 'PER_PERSON' }, purchasedAt: '2026-08-20' })
    const edited = setTaskExpense(expenseOnly, easyTent, 'flight', 372450, undefined, '2026-08-22')
    expect(getTaskProgress(edited, easyTent, 'flight')).toEqual({ actualExpense: { amount: 372450, currency: 'CLP', scope: 'PER_PERSON' } })
    expect(removeTaskExpense(edited, easyTent, 'flight')).toEqual({ plans: {} })
  })

  it('conserva gasto al completar y al volver a pendiente', () => {
    const expense = setTaskExpense(emptyTripPreparation(), easyTent, 'flight', 0)
    const completed = setTaskCompleted(expense, easyTent, 'flight', true, completedAt)
    expect(getTaskProgress(completed, easyTent, 'flight')?.actualExpense?.amount).toBe(0)
    const pending = setTaskCompleted(completed, easyTent, 'flight', false)
    expect(getTaskProgress(pending, easyTent, 'flight')).toEqual({ actualExpense: { amount: 0, currency: 'CLP', scope: 'PER_PERSON' } })
  })

  it('valida monto y fecha civil sin aceptar futuro ni fechas imposibles', () => {
    expect(isValidExpenseAmount(0)).toBe(true)
    expect(isValidExpenseAmount(-1)).toBe(false)
    expect(isValidExpenseAmount(1.5)).toBe(false)
    expect(isValidExpenseAmount(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isValidPurchasedAt('2026-02-28', '2026-08-22')).toBe(true)
    expect(isValidPurchasedAt('2026-02-31', '2026-08-22')).toBe(false)
    expect(isValidPurchasedAt('23/08/2026', '2026-08-22')).toBe(false)
    expect(isValidPurchasedAt('2026-08-23', '2026-08-22')).toBe(false)
  })

  it('migra V1 a V2 de forma determinista e idempotente preservando varios planes', () => {
    const v1 = JSON.stringify({ version: 1, plans: { [easyTent]: { flight: { completed: true, completedAt: completedAt.toISOString() } }, [fullMadness]: { documentation: { completed: true, completedAt: completedAt.toISOString() } } } })
    const migrated = parseTripPreparation(v1)
    expect(JSON.parse(serializeTripPreparation(migrated)).version).toBe(2)
    expect(parseTripPreparation(serializeTripPreparation(migrated))).toEqual(migrated)
    expect(Object.keys(migrated.plans)).toEqual([easyTent, fullMadness])
  })

  it('rechaza gastos con scope incorrecto, tareas sin tracking y versión futura', () => {
    const invalid = (taskId: string, scope: string) => JSON.stringify({ version: 2, plans: { [easyTent]: { [taskId]: { actualExpense: { amount: 10, currency: 'CLP', scope } } } } })
    expect(parseTripPreparation(invalid('flight', 'PER_GROUP'))).toEqual({ plans: {} })
    expect(parseTripPreparation(invalid('documentation', 'PER_GROUP'))).toEqual({ plans: {} })
    expect(parseTripPreparation(JSON.stringify({ version: 3, plans: {} }))).toEqual({ plans: {} })
  })
})
