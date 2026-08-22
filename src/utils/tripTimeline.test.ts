import { describe, expect, it } from 'vitest'
import { initialImportantEvents } from '../data/importantEvents'
import { productionPlans } from '../../scripts/productionPlans'
import type { ImportantEvent } from '../models/importantEvent'
import { buildTripTimeline, isEventRelevantForPlan } from './tripTimeline'

const globalJourney = productionPlans.find((plan) => plan.id === 'global-journey-hotel-2p-2027')!
const easyTent = productionPlans.find((plan) => plan.id === 'easy-tent-2p-2027')!
const vidaNova = productionPlans.find((plan) => plan.id === 'vida-nova-2p-2027')!
const fullMadness = productionPlans.find((plan) => plan.id === 'full-madness-1p-2027')!
const simulator = initialImportantEvents.find((event) => event.id === 'global-journey-simulator-2027')!
const journeySale = initialImportantEvents.find((event) => event.id === 'global-journey-sale-2027')!
const festival = initialImportantEvents.find((event) => event.id === 'tomorrowland-brasil-2027')!
const registration = initialImportantEvents.find((event) => event.id === 'pre-registration-2027')!

describe('trip timeline', () => {
  it('aplica ALL a cualquier plan y filtra categorías estructuradas', () => {
    expect(isEventRelevantForPlan(festival, globalJourney)).toBe(true)
    expect(isEventRelevantForPlan(simulator, globalJourney)).toBe(true)
    expect(isEventRelevantForPlan(simulator, easyTent)).toBe(false)
    expect(isEventRelevantForPlan(journeySale, vidaNova)).toBe(false)
    expect(isEventRelevantForPlan(journeySale, fullMadness)).toBe(false)
  })

  it('resuelve PLAN_IDS por coincidencia exacta', () => {
    const event: ImportantEvent = { ...festival, appliesTo: { scope: 'PLAN_IDS', planIds: [easyTent.id] } }
    expect(isEventRelevantForPlan(event, easyTent)).toBe(true)
    expect(isEventRelevantForPlan(event, fullMadness)).toBe(false)
  })

  it('construye una ruta cronológica sin mutar los eventos', () => {
    const input = [festival, simulator, registration]
    const snapshot = structuredClone(input)
    const timeline = buildTripTimeline(globalJourney, input, new Date('2026-09-01T12:00:00Z'))
    expect(timeline.entries.map(({ event }) => event.id)).toEqual([registration.id, simulator.id, festival.id])
    expect(input).toEqual(snapshot)
  })

  it('prioriza un evento activo por prioridad y luego el siguiente cronológico', () => {
    expect(buildTripTimeline(globalJourney, initialImportantEvents, new Date('2026-08-22T12:00:00Z')).primaryMilestone?.id).toBe(registration.id)
    expect(buildTripTimeline(globalJourney, initialImportantEvents, new Date('2026-09-24T14:00:00Z')).primaryMilestone?.id).toBe(festival.id)
  })

  it('mantiene la relevancia aunque el precio del plan esté pendiente', () => {
    expect(buildTripTimeline(globalJourney, initialImportantEvents, new Date('2026-09-01T12:00:00Z')).entries.some(({ event }) => event.id === simulator.id)).toBe(true)
  })

  it('resuelve empates activos por ID y maneja una lista vacía', () => {
    const tied = { ...registration, id: 'another-registration-2027' }
    expect(buildTripTimeline(globalJourney, [registration, tied], new Date('2026-08-22T12:00:00Z')).primaryMilestone?.id).toBe(tied.id)
    expect(buildTripTimeline(globalJourney, [], new Date()).primaryMilestone).toBeNull()
  })
})
