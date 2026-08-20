import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assertValidPlan } from '../src/models/plan'
import { productionPlans } from './productionPlans'
import { productionExchangeRates } from './productionExchangeRates'

const projectId = 'web-pack-tomorrowland'
const shouldWrite = process.argv.includes('--write')

const ids = productionPlans.map((plan) => plan.id)
if (new Set(ids).size !== ids.length) throw new Error('El dataset contiene IDs duplicados.')
productionPlans.forEach(assertValidPlan)

if (!shouldWrite) {
  console.log(`Dataset válido: ${productionPlans.length} planes. Usa npm run seed:firestore:write para escribirlos.`)
  console.table(productionPlans.map(({ id, travelerCount, totalPrice, priceType }) => ({ id, travelerCount, totalPrice: totalPrice?.amount ?? 'PENDING', currency: totalPrice?.currency ?? '-', priceType: priceType ?? 'PENDING' })))
  console.table(productionExchangeRates.map(({ id, rate, observedAt, sourceName }) => ({ id, rate, observedAt, sourceName })))
  process.exit(0)
}

if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const batch = db.batch()

for (const plan of productionPlans) {
  const { id, ...document } = plan
  batch.set(db.collection('plans').doc(id), document)
}
for (const exchangeRate of productionExchangeRates) {
  const { id, ...document } = exchangeRate
  batch.set(db.collection('exchangeRates').doc(id), document)
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

const storedRates = await Promise.all(productionExchangeRates.map((rate) => db.collection('exchangeRates').doc(rate.id).get()))
for (const document of storedRates) {
  if (!document.exists) throw new Error(`No se encontró la tasa ${document.id} después de escribir.`)
  const expected = productionExchangeRates.find((rate) => rate.id === document.id)!
  const stored = document.data()
  if (stored?.rate !== expected.rate || stored.fromCurrency !== expected.fromCurrency || stored.toCurrency !== expected.toCurrency) throw new Error(`La tasa almacenada ${document.id} no coincide con el dataset.`)
}
console.log(`Tasas actualizadas y verificadas: ${storedRates.map((document) => document.id).join(', ')}`)
