import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assertValidPlan } from '../src/models/plan'
import { productionPlans } from './productionPlans'

const projectId = 'web-pack-tomorrowland'
const shouldWrite = process.argv.includes('--write')

const ids = productionPlans.map((plan) => plan.id)
if (new Set(ids).size !== ids.length) throw new Error('El dataset contiene IDs duplicados.')
productionPlans.forEach(assertValidPlan)

if (!shouldWrite) {
  console.log(`Dataset válido: ${productionPlans.length} planes. Usa npm run seed:firestore:write para escribirlos.`)
  console.table(productionPlans.map(({ id, travelerCount, totalPrice, priceType }) => ({ id, travelerCount, totalPrice: totalPrice?.amount ?? 'PENDING', currency: totalPrice?.currency ?? '-', priceType: priceType ?? 'PENDING' })))
  process.exit(0)
}

if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const batch = db.batch()

for (const plan of productionPlans) {
  const { id, ...document } = plan
  batch.set(db.collection('plans').doc(id), document)
}

await batch.commit()

const snapshot = await db.collection('plans').get()
const storedIds = snapshot.docs.map((document) => document.id).sort()
const expectedIds = [...ids].sort()
if (JSON.stringify(storedIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`Firestore no coincide con el dataset. Esperados: ${expectedIds.join(', ')}. Encontrados: ${storedIds.join(', ')}`)
}

console.log(`Firestore actualizado y verificado: ${storedIds.length} documentos en projects/${projectId}/databases/(default)/documents/plans`)
console.log(storedIds.join('\n'))
