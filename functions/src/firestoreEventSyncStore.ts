import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { assertValidImportantEvent, type ImportantEvent } from '../../src/models/importantEvent.js'
import type { EventHistory, EventSyncAudit, EventSyncState, EventSyncStore, EventSyncTransaction, StoredEventProposal } from './eventSync.js'

export class FirestoreEventSyncStore implements EventSyncStore {
  constructor(private readonly database: Firestore) {}
  runTransaction<T>(operation: (transaction: EventSyncTransaction) => Promise<T>): Promise<T> {
    return this.database.runTransaction((transaction) => operation(new FirestoreEventTransaction(this.database, transaction)))
  }
}

class FirestoreEventTransaction implements EventSyncTransaction {
  constructor(private readonly database: Firestore, private readonly transaction: Transaction) {}
  async getEvent(id: string): Promise<ImportantEvent | null> { const snapshot = await this.transaction.get(this.database.collection('importantEvents').doc(id)); return snapshot.exists ? assertValidImportantEvent({ ...(snapshot.data() as Omit<ImportantEvent, 'id'>), id }) : null }
  async findEventByTitle(title: string): Promise<ImportantEvent | null> { const snapshot = await this.transaction.get(this.database.collection('importantEvents').where('title', '==', title).limit(1)); const document = snapshot.docs[0]; return document ? assertValidImportantEvent({ ...(document.data() as Omit<ImportantEvent, 'id'>), id: document.id }) : null }
  async getProcessedProposal(id: string): Promise<StoredEventProposal | null> { const snapshot = await this.transaction.get(this.database.collection('eventSyncProposals').doc(id)); return snapshot.exists ? snapshot.data() as StoredEventProposal : null }
  async getEventSyncState(eventId: string): Promise<EventSyncState | null> { const snapshot = await this.transaction.get(this.database.collection('eventSyncState').doc(eventId)); return snapshot.exists ? snapshot.data() as EventSyncState : null }
  setEvent(event: ImportantEvent): void { const { id, ...document } = event; this.transaction.set(this.database.collection('importantEvents').doc(id), document) }
  setProcessedProposal(id: string, value: StoredEventProposal & { processedAt: string }): void { this.transaction.create(this.database.collection('eventSyncProposals').doc(id), value) }
  setEventSyncState(eventId: string, value: EventSyncState): void { this.transaction.set(this.database.collection('eventSyncState').doc(eventId), value) }
  setAudit(id: string, value: EventSyncAudit): void { this.transaction.create(this.database.collection('syncRuns').doc(`tomorrowland_event_${id}`), value) }
  setHistory(eventId: string, id: string, value: EventHistory): void { this.transaction.create(this.database.collection('importantEvents').doc(eventId).collection('history').doc(id), value) }
}
