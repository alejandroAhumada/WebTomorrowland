import type { PlanRepository } from './PlanRepository'
import { LocalPlanRepository } from './LocalPlanRepository'

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
