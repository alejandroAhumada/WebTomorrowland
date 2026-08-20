import type { TravelPlan } from '../models/plan'
export interface PlanRepository { getAll(): Promise<TravelPlan[]>; getByTravelerCount(travelerCount: 1 | 2): Promise<TravelPlan[]>; getByIds(ids: string[]): Promise<TravelPlan[]> }
