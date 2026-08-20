import { assertValidExchangeRate, type ExchangeRate } from '../src/models/exchangeRate'

export const productionExchangeRates: ExchangeRate[] = [assertValidExchangeRate({
  id: 'BRL_CLP',
  fromCurrency: 'BRL',
  toCurrency: 'CLP',
  rate: 175.62346329469617,
  sourceUrl: 'https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas',
  sourceName: 'Banco Central do Brasil · cierre PTAX (cotización CLP de venta invertida)',
  observedAt: '2026-08-17T13:00:00-03:00',
  fetchedAt: '2026-08-20T15:04:09-04:00',
  updatedAt: '2026-08-20T15:04:09-04:00',
})]
