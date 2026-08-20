export type PriceType = 'ESTIMATED' | 'OFFICIAL'
export type PlanStatus = 'AVAILABLE' | 'COMING_SOON' | 'UNAVAILABLE'
export type PlanCategory = 'GLOBAL_JOURNEY' | 'SEPARATE_PURCHASE'
export type SourceType = 'OFFICIAL' | 'TRAVEL_PROVIDER' | 'ESTIMATE'
export interface Money { amount: number; currency: 'CLP' | 'BRL' | 'USD' | 'EUR' }
export interface PlanSource { label: string; type: SourceType; url?: string; verifiedAt: string; updatedAt: string }
export interface CampingProvision { required: boolean; equipmentProvided: boolean; provider: 'TOMORROWLAND' | 'PACKAGE' | 'NOT_APPLICABLE' }
export interface TravelPlan { id: string; name: string; travelerCount: 1 | 2; category: PlanCategory; accommodation: string; transport: string; festivalPass: string; dreamVilleIncluded: boolean; camping: CampingProvision; totalPrice: Money; priceType: PriceType; inclusions: string[]; status: PlanStatus; source?: PlanSource; updatedAt: string }
export function getPricePerPerson(plan: TravelPlan): Money { return { amount: plan.totalPrice.amount / plan.travelerCount, currency: plan.totalPrice.currency } }
export function validatePlan(plan: TravelPlan): string[] {
  const errors: string[] = []
  if (plan.totalPrice.amount <= 0) errors.push('El precio total debe ser mayor que cero.')
  if (plan.inclusions.length === 0) errors.push('El plan debe declarar al menos una inclusión.')
  if (plan.priceType === 'OFFICIAL' && plan.source?.type !== 'OFFICIAL') errors.push('Un precio oficial requiere una fuente oficial.')
  if (plan.camping.required && !plan.camping.equipmentProvided) errors.push('No se permiten planes que requieran llevar equipamiento de camping propio.')
  if (plan.camping.required && plan.camping.provider === 'NOT_APPLICABLE') errors.push('Un plan con camping debe indicar quién proporciona el equipamiento.')
  return errors
}
export function assertValidPlan(plan: TravelPlan): TravelPlan { const errors = validatePlan(plan); if (errors.length > 0) throw new Error(`Plan inválido (${plan.id}): ${errors.join(' ')}`); return plan }
