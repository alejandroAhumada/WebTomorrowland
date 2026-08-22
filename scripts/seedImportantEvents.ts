import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { isDeepStrictEqual } from 'node:util'
import { initialImportantEvents } from '../src/data/importantEvents'
import { assertValidImportantEvent } from '../src/models/importantEvent'
import { buildImportantEventSeedDocuments } from './importantEventsSeed'

const projectId = 'web-pack-tomorrowland'
const shouldWrite = process.argv.includes('--write')
const documents = buildImportantEventSeedDocuments(initialImportantEvents)

if (!shouldWrite) {
  console.log(`Important Events válidos: ${documents.size}. Usa npm run seed:events:write para escribirlos.`)
  console.table(initialImportantEvents.map(({ id, title, startsAt, endsAt, sourceName, appliesTo }) => ({ id, title, startsAt, endsAt: endsAt ?? '-', scope: appliesTo.scope, appliesTo: appliesTo.scope === 'PLAN_CATEGORIES' ? appliesTo.planCategories.join(',') : appliesTo.scope === 'PLAN_IDS' ? appliesTo.planIds.join(',') : 'Todos los planes', sourceName })))
  process.exit(0)
}

if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const batch = db.batch()
for (const [id, document] of documents) batch.set(db.collection('importantEvents').doc(id), document)
await batch.commit()

const stored = await Promise.all([...documents.keys()].map((id) => db.collection('importantEvents').doc(id).get()))
for (const snapshot of stored) {
  if (!snapshot.exists) throw new Error(`No se encontró ${snapshot.id} después de escribir.`)
  const parsed = assertValidImportantEvent({ ...(snapshot.data() as Omit<ReturnType<typeof assertValidImportantEvent>, 'id'>), id: snapshot.id })
  const expected = initialImportantEvents.find((event) => event.id === snapshot.id)
  if (!expected || !isDeepStrictEqual(parsed, expected)) throw new Error(`El documento ${snapshot.id} no coincide con el dataset validado.`)
}

console.log(`Important Events escritos y verificados: ${stored.length} documentos en projects/${projectId}/databases/(default)/documents/importantEvents`)
console.log(stored.map((document) => document.id).sort().join('\n'))
