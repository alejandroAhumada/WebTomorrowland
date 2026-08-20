import type { PlanRepository } from './PlanRepository'
import type { ExchangeRateRepository } from './ExchangeRateRepository'
import { LocalPlanRepository } from './LocalPlanRepository'
import { LocalExchangeRateRepository } from './LocalExchangeRateRepository'

class ConfiguredPlanRepository implements PlanRepository {
  private delegate?: Promise<PlanRepository>

  private getDelegate(): Promise<PlanRepository> {
    if (!this.delegate) {
      this.delegate = import.meta.env.VITE_DATA_SOURCE === 'firestore'
        ? import('./FirestorePlanRepository').then(({ FirestorePlanRepository }) => new FirestorePlanRepository())
        : Promise.resolve(new LocalPlanRepository())
    }
    return this.delegate
  }

  async getAll() { return (await this.getDelegate()).getAll() }
  async getByTravelerCount(travelerCount: 1 | 2) { return (await this.getDelegate()).getByTravelerCount(travelerCount) }
  async getByIds(ids: string[]) { return (await this.getDelegate()).getByIds(ids) }
}

export const planRepository: PlanRepository = new ConfiguredPlanRepository()

class ConfiguredExchangeRateRepository implements ExchangeRateRepository {
  private delegate?: Promise<ExchangeRateRepository>
  private requests = new Map<string, ReturnType<ExchangeRateRepository['get']>>()

  private getDelegate(): Promise<ExchangeRateRepository> {
    if (!this.delegate) {
      this.delegate = import.meta.env.VITE_DATA_SOURCE === 'firestore'
        ? import('./FirestoreExchangeRateRepository').then(({ FirestoreExchangeRateRepository }) => new FirestoreExchangeRateRepository())
        : Promise.resolve(new LocalExchangeRateRepository())
    }
    return this.delegate
  }

  get(fromCurrency: Parameters<ExchangeRateRepository['get']>[0], toCurrency: Parameters<ExchangeRateRepository['get']>[1]) {
    const key = `${fromCurrency}_${toCurrency}`
    const cached = this.requests.get(key)
    if (cached) return cached
    const request = this.getDelegate().then((repository) => repository.get(fromCurrency, toCurrency)).catch((error) => {
      this.requests.delete(key)
      throw error
    })
    this.requests.set(key, request)
    return request
  }
}

export const exchangeRateRepository: ExchangeRateRepository = new ConfiguredExchangeRateRepository()
