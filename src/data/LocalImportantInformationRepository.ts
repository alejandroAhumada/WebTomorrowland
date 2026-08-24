import { initialImportantInformation } from './officialContent'
import type { ImportantInformationRepository } from './ImportantInformationRepository'

export class LocalImportantInformationRepository implements ImportantInformationRepository {
  async getAll() { return structuredClone(initialImportantInformation) }
}
