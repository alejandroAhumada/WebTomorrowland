import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { isDeepStrictEqual } from 'node:util'
import { initialImportantInformation, initialTicketTiers } from '../src/data/officialContent'
import { assertValidImportantInformation, type ImportantInformation } from '../src/models/importantInformation'
import { assertValidTicketTier, type TicketTier } from '../src/models/ticketTier'
import { buildOfficialContentSeedDocuments } from './officialContentSeed'

const projectId = 'web-pack-tomorrowland'; const shouldWrite = process.argv.includes('--write')
const groups = buildOfficialContentSeedDocuments(initialTicketTiers, initialImportantInformation)
if (!shouldWrite) {
  console.log(`Contenido oficial válido: ${groups.ticketTiers.size} tiers y ${groups.importantInformation.size} informaciones. Usa npm run seed:official-content:write para escribir.`)
  console.table(initialTicketTiers.map((tier) => ({ id: tier.id, ofertas: tier.offerings.length, preciosOficiales: tier.offerings.filter((item) => item.totalPrice).length, fuente: tier.sourceUrl })))
  console.table(initialImportantInformation.map((item) => ({ id: item.id, categoria: item.category, evento: item.relatedEventId ?? '-', fuente: item.sourceUrl })))
  process.exit(0)
}
if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore(); const batch = db.batch()
for (const [id, document] of groups.ticketTiers) batch.set(db.collection('ticketTiers').doc(id), document)
for (const [id, document] of groups.importantInformation) batch.set(db.collection('importantInformation').doc(id), document)
await batch.commit()
for (const [collectionName, entries] of [['ticketTiers', groups.ticketTiers], ['importantInformation', groups.importantInformation]] as const) {
  for (const [id] of entries) {
    const snapshot = await db.collection(collectionName).doc(id).get()
    if (!snapshot.exists) throw new Error(`No se encontró ${collectionName}/${id}.`)
    const actual = collectionName === 'ticketTiers' ? assertValidTicketTier({ id, ...snapshot.data() } as TicketTier) : assertValidImportantInformation({ id, ...snapshot.data() } as ImportantInformation)
    const expected = collectionName === 'ticketTiers' ? initialTicketTiers.find((value) => value.id === id) : initialImportantInformation.find((value) => value.id === id)
    if (!isDeepStrictEqual(actual, expected)) throw new Error(`${collectionName}/${id} no coincide con el dataset validado.`)
  }
}
console.log(`Contenido oficial escrito y verificado en ${projectId}: ${groups.ticketTiers.size + groups.importantInformation.size} documentos.`)
