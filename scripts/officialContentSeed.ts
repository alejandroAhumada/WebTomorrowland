import { assertValidTicketTier, type TicketTier } from '../src/models/ticketTier'
import { assertValidImportantInformation, type ImportantInformation } from '../src/models/importantInformation'

export function buildOfficialContentSeedDocuments(tiers: readonly TicketTier[], information: readonly ImportantInformation[]) {
  const ticketTiers = new Map<string, Omit<TicketTier, 'id'>>()
  const importantInformation = new Map<string, Omit<ImportantInformation, 'id'>>()
  for (const value of tiers) { assertValidTicketTier(value); if (ticketTiers.has(value.id)) throw new Error(`Tier duplicado: ${value.id}.`); const { id, ...document } = value; ticketTiers.set(id, document) }
  for (const value of information) { assertValidImportantInformation(value); if (importantInformation.has(value.id)) throw new Error(`Información duplicada: ${value.id}.`); const { id, ...document } = value; importantInformation.set(id, document) }
  return { ticketTiers, importantInformation }
}
