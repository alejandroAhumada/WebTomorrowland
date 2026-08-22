import { assertValidImportantEvent, type ImportantEvent } from '../models/importantEvent'
import type { ImportantEventRepository } from './ImportantEventRepository'
import { initialImportantEvents } from './importantEvents'

export class LocalImportantEventRepository implements ImportantEventRepository {
  async getAll(): Promise<ImportantEvent[]> { return initialImportantEvents.map(assertValidImportantEvent) }
}
