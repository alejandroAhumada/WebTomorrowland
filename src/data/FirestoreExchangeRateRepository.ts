import { doc, getDoc } from 'firebase/firestore'
import { assertValidExchangeRate, exchangeRateId, type ExchangeRate } from '../models/exchangeRate'
import type { Currency } from '../models/plan'
import type { ExchangeRateRepository } from './ExchangeRateRepository'
import { getFirebaseDb } from './firebase'

export class FirestoreExchangeRateRepository implements ExchangeRateRepository {
  async get(fromCurrency: Currency, toCurrency: Currency): Promise<ExchangeRate | null> {
    const id = exchangeRateId(fromCurrency, toCurrency)
    const snapshot = await getDoc(doc(getFirebaseDb(), 'exchangeRates', id))
    return snapshot.exists() ? assertValidExchangeRate({ ...(snapshot.data() as Omit<ExchangeRate, 'id'>), id }) : null
  }
}
