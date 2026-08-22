import { describe, expect, it } from 'vitest'
import { initialImportantEvents } from '../data/importantEvents'
import { assertValidImportantEvent, isOfficialTomorrowlandUrl, validateImportantEvent, type ImportantEvent } from './importantEvent'

const validEvent: ImportantEvent = initialImportantEvents[1]

describe('ImportantEvent', () => {
  it('valida el dataset oficial inicial completo', () => {
    expect(initialImportantEvents.map(assertValidImportantEvent)).toHaveLength(6)
  })

  it('requiere una fuente oficial identificada', () => {
    expect(validateImportantEvent({ ...validEvent, sourceName: '' })).toContain('El acontecimiento requiere una fuente oficial.')
  })

  it('acepta únicamente URLs HTTPS de hostnames oficiales exactos', () => {
    expect(isOfficialTomorrowlandUrl('https://brasil.tomorrowland.com/en/sales/sales-dates/')).toBe(true)
    expect(isOfficialTomorrowlandUrl('https://tomorrowland.com.evil.example/path')).toBe(false)
    expect(isOfficialTomorrowlandUrl('http://brasil.tomorrowland.com/path')).toBe(false)
  })

  it('rechaza rangos invertidos y fechas civiles imposibles', () => {
    expect(validateImportantEvent({ ...validEvent, startsAt: '2026-09-31' })).toContain('La fecha de inicio no es válida.')
    expect(validateImportantEvent({ ...validEvent, endsAt: '2026-09-01' })).toContain('La fecha de término no puede ser anterior al inicio.')
  })

  it('valida aplicabilidad estructurada', () => {
    expect(validateImportantEvent({ ...validEvent, appliesTo: { scope: 'ALL' } })).toEqual([])
    expect(validateImportantEvent({ ...validEvent, appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: ['GLOBAL_JOURNEY'] } })).toEqual([])
    expect(validateImportantEvent({ ...validEvent, appliesTo: { scope: 'PLAN_IDS', planIds: ['easy-tent-2p-2027'] } })).toEqual([])
    expect(validateImportantEvent({ ...validEvent, appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: [] } })).toContain('La aplicabilidad por categoría requiere categorías válidas.')
  })
})
