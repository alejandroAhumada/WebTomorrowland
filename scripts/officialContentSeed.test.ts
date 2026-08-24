import { describe, expect, it } from 'vitest'
import { initialImportantInformation, initialTicketTiers } from '../src/data/officialContent'
import { buildOfficialContentSeedDocuments } from './officialContentSeed'

describe('official content seed', () => {
  it('es validado, estable y no elimina documentos desconocidos', () => { const result=buildOfficialContentSeedDocuments(initialTicketTiers,initialImportantInformation); expect(result.ticketTiers.size).toBe(3); expect(result.importantInformation.size).toBe(5); expect(result.ticketTiers.get('comfort')).not.toHaveProperty('id') })
  it('rechaza IDs duplicados', () => expect(()=>buildOfficialContentSeedDocuments([...initialTicketTiers,initialTicketTiers[0]],initialImportantInformation)).toThrow(/duplicado/))
})
