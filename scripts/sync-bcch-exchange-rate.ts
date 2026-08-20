import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { assertValidExchangeRate, type ExchangeRate } from '../src/models/exchangeRate'
import {
  BCCH_SERIES, BCCH_SOAP_ENDPOINT, BCCH_SOURCE_NAME, EXCHANGE_RATE_ID, buildExchangeRate,
  buildGetSeriesSoapRequest, dateWindow, decideSync, firebaseAuthMode, parseBcchSoapResponse, readSyncConfig,
  selectLatestObservation, extractBcchPublicDiagnostics, type BcchObservation, type SyncResult,
} from './bcchExchangeRateSync'

const projectId = 'web-pack-tomorrowland'
const startedAt = new Date().toISOString()
let db: Firestore | undefined
let fetchedObservation: BcchObservation | undefined

try {
  const config = readSyncConfig(process.env)
  db = initializeFirestore()
  const window = dateWindow(new Date())
  const response = await fetch(BCCH_SOAP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://bancocentral.org/GetSeries"' },
    body: buildGetSeriesSoapRequest(config, window.firstDate, window.lastDate),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`La API BCCh respondió HTTP ${response.status}.`)
  const responseXml = await response.text()
  if (process.env.BCCH_DIAGNOSTIC === 'true') {
    const diagnostics = extractBcchPublicDiagnostics(responseXml).slice(-3)
    console.log(`BCCh public response shape: ${JSON.stringify(diagnostics)}`)
  }
  const fetched = selectLatestObservation(parseBcchSoapResponse(responseXml), new Date())
  fetchedObservation = fetched
  const outcome = await persistSync(db, fetched)
  console.log(`BCCH FX sync: ${outcome.result}`)
  console.log(`Observed: ${fetched.observedAt}`)
  console.log(`BRL_CLP: ${outcome.previousRate ?? 'none'} → ${fetched.rate}`)
} catch (error) {
  const message = sanitizeError(error)
  if (db) {
    try { await writeFailedAudit(db, message, fetchedObservation) } catch { console.error('No fue posible registrar la auditoría FAILED en Firestore.') }
  }
  console.error(`BCCH FX sync: FAILED · ${message}`)
  process.exitCode = 1
}

function initializeFirestore(): Firestore {
  if (getApps().length === 0) {
    const mode = firebaseAuthMode(process.env)
    if (mode === 'SERVICE_ACCOUNT') {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC!
      let parsed: object
      try { parsed = JSON.parse(serviceAccount) as object } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC no contiene JSON válido.') }
      initializeApp({ credential: cert(parsed), projectId })
    } else {
      initializeApp({ credential: applicationDefault(), projectId })
    }
  }
  return getFirestore()
}

async function persistSync(database: Firestore, fetched: BcchObservation): Promise<{ result: SyncResult; previousRate: number | null }> {
  const rateRef = database.collection('exchangeRates').doc(EXCHANGE_RATE_ID)
  const auditRef = database.collection('syncRuns').doc()
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateRef)
    const current = snapshot.exists ? assertValidExchangeRate({ ...(snapshot.data() as Omit<ExchangeRate, 'id'>), id: snapshot.id }) : null
    const decision = decideSync(current, fetched)
    const completedAt = new Date().toISOString()
    if (decision.shouldWrite) {
      const rate = assertValidExchangeRate(buildExchangeRate(fetched, completedAt))
      transaction.set(rateRef, {
        fromCurrency: rate.fromCurrency, toCurrency: rate.toCurrency, rate: rate.rate,
        sourceName: rate.sourceName, sourceUrl: rate.sourceUrl, sourceSeries: rate.sourceSeries,
        observedAt: rate.observedAt, fetchedAt: rate.fetchedAt, updatedAt: rate.updatedAt,
      })
    }
    transaction.set(auditRef, auditDocument(decision.result, completedAt, fetched, current?.rate ?? null))
    return { result: decision.result, previousRate: current?.rate ?? null }
  })
}

function auditDocument(result: SyncResult | 'FAILED', completedAt: string, fetched?: BcchObservation, previousRate: number | null = null, error?: string) {
  return {
    jobType: 'BCCH_EXCHANGE_RATE_SYNC', source: BCCH_SOURCE_NAME, series: BCCH_SERIES,
    startedAt, completedAt, observedAt: fetched?.observedAt ?? null, previousRate,
    fetchedRate: fetched?.rate ?? null, result, documentPath: `exchangeRates/${EXCHANGE_RATE_ID}`,
    error: error ?? null,
  }
}

async function writeFailedAudit(database: Firestore, error: string, fetched?: BcchObservation) {
  const completedAt = new Date().toISOString()
  await database.collection('syncRuns').add(auditDocument('FAILED', completedAt, fetched, null, error))
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Error inesperado.'
  const secrets = [process.env.BCCH_API_USER, process.env.BCCH_API_PASSWORD, process.env.FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC].filter(Boolean) as string[]
  return secrets.reduce((message, secret) => message.replaceAll(secret, '[REDACTED]'), raw).slice(0, 500)
}
