import { collection, documentId, getDocs, query, where } from 'firebase/firestore'
import { parseTravelPlan, type TravelPlan } from '../models/plan'
import type { PlanRepository } from './PlanRepository'
import { getFirebaseDb } from './firebase'
export function parsePlan(id: string, data: unknown): TravelPlan { return parseTravelPlan(id, data) }
export class FirestorePlanRepository implements PlanRepository {
  private plans() { return collection(getFirebaseDb(), 'plans') }
  async getAll(): Promise<TravelPlan[]> { const snapshot = await getDocs(this.plans()); return snapshot.docs.map((doc) => parsePlan(doc.id, doc.data())) }
  async getByTravelerCount(travelerCount: 1 | 2): Promise<TravelPlan[]> { const snapshot = await getDocs(query(this.plans(), where('travelerCount', '==', travelerCount))); return snapshot.docs.map((doc) => parsePlan(doc.id, doc.data())) }
  async getByIds(ids: string[]): Promise<TravelPlan[]> {
    if (ids.length === 0) return []
    const batches = Array.from({ length: Math.ceil(ids.length / 30) }, (_, index) => ids.slice(index * 30, index * 30 + 30))
    const snapshots = await Promise.all(batches.map((batch) => getDocs(query(this.plans(), where(documentId(), 'in', batch)))))
    const plans = snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => parsePlan(doc.id, doc.data())))
    const order = new Map(ids.map((id, index) => [id, index])); return plans.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }
}
