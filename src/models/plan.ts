export type PriceType = 'ESTIMATED' | 'OFFICIAL'
export type PlanStatus = 'AVAILABLE' | 'COMING_SOON' | 'UNAVAILABLE'
export type PlanCategory = 'GLOBAL_JOURNEY' | 'SEPARATE_PURCHASE'
export type SourceType = 'OFFICIAL' | 'TRAVEL_PROVIDER' | 'ESTIMATE'
export interface Money { amount: number; currency: 'CLP' | 'BRL' | 'USD' | 'EUR' }
export interface PlanSource { label: string; type: SourceType; url?: string; verifiedAt: string; updatedAt: string }
export interface CampingProvision { required: boolean; equipmentProvided: boolean; provider: 'TOMORROWLAND' | 'PACKAGE' | 'NOT_APPLICABLE' }
export interface EventDetails { startsOn: string; endsOn: string; venue: string; location: string }
export interface TravelPlan { id: string; name: string; travelerCount: 1 | 2; event: EventDetails; category: PlanCategory; accommodation: string; transport: string; festivalPass: string; dreamVilleIncluded: boolean; camping: CampingProvision; totalPrice: Money | null; priceType: PriceType | null; inclusions: string[]; notIncluded: string[]; status: PlanStatus; sources: PlanSource[]; updatedAt: string }
export function getPricePerPerson(plan: TravelPlan): Money | null { return plan.totalPrice ? { amount: plan.totalPrice.amount / plan.travelerCount, currency: plan.totalPrice.currency } : null }
export function validatePlan(plan: TravelPlan): string[] {
  const errors: string[] = []
  if (plan.totalPrice && plan.totalPrice.amount <= 0) errors.push('El precio total debe ser mayor que cero.')
  if (plan.totalPrice && !plan.priceType) errors.push('Un precio conocido debe indicar si es oficial o estimado.')
  if (!plan.totalPrice && plan.priceType) errors.push('Un precio pendiente no puede indicar un tipo de precio.')
  if (plan.inclusions.length === 0) errors.push('El plan debe declarar al menos una inclusión.')
  if (!plan.event.startsOn || !plan.event.endsOn || !plan.event.venue || !plan.event.location) errors.push('El plan debe identificar el evento.')
  if (plan.priceType === 'OFFICIAL' && !plan.sources.some((source) => source.type === 'OFFICIAL')) errors.push('Un precio oficial requiere una fuente oficial.')
  if (plan.camping.required && !plan.camping.equipmentProvided) errors.push('No se permiten planes que requieran llevar equipamiento de camping propio.')
  if (plan.camping.required && plan.camping.provider === 'NOT_APPLICABLE') errors.push('Un plan con camping debe indicar quién proporciona el equipamiento.')
  return errors
}
export function assertValidPlan(plan: TravelPlan): TravelPlan { const errors = validatePlan(plan); if (errors.length > 0) throw new Error(`Plan inválido (${plan.id}): ${errors.join(' ')}`); return plan }
