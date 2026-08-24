import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { parseTravelPlan, type TravelPlan } from '../../src/models/plan.js'
import type { PlanSyncAudit, PlanHistory, PlanSyncState, PlanSyncStore, PlanSyncTransaction, StoredProposal } from './planSync.js'

export class FirestorePlanSyncStore implements PlanSyncStore {
  constructor(private readonly database: Firestore) {}

  runTransaction<T>(operation: (transaction: PlanSyncTransaction) => Promise<T>): Promise<T> {
    return this.database.runTransaction((firestoreTransaction) => operation(new FirestoreTransaction(this.database, firestoreTransaction)))
  }
}

class FirestoreTransaction implements PlanSyncTransaction {
  constructor(private readonly database: Firestore, private readonly transaction: Transaction) {}

  async getPlan(id: string): Promise<TravelPlan | null> {
    const snapshot = await this.transaction.get(this.database.collection('plans').doc(id))
    if (!snapshot.exists) return null
    return parseTravelPlan(id, snapshot.data())
  }

  async getProcessedProposal(id: string): Promise<StoredProposal | null> {
    const snapshot = await this.transaction.get(this.database.collection('planSyncProposals').doc(id))
    return snapshot.exists ? snapshot.data() as StoredProposal : null
  }

  async getPlanSyncState(planId: string): Promise<PlanSyncState | null> {
    const snapshot = await this.transaction.get(this.database.collection('planSyncState').doc(planId))
    return snapshot.exists ? snapshot.data() as PlanSyncState : null
  }

  setPlan(plan: TravelPlan): void {
    const { id, ...document } = plan
    this.transaction.set(this.database.collection('plans').doc(id), document)
  }

  setProcessedProposal(id: string, value: StoredProposal & { processedAt: string }): void {
    this.transaction.create(this.database.collection('planSyncProposals').doc(id), value)
  }

  setPlanSyncState(planId: string, value: PlanSyncState): void {
    this.transaction.set(this.database.collection('planSyncState').doc(planId), value)
  }

  setAudit(id: string, value: PlanSyncAudit): void {
    this.transaction.create(this.database.collection('syncRuns').doc(`tomorrowland_${id}`), value)
  }

  setHistory(planId: string, id: string, value: PlanHistory): void {
    this.transaction.create(this.database.collection('plans').doc(planId).collection('history').doc(id), value)
  }
}
