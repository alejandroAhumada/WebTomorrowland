import type { TravelPlan } from '../models/plan'
import type { PlanRepository } from './PlanRepository'
import { demoPlans } from './demoPlans'
export class LocalPlanRepository implements PlanRepository {
  async getAll(): Promise<TravelPlan[]> { return demoPlans }
  async getByTravelerCount(travelerCount: 1 | 2): Promise<TravelPlan[]> { return demoPlans.filter((plan) => plan.travelerCount === travelerCount) }
  async getByIds(ids: string[]): Promise<TravelPlan[]> { const requested = new Set(ids); return demoPlans.filter((plan) => requested.has(plan.id)) }
}
