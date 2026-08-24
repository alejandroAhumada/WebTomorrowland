import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from './firebase'
import type { TicketTierRepository } from './TicketTierRepository'
import { assertValidTicketTier, type TicketTier } from '../models/ticketTier'

export class FirestoreTicketTierRepository implements TicketTierRepository {
  async getAll() {
    const snapshot = await getDocs(collection(getFirebaseDb(), 'ticketTiers'))
    return snapshot.docs.map((item) => assertValidTicketTier({ id: item.id, ...item.data() } as TicketTier))
      .sort((a, b) => a.id.localeCompare(b.id, 'es'))
  }
}
