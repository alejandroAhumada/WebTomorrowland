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
})
