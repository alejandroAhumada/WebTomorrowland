import type { Currency } from '../models/plan'
import type { ExchangeRate } from '../models/exchangeRate'

export interface ExchangeRateRepository {
  get(fromCurrency: Currency, toCurrency: Currency): Promise<ExchangeRate | null>
}
