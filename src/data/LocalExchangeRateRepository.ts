import { exchangeRateId } from '../models/exchangeRate'
import type { Currency } from '../models/plan'
import type { ExchangeRateRepository } from './ExchangeRateRepository'
import { localExchangeRates } from './localExchangeRates'

export class LocalExchangeRateRepository implements ExchangeRateRepository {
  async get(fromCurrency: Currency, toCurrency: Currency) {
    return localExchangeRates.find((rate) => rate.id === exchangeRateId(fromCurrency, toCurrency)) ?? null
  }
}
