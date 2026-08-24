import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from './firebase'
import type { ImportantInformationRepository } from './ImportantInformationRepository'
import { assertValidImportantInformation, type ImportantInformation } from '../models/importantInformation'

export class FirestoreImportantInformationRepository implements ImportantInformationRepository {
  async getAll() {
    const snapshot = await getDocs(collection(getFirebaseDb(), 'importantInformation'))
    return snapshot.docs.map((item) => assertValidImportantInformation({ id: item.id, ...item.data() } as ImportantInformation))
      .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, 'es'))
  }
}
