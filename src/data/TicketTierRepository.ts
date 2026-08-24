import type { TicketTier } from '../models/ticketTier'

export interface TicketTierRepository { getAll(): Promise<TicketTier[]> }
