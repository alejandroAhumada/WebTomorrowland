import { assertValidImportantEvent, type ImportantEvent } from '../src/models/importantEvent'

export function buildImportantEventSeedDocuments(events: readonly ImportantEvent[]): Map<string, Omit<ImportantEvent, 'id'>> {
  const documents = new Map<string, Omit<ImportantEvent, 'id'>>()
  for (const event of events) {
    assertValidImportantEvent(event)
    if (documents.has(event.id)) throw new Error(`El dataset contiene el ID duplicado ${event.id}.`)
    const { id, ...document } = event
    documents.set(id, document)
  }
  return documents
}
