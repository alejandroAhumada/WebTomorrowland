import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { assertValidTicketTier, type TicketTier } from '../../src/models/ticketTier.js'
import { assertValidImportantInformation, type ImportantInformation } from '../../src/models/importantInformation.js'
import type { ContentSyncStore, ContentSyncTransaction, OfficialContentDocument, OfficialContentType, StoredContentProposal } from './contentSync.js'

export class FirestoreContentSyncStore implements ContentSyncStore {
  constructor(private readonly database: Firestore) {}
  runTransaction<T>(operation: (transaction: ContentSyncTransaction) => Promise<T>): Promise<T> { return this.database.runTransaction((transaction) => operation(new FirestoreContentSyncTransaction(this.database, transaction))) }
}
class FirestoreContentSyncTransaction implements ContentSyncTransaction {
  constructor(private readonly database: Firestore, private readonly transaction: Transaction) {}
  private collection(type: OfficialContentType) { return this.database.collection(type === 'TICKET_TIER' ? 'ticketTiers' : 'importantInformation') }
  async getDocument(type: OfficialContentType, id: string) { const snapshot = await this.transaction.get(this.collection(type).doc(id)); if (!snapshot.exists) return null; const value = { id, ...snapshot.data() }; return type === 'TICKET_TIER' ? assertValidTicketTier(value as TicketTier) : assertValidImportantInformation(value as ImportantInformation) }
  async getProposal(id: string) { const snapshot = await this.transaction.get(this.database.collection('contentSyncProposals').doc(id)); return snapshot.exists ? snapshot.data() as StoredContentProposal : null }
  async getLatestObservedAt(key: string) { const snapshot = await this.transaction.get(this.database.collection('contentSyncState').doc(key)); return snapshot.exists ? String(snapshot.data()?.latestObservedAt ?? '') : null }
  setDocument(type: OfficialContentType, value: OfficialContentDocument) { const { id, ...document } = value; this.transaction.set(this.collection(type).doc(id), document) }
  setProposal(id: string, value: StoredContentProposal & { processedAt: string }) { this.transaction.create(this.database.collection('contentSyncProposals').doc(id), value) }
  setState(key: string, value: Record<string, unknown>) { this.transaction.set(this.database.collection('contentSyncState').doc(key), value) }
  setAudit(id: string, value: Record<string, unknown>) { this.transaction.create(this.database.collection('syncRuns').doc(`tomorrowland_content_${id}`), value) }
  setHistory(type: OfficialContentType, documentId: string, id: string, value: Record<string, unknown>) { this.transaction.create(this.collection(type).doc(documentId).collection('history').doc(id), value) }
}
