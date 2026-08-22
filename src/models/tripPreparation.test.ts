import { describe, expect, it } from 'vitest'
import { emptyTripPreparation, getTaskProgress, parseTripPreparation, persistTripPreparation, readTripPreparation, resetPlanPreparation, serializeTripPreparation, setTaskCompleted, tripPreparationFromStorageChange, tripPreparationStorageKey } from './tripPreparation'

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
})
