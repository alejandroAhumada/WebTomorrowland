import type { PlanRepository } from './PlanRepository'
import type { ExchangeRateRepository } from './ExchangeRateRepository'
import { LocalPlanRepository } from './LocalPlanRepository'
import { LocalExchangeRateRepository } from './LocalExchangeRateRepository'
import type { ImportantEventRepository } from './ImportantEventRepository'
import { LocalImportantEventRepository } from './LocalImportantEventRepository'
import type { TicketTierRepository } from './TicketTierRepository'
import type { ImportantInformationRepository } from './ImportantInformationRepository'
import type { TicketTier } from '../models/ticketTier'
import type { ImportantInformation } from '../models/importantInformation'

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

class ConfiguredImportantEventRepository implements ImportantEventRepository {
  private delegate?: Promise<ImportantEventRepository>

  private getDelegate(): Promise<ImportantEventRepository> {
    if (!this.delegate) {
      this.delegate = import.meta.env.VITE_DATA_SOURCE === 'firestore'
        ? import('./FirestoreImportantEventRepository').then(({ FirestoreImportantEventRepository }) => new FirestoreImportantEventRepository())
        : Promise.resolve(new LocalImportantEventRepository())
    }
    return this.delegate
  }

  async getAll() { return (await this.getDelegate()).getAll() }
}

export const importantEventRepository: ImportantEventRepository = new ConfiguredImportantEventRepository()

class ConfiguredTicketTierRepository implements TicketTierRepository {
  private request?: Promise<TicketTier[]>
  getAll() {
    this.request ??= (import.meta.env.VITE_DATA_SOURCE === 'firestore'
      ? import('./FirestoreTicketTierRepository').then(({ FirestoreTicketTierRepository }) => new FirestoreTicketTierRepository().getAll())
      : import('./LocalTicketTierRepository').then(({ LocalTicketTierRepository }) => new LocalTicketTierRepository().getAll()))
    return this.request
  }
}
export const ticketTierRepository = new ConfiguredTicketTierRepository()

class ConfiguredImportantInformationRepository implements ImportantInformationRepository {
  private request?: Promise<ImportantInformation[]>
  getAll() {
    this.request ??= (import.meta.env.VITE_DATA_SOURCE === 'firestore'
      ? import('./FirestoreImportantInformationRepository').then(({ FirestoreImportantInformationRepository }) => new FirestoreImportantInformationRepository().getAll())
      : import('./LocalImportantInformationRepository').then(({ LocalImportantInformationRepository }) => new LocalImportantInformationRepository().getAll()))
    return this.request
  }
}
export const importantInformationRepository = new ConfiguredImportantInformationRepository()
