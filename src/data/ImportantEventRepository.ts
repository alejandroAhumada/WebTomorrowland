import type { ImportantEvent } from '../models/importantEvent'

export interface ImportantEventRepository {
  getAll(): Promise<ImportantEvent[]>
}
