import { assertValidExchangeRate, type ExchangeRate } from '../models/exchangeRate'

export const localExchangeRates: ExchangeRate[] = [assertValidExchangeRate({
  id: 'BRL_CLP',
  fromCurrency: 'BRL',
  toCurrency: 'CLP',
  rate: 178.01,
  sourceUrl: 'https://si3.bcentral.cl/siete/ES/Siete/Canasta?idCanasta=AVWIR1123',
  sourceName: 'Banco Central de Chile',
  sourceSeries: 'F072.CLP.BRL.N.O.D',
  observedAt: '2026-08-20',
  fetchedAt: '2026-08-20T15:17:34-04:00',
  updatedAt: '2026-08-20T15:17:34-04:00',
})]
