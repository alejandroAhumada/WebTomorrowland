import { useEffect, useState } from 'react'
import { exchangeRateRepository } from '../data'
import type { ExchangeRate } from '../models/exchangeRate'
import type { Currency } from '../models/plan'

interface StoredExchangeRateState { key: string; rate: ExchangeRate | null; unavailable: boolean }
interface ExchangeRateState { rate: ExchangeRate | null; loading: boolean; unavailable: boolean }

export function useExchangeRate(fromCurrency: Currency, toCurrency: Currency): ExchangeRateState {
  const requestKey = `${fromCurrency}_${toCurrency}`
  const [state, setState] = useState<StoredExchangeRateState>({ key: '', rate: null, unavailable: false })

  useEffect(() => {
    let active = true
    exchangeRateRepository.get(fromCurrency, toCurrency)
      .then((rate) => { if (active) setState({ key: requestKey, rate, unavailable: !rate }) })
      .catch(() => { if (active) setState({ key: requestKey, rate: null, unavailable: true }) })
    return () => { active = false }
  }, [fromCurrency, toCurrency, requestKey])

  return state.key === requestKey ? { rate: state.rate, loading: false, unavailable: state.unavailable } : { rate: null, loading: true, unavailable: false }
}
