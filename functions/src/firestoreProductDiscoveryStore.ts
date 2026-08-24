import type { Firestore, Transaction } from 'firebase-admin/firestore'
import type {
  DetectedProductCandidate, ProductDiscoverySourceState, ProductDiscoveryStore, ProductDiscoveryTransaction,
  StoredDiscoveryProposal,
} from './productDiscoverySync.js'

export class FirestoreProductDiscoveryStore implements ProductDiscoveryStore {
  constructor(private readonly database: Firestore) {}
  runTransaction<T>(operation: (transaction: ProductDiscoveryTransaction) => Promise<T>): Promise<T> {
    return this.database.runTransaction((transaction) => operation(new FirestoreDiscoveryTransaction(this.database, transaction)))
  }
}

class FirestoreDiscoveryTransaction implements ProductDiscoveryTransaction {
  constructor(private readonly database: Firestore, private readonly transaction: Transaction) {}
  async getProcessedProposal(id: string): Promise<StoredDiscoveryProposal | null> {
    const snapshot = await this.transaction.get(this.database.collection('productDiscoveryProposals').doc(id))
    return snapshot.exists ? snapshot.data() as StoredDiscoveryProposal : null
  }
  async getSourceState(sourceId: string): Promise<ProductDiscoverySourceState | null> {
    const snapshot = await this.transaction.get(this.database.collection('productDiscoveryState').doc(sourceId))
    return snapshot.exists ? snapshot.data() as ProductDiscoverySourceState : null
  }
  async getCandidate(id: string): Promise<DetectedProductCandidate | null> {
    const snapshot = await this.transaction.get(this.database.collection('detectedProductCandidates').doc(id))
    return snapshot.exists ? snapshot.data() as DetectedProductCandidate : null
  }
  setCandidate(id: string, candidate: DetectedProductCandidate): void {
    this.transaction.set(this.database.collection('detectedProductCandidates').doc(id), candidate)
  }
  setObservation(candidateId: string, evidenceHash: string, observation: Parameters<ProductDiscoveryTransaction['setObservation']>[2]): void {
    this.transaction.set(this.database.collection('detectedProductCandidates').doc(candidateId).collection('observations').doc(evidenceHash), observation)
  }
  setSourceState(sourceId: string, state: ProductDiscoverySourceState): void {
    this.transaction.set(this.database.collection('productDiscoveryState').doc(sourceId), state)
  }
  setProcessedProposal(id: string, value: StoredDiscoveryProposal & { processedAt: string }): void {
    this.transaction.create(this.database.collection('productDiscoveryProposals').doc(id), value)
  }
  setAudit(id: string, audit: Record<string, unknown>): void {
    this.transaction.create(this.database.collection('syncRuns').doc(`product_discovery_${id}`), audit)
  }
}
