import { initialTicketTiers } from './officialContent'
import type { TicketTierRepository } from './TicketTierRepository'

export class LocalTicketTierRepository implements TicketTierRepository {
  async getAll() { return structuredClone(initialTicketTiers) }
}
