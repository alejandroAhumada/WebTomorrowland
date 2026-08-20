import type { Currency, Money } from './plan'

export interface ExchangeRate {
  id: string
  fromCurrency: Currency
  toCurrency: Currency
  rate: number
  sourceUrl: string
  sourceName: string
  sourceSeries: string
  observedAt: string
  fetchedAt: string
  updatedAt: string
}

export function exchangeRateId(fromCurrency: Currency, toCurrency: Currency): string {
  return `${fromCurrency}_${toCurrency}`
}

export function validateExchangeRate(exchangeRate: ExchangeRate): string[] {
  const errors: string[] = []
  if (exchangeRate.id !== exchangeRateId(exchangeRate.fromCurrency, exchangeRate.toCurrency)) errors.push('El ID de la tasa debe corresponder al par de monedas.')
  if (exchangeRate.fromCurrency === exchangeRate.toCurrency) errors.push('La tasa debe convertir entre monedas distintas.')
  if (!Number.isFinite(exchangeRate.rate) || exchangeRate.rate <= 0) errors.push('La tasa debe ser un número mayor que cero.')
  if (!exchangeRate.sourceUrl || !exchangeRate.sourceName || !exchangeRate.sourceSeries) errors.push('La tasa debe conservar una fuente y serie trazables.')
  if (!exchangeRate.observedAt || !exchangeRate.fetchedAt || !exchangeRate.updatedAt) errors.push('La tasa debe conservar sus fechas de observación, consulta y actualización.')
  return errors
}

export function assertValidExchangeRate(exchangeRate: ExchangeRate): ExchangeRate {
  const errors = validateExchangeRate(exchangeRate)
  if (errors.length) throw new Error(`Tasa de cambio inválida (${exchangeRate.id}): ${errors.join(' ')}`)
  return exchangeRate
}

export function convertMoney(money: Money | null, toCurrency: Currency, exchangeRate?: ExchangeRate | null): Money | null {
  if (!money) return null
  if (money.currency === toCurrency) return { ...money }
  if (!exchangeRate || exchangeRate.fromCurrency !== money.currency || exchangeRate.toCurrency !== toCurrency) return null
  return { amount: Math.round(money.amount * exchangeRate.rate), currency: toCurrency }
}
