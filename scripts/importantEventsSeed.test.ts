import { describe, expect, it } from 'vitest'
import { initialImportantEvents } from '../src/data/importantEvents'
import { buildImportantEventSeedDocuments } from './importantEventsSeed'

describe('buildImportantEventSeedDocuments', () => {
  it('produce escrituras idempotentes con IDs estables', () => {
    const first = [...buildImportantEventSeedDocuments(initialImportantEvents)]
    const second = [...buildImportantEventSeedDocuments(initialImportantEvents)]
    expect(second).toEqual(first)
    expect(first).toHaveLength(initialImportantEvents.length)
  })

  it('rechaza IDs duplicados', () => {
    expect(() => buildImportantEventSeedDocuments([initialImportantEvents[0], initialImportantEvents[0]])).toThrow('duplicado')
  })

  it('preserva la aplicabilidad validada en cada documento', () => {
    const documents = buildImportantEventSeedDocuments(initialImportantEvents)
    expect(documents.get('global-journey-sale-2027')).toMatchObject({ appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: ['GLOBAL_JOURNEY'] } })
    expect(documents.get('tomorrowland-brasil-2027')).toMatchObject({ appliesTo: { scope: 'ALL' } })
  })
})
