import { collection, getDocs } from 'firebase/firestore'
import { assertValidImportantEvent, type ImportantEvent } from '../models/importantEvent'
import type { ImportantEventRepository } from './ImportantEventRepository'
import { getFirebaseDb } from './firebase'

function parseImportantEvent(id: string, data: unknown): ImportantEvent {
  return assertValidImportantEvent({ ...(data as Omit<ImportantEvent, 'id'>), id })
}

export class FirestoreImportantEventRepository implements ImportantEventRepository {
  async getAll(): Promise<ImportantEvent[]> {
    const snapshot = await getDocs(collection(getFirebaseDb(), 'importantEvents'))
    return snapshot.docs.map((document) => parseImportantEvent(document.id, document.data()))
  }
}
