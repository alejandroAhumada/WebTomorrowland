import { describe, expect, it } from 'vitest'
import type { ExchangeRate } from '../src/models/exchangeRate'
import {
  BCCH_SERIES, buildExchangeRate, buildGetSeriesSoapRequest, dateWindow, decideSync, parseBcchDecimal,
  extractBcchPublicDiagnostics, firebaseAuthMode, parseBcchSoapResponse, readSyncConfig, selectLatestObservation, type BcchObservation,
} from './bcchExchangeRateSync'

const response = (observations: Array<{ date: string; value: string; status?: string }>, series = BCCH_SERIES) => `
<soap:Envelope><soap:Body><GetSeriesResponse><GetSeriesResult><Codigo>0</Codigo><Series><fameSeries>
<seriesKey><seriesId>${series}</seriesId></seriesKey>
${observations.map(({ date, value, status = 'OK' }) => `<obs><indexDateString>${date}</indexDateString><seriesKey><seriesId>${series}</seriesId></seriesKey><statusCode>${status}</statusCode><value>${value}</value></obs>`).join('')}
</fameSeries></Series></GetSeriesResult></GetSeriesResponse></soap:Body></soap:Envelope>`

const observation = (observedAt: string, rate = 178.01): BcchObservation => ({ series: BCCH_SERIES, observedAt, rate })
const current = (observedAt: string, rate = 178.01): ExchangeRate => buildExchangeRate(observation(observedAt, rate), '2026-08-20T20:00:00.000Z')

describe('BCCh BDE', () => {
  it('parsea la respuesta SOAP y la serie exacta', () => {
    expect(parseBcchSoapResponse(response([{ date: '2026-08-20', value: '178.01' }]))).toEqual([observation('2026-08-20')])
  })
  it('normaliza el formato real BCCh dd-MM-yyyy sin depender del timezone', () => {
    const parsed = parseBcchSoapResponse(response([{ date: '20-08-2026', value: '178.01' }]))
    expect(parsed[0].observedAt).toBe('2026-08-20')
  })
  it('parsea la respuesta SOAP real con días ND y selecciona el último valor OK', () => {
    const parsed = parseBcchSoapResponse(response([
      { date: '14-08-2026', value: '175.95' },
      { date: '15-08-2026', value: 'NaN', status: 'ND' },
      { date: '16-08-2026', value: 'NaN', status: 'ND' },
      { date: '17-08-2026', value: '174.73' },
      { date: '20-08-2026', value: '178.01' },
    ]))
    expect(parsed).toEqual([
      observation('2026-08-14', 175.95),
      observation('2026-08-17', 174.73),
      observation('2026-08-20', 178.01),
    ])
    expect(selectLatestObservation(parsed, new Date('2026-08-20T23:30:00-03:00'))).toEqual(observation('2026-08-20', 178.01))
  })
  it('expone un diagnóstico limitado a campos públicos', () => {
    expect(extractBcchPublicDiagnostics(response([{ date: '20-08-2026', value: '178.01' }]))).toEqual([
      { series: BCCH_SERIES, dateField: 'indexDateString', rawDate: '20-08-2026', rawValue: '178.01', statusCode: 'OK' },
    ])
  })
  it('normaliza cambio de mes, año, bisiesto y fecha con hora conocida', () => {
    const parsed = parseBcchSoapResponse(response([
      { date: '31/12/2025', value: '170' },
      { date: '01/01/2026', value: '171' },
      { date: '29-02-2024', value: '172' },
      { date: '2026-08-20T00:00:00', value: '178.01' },
    ]))
    expect(parsed.map((item) => item.observedAt)).toEqual(['2025-12-31', '2026-01-01', '2024-02-29', '2026-08-20'])
  })
  it.each(['31/02/2026', '32/01/2026', '00/08/2026', '29-02-2025', 'texto arbitrario', '20/08', '2026-08-20texto'])('rechaza fecha imposible o incompleta: %s', (date) => {
    expect(() => parseBcchSoapResponse(response([{ date, value: '178.01' }]))).toThrow('fecha inválida')
  })
  it('normaliza decimales con coma sin invertir la tasa', () => {
    expect(parseBcchDecimal('178,01')).toBe(178.01)
    expect(buildExchangeRate(observation('2026-08-20'), '2026-08-20T20:00:00.000Z').rate).toBe(178.01)
  })
  it('selecciona la observación válida más reciente aunque no sea de hoy', () => {
    const latest = selectLatestObservation([observation('2026-08-15', 175), observation('2026-08-18', 177)], new Date('2026-08-20T21:30:00Z'))
    expect(latest).toEqual(observation('2026-08-18', 177))
  })
  it('tolera fines de semana y feriados dentro de la ventana', () => {
    expect(selectLatestObservation([observation('2026-08-14')], new Date('2026-08-17T21:30:00Z')).observedAt).toBe('2026-08-14')
  })
  it('decide nueva observación, repetición, corrección y fuente antigua', () => {
    expect(decideSync(current('2026-08-20'), observation('2026-08-21', 179))).toEqual({ result: 'UPDATED', shouldWrite: true })
    expect(decideSync(current('2026-08-20'), observation('2026-08-20'))).toEqual({ result: 'NO_CHANGE', shouldWrite: false })
    expect(decideSync(current('2026-08-20'), observation('2026-08-20', 179))).toEqual({ result: 'CORRECTION', shouldWrite: true })
    expect(decideSync(current('2026-08-20'), observation('2026-08-19', 177))).toEqual({ result: 'STALE_SOURCE', shouldWrite: false })
  })
  it('protege contra tasas, fechas, series y respuestas inválidas', () => {
    expect(() => parseBcchDecimal('0')).toThrow('tasa inválida')
    expect(() => parseBcchDecimal('99999')).toThrow('tasa inválida')
    expect(() => parseBcchSoapResponse('{}')).toThrow('Respuesta BCCh inválida')
    expect(() => parseBcchSoapResponse(response([{ date: '2026-08-20', value: '178.01' }], 'OTHER'))).toThrow('serie inesperada')
    expect(() => parseBcchSoapResponse(response([{ date: '20-08-2026', value: 'NaN', status: 'OK' }]))).toThrow('tasa inválida')
    expect(() => parseBcchSoapResponse(response([{ date: '20-08-2026', value: '178.01', status: 'UNKNOWN' }]))).toThrow('estado de observación inesperado')
    expect(() => parseBcchSoapResponse(response([{ date: '15-08-2026', value: 'NaN', status: 'ND' }]))).toThrow('no entregó observaciones')
    expect(() => selectLatestObservation([observation('2026-07-01')], new Date('2026-08-20T21:30:00Z'))).toThrow('ventana de vigencia')
  })
  it('requiere configuración sin incluir valores en el error', () => {
    expect(() => readSyncConfig({})).toThrow('BCCH_API_USER, BCCH_API_PASSWORD')
    expect(() => readSyncConfig({ BCCH_API_USER: 'private-user' })).toThrow('BCCH_API_PASSWORD')
    expect(() => firebaseAuthMode({})).toThrow('FIREBASE_SERVICE_ACCOUNT_FIRESTORE_SYNC')
    expect(firebaseAuthMode({ GOOGLE_APPLICATION_CREDENTIALS: '/secure/path.json' })).toBe('APPLICATION_DEFAULT')
  })
  it('escapa credenciales al construir SOAP y consulta una ventana de 14 días', () => {
    const xml = buildGetSeriesSoapRequest({ bcchUser: 'a&b', bcchPassword: '<secret>' }, '2026-08-06', '2026-08-20')
    expect(xml).toContain('<user>a&amp;b</user>')
    expect(xml).toContain('<password>&lt;secret&gt;</password>')
    expect(dateWindow(new Date('2026-08-20T21:30:00Z'))).toEqual({ firstDate: '2026-08-06', lastDate: '2026-08-20' })
  })
})
