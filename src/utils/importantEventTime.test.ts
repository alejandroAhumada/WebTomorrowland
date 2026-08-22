import { describe, expect, it } from 'vitest'
import { initialImportantEvents } from '../data/importantEvents'
import type { ImportantEvent } from '../models/importantEvent'
import { formatImportantEventDate, getDaysUntilEvent, getImportantEventState, getNextImportantEvent, sortImportantEvents } from './importantEventTime'

const simulator = initialImportantEvents.find((event) => event.id === 'global-journey-simulator-2027')!
const registration = initialImportantEvents.find((event) => event.id === 'pre-registration-2027')!
const festival = initialImportantEvents.find((event) => event.id === 'tomorrowland-brasil-2027')!

describe('Important Event time utilities', () => {
  it('ordena los acontecimientos cronológicamente sin mutar el origen', () => {
    const events = [festival, simulator, registration]
    const sorted = sortImportantEvents(events)
    expect(sorted.map(({ id }) => id)).toEqual([registration.id, simulator.id, festival.id])
    expect(events.map(({ id }) => id)).toEqual([festival.id, simulator.id, registration.id])
  })

  it('deriva UPCOMING antes del acontecimiento', () => {
    expect(getImportantEventState(simulator, new Date('2026-09-02T12:00:00Z'))).toBe('UPCOMING')
  })

  it('deriva TODAY durante el día local del acontecimiento con hora', () => {
    expect(getImportantEventState(simulator, new Date('2026-09-03T14:00:00Z'))).toBe('TODAY')
  })

  it('deriva PAST después del día local del acontecimiento', () => {
    expect(getImportantEventState(simulator, new Date('2026-09-04T03:01:00Z'))).toBe('PAST')
  })

  it('mantiene TODAY durante un evento con rango', () => {
    expect(getImportantEventState(registration, new Date('2026-08-22T12:00:00Z'))).toBe('TODAY')
    expect(getImportantEventState(festival, new Date('2027-05-01T15:00:00Z'))).toBe('TODAY')
  })

  it('prioriza un evento en curso como próximo hito', () => {
    expect(getNextImportantEvent([simulator, registration], new Date('2026-08-22T12:00:00Z'))?.id).toBe(registration.id)
  })

  it('cambia automáticamente al siguiente hito cuando termina el anterior', () => {
    expect(getNextImportantEvent([registration, simulator], new Date('2026-09-24T12:00:00Z'))).toBeNull()
    const journeySale = initialImportantEvents.find((event) => event.id === 'global-journey-sale-2027')!
    expect(getNextImportantEvent([simulator, journeySale], new Date('2026-09-04T12:00:00Z'))?.id).toBe(journeySale.id)
  })

  it('calcula días restantes desde fechas civiles de Brasil', () => {
    expect(getDaysUntilEvent(simulator, new Date('2026-08-22T15:00:00Z'))).toBe(12)
  })

  it('preserva la fecha civil sin desplazamientos de timezone', () => {
    expect(formatImportantEventDate(festival)).toContain('30 abr 2027')
    expect(formatImportantEventDate(festival)).toContain('02 may 2027')
  })

  it('formatea un acontecimiento con hora inequívoca de Brasil', () => {
    expect(formatImportantEventDate(simulator)).toContain('10:00 hora de Brasil')
  })

  it('maneja una lista vacía', () => {
    expect(sortImportantEvents([])).toEqual([])
    expect(getNextImportantEvent([])).toBeNull()
  })

  it('desempata eventos simultáneos por prioridad', () => {
    const lower: ImportantEvent = { ...simulator, id: 'lower', title: 'Menor prioridad', priority: 1 }
    expect(sortImportantEvents([lower, simulator])[0].id).toBe(simulator.id)
  })
})
