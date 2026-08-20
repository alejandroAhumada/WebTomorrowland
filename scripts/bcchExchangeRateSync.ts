import type { ExchangeRate } from '../src/models/exchangeRate'

export const BCCH_SERIES = 'F072.CLP.BRL.N.O.D'
export const BCCH_SOURCE_NAME = 'Banco Central de Chile'
export const BCCH_SOAP_ENDPOINT = 'https://si3.bcentral.cl/SieteWS/SieteWS.asmx'
export const BCCH_SOURCE_URL = 'https://si3.bcentral.cl/siete/ES/Siete/Canasta?idCanasta=AVWIR1123'
export const EXCHANGE_RATE_ID = 'BRL_CLP'
export const MAX_OBSERVATION_AGE_DAYS = 14

export interface BcchObservation { series: string; observedAt: string; rate: number }
export type SyncResult = 'UPDATED' | 'NO_CHANGE' | 'CORRECTION' | 'STALE_SOURCE'

export interface SyncDecision {
  result: SyncResult
  shouldWrite: boolean
}

export interface SyncConfig {
  bcchUser: string
  bcchPassword: string
}

export type FirebaseAuthMode = 'SERVICE_ACCOUNT' | 'APPLICATION_DEFAULT'

export function readSyncConfig(environment: NodeJS.ProcessEnv): SyncConfig {
  const bcchUser = environment.BCCH_API_USER?.trim()
  const bcchPassword = environment.BCCH_API_PASSWORD?.trim()
  const missing = [!bcchUser && 'BCCH_API_USER', !bcchPassword && 'BCCH_API_PASSWORD'].filter(Boolean)
  if (missing.length) throw new Error(`Falta configuración requerida: ${missing.join(', ')}.`)
  return { bcchUser: bcchUser!, bcchPassword: bcchPassword! }
}

export function firebaseAuthMode(environment: NodeJS.ProcessEnv): FirebaseAuthMode {
  if (environment.FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC?.trim()) return 'SERVICE_ACCOUNT'
  if (environment.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return 'APPLICATION_DEFAULT'
  throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC o Application Default Credentials.')
}

export function buildGetSeriesSoapRequest(config: SyncConfig, firstDate: string, lastDate: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetSeries xmlns="http://bancocentral.org/">
      <user>${escapeXml(config.bcchUser)}</user>
      <password>${escapeXml(config.bcchPassword)}</password>
      <firstDate>${firstDate}</firstDate>
      <lastDate>${lastDate}</lastDate>
      <seriesIds><string>${BCCH_SERIES}</string></seriesIds>
    </GetSeries>
  </soap:Body>
</soap:Envelope>`
}

export function parseBcchSoapResponse(xml: string): BcchObservation[] {
  if (!xml.trim() || !/<(?:\w+:)?GetSeriesResponse\b/.test(xml)) throw new Error('Respuesta BCCh inválida.')
  const code = Number(readTag(xml, 'Codigo'))
  if (!Number.isInteger(code) || code !== 0) throw new Error('La API BCCh rechazó la consulta.')
  const seriesBlocks = readTags(xml, 'fameSeries')
  if (seriesBlocks.length !== 1) throw new Error('La respuesta BCCh no contiene exactamente una serie.')
  const series = readTag(seriesBlocks[0], 'seriesId')
  if (series !== BCCH_SERIES) throw new Error('La API BCCh respondió con una serie inesperada.')

  const observations = readTags(seriesBlocks[0], 'obs').map((block) => ({
    series,
    observedAt: normalizeDate(readTag(block, 'indexDateString')),
    rate: parseBcchDecimal(readTag(block, 'value')),
  }))
  if (observations.length === 0) throw new Error('La API BCCh no entregó observaciones.')
  return observations
}

export function parseBcchDecimal(value: string): number {
  const normalized = value.trim().includes(',') ? value.trim().replace(/\./g, '').replace(',', '.') : value.trim()
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10_000) throw new Error('La API BCCh entregó una tasa inválida.')
  return parsed
}

export function selectLatestObservation(observations: BcchObservation[], now: Date): BcchObservation {
  if (observations.some((item) => item.series !== BCCH_SERIES)) throw new Error('Las observaciones contienen una serie inesperada.')
  const sorted = [...observations].sort((left, right) => right.observedAt.localeCompare(left.observedAt))
  const latest = sorted[0]
  if (!latest || !isIsoDate(latest.observedAt)) throw new Error('No existe una observación BCCh válida.')
  parseBcchDecimal(String(latest.rate))
  const ageDays = Math.floor((startOfUtcDay(now).getTime() - new Date(`${latest.observedAt}T00:00:00Z`).getTime()) / 86_400_000)
  if (ageDays < 0 || ageDays > MAX_OBSERVATION_AGE_DAYS) throw new Error('La observación BCCh está fuera de la ventana de vigencia.')
  return latest
}

export function decideSync(current: ExchangeRate | null, fetched: BcchObservation): SyncDecision {
  if (!current) return { result: 'UPDATED', shouldWrite: true }
  if (fetched.observedAt < current.observedAt) return { result: 'STALE_SOURCE', shouldWrite: false }
  if (fetched.observedAt > current.observedAt) return { result: 'UPDATED', shouldWrite: true }
  if (fetched.rate === current.rate) return { result: 'NO_CHANGE', shouldWrite: false }
  return { result: 'CORRECTION', shouldWrite: true }
}

export function buildExchangeRate(observation: BcchObservation, timestamp: string): ExchangeRate {
  if (observation.series !== BCCH_SERIES) throw new Error('No se puede construir una tasa desde otra serie.')
  parseBcchDecimal(String(observation.rate))
  if (!isIsoDate(observation.observedAt)) throw new Error('La fecha de observación no es válida.')
  return {
    id: EXCHANGE_RATE_ID,
    fromCurrency: 'BRL',
    toCurrency: 'CLP',
    rate: observation.rate,
    sourceName: BCCH_SOURCE_NAME,
    sourceUrl: BCCH_SOURCE_URL,
    sourceSeries: BCCH_SERIES,
    observedAt: observation.observedAt,
    fetchedAt: timestamp,
    updatedAt: timestamp,
  }
}

export function dateWindow(now: Date): { firstDate: string; lastDate: string } {
  const last = startOfUtcDay(now)
  const first = new Date(last)
  first.setUTCDate(first.getUTCDate() - MAX_OBSERVATION_AGE_DAYS)
  return { firstDate: first.toISOString().slice(0, 10), lastDate: last.toISOString().slice(0, 10) }
}

function normalizeDate(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match || !isIsoDate(match[0])) throw new Error('La API BCCh entregó una fecha inválida.')
  return match[0]
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function readTag(xml: string, name: string): string {
  const values = readTags(xml, name)
  if (values.length === 0) throw new Error('Respuesta BCCh incompleta.')
  return decodeXml(values[0]).trim()
}

function readTags(xml: string, name: string): string[] {
  const expression = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, 'gi')
  return [...xml.matchAll(expression)].map((match) => match[1])
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}
