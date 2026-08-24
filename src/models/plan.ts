export type PriceType = 'ESTIMATED' | 'OFFICIAL'
export type PlanStatus = 'AVAILABLE' | 'COMING_SOON' | 'UNAVAILABLE'
export type PlanCategory = 'GLOBAL_JOURNEY' | 'SEPARATE_PURCHASE' | 'UNKNOWN'
export type SourceType = 'OFFICIAL' | 'TRAVEL_PROVIDER' | 'ESTIMATE'
export type Currency = 'CLP' | 'BRL' | 'USD' | 'EUR'
export interface Money { amount: number; currency: Currency }
export interface PlanSource { label: string; type: SourceType; url?: string; verifiedAt: string; updatedAt: string }
export interface CampingProvision { required: boolean; equipmentProvided: boolean; provider: 'TOMORROWLAND' | 'PACKAGE' | 'NOT_APPLICABLE' }
export interface EventDetails { startsOn: string; endsOn: string; venue: string; location: string }
export interface TravelPlan { id: string; name: string; travelerCount: 1 | 2; event: EventDetails; category: PlanCategory; sourceCategory?: string; accommodation: string; accommodationIncluded?: boolean | null; transport: string; festivalPass: string; dreamVilleIncluded: boolean | null; camping: CampingProvision | null; totalPrice: Money | null; priceType: PriceType | null; inclusions: string[]; notIncluded: string[]; status: PlanStatus; sources: PlanSource[]; sourceObservedAt?: string; updatedAt: string }
export function getPricePerPerson(plan: TravelPlan): Money | null { return plan.totalPrice ? { amount: plan.totalPrice.amount / plan.travelerCount, currency: plan.totalPrice.currency } : null }
export function validatePlan(plan: TravelPlan): string[] {
  const errors: string[] = []
  if (!plan || typeof plan !== 'object') return ['El plan debe ser un objeto.']
  if (typeof plan.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plan.id)) errors.push('El ID del plan no es válido.')
  if (typeof plan.name !== 'string' || !plan.name.trim()) errors.push('El plan debe tener un nombre.')
  if (![1, 2].includes(plan.travelerCount)) errors.push('La cantidad de viajeros debe ser 1 o 2.')
  if (!['GLOBAL_JOURNEY', 'SEPARATE_PURCHASE', 'UNKNOWN'].includes(plan.category)) errors.push('La categoría del plan no es válida.')
  if (plan.sourceCategory !== undefined && (typeof plan.sourceCategory !== 'string' || !plan.sourceCategory.trim() || plan.sourceCategory.length > 100)) errors.push('La categoría original no es válida.')
  if (![plan.accommodation, plan.transport, plan.festivalPass].every((value) => typeof value === 'string' && value.trim())) errors.push('Los campos descriptivos del plan no son válidos.')
  if (plan.accommodationIncluded !== undefined && plan.accommodationIncluded !== null && typeof plan.accommodationIncluded !== 'boolean') errors.push('El estado de alojamiento no es válido.')
  if (plan.dreamVilleIncluded !== null && typeof plan.dreamVilleIncluded !== 'boolean') errors.push('El estado de DreamVille no es válido.')
  if (plan.totalPrice !== null && (typeof plan.totalPrice !== 'object' || !Number.isFinite(plan.totalPrice.amount) || plan.totalPrice.amount <= 0)) errors.push('El precio total debe ser mayor que cero.')
  if (plan.totalPrice !== null && (typeof plan.totalPrice !== 'object' || !['CLP', 'BRL', 'USD', 'EUR'].includes(plan.totalPrice.currency))) errors.push('La moneda del precio no es válida.')
  if (plan.priceType !== null && !['ESTIMATED', 'OFFICIAL'].includes(plan.priceType)) errors.push('El tipo de precio no es válido.')
  if (plan.totalPrice && !plan.priceType) errors.push('Un precio conocido debe indicar si es oficial o estimado.')
  if (!plan.totalPrice && plan.priceType) errors.push('Un precio pendiente no puede indicar un tipo de precio.')
  if (!Array.isArray(plan.inclusions) || plan.inclusions.some((value) => typeof value !== 'string' || !value.trim())) errors.push('El plan debe declarar inclusiones válidas.')
  if (!Array.isArray(plan.notIncluded) || plan.notIncluded.some((value) => typeof value !== 'string' || !value.trim())) errors.push('Las exclusiones del plan no son válidas.')
  if (!plan.event || typeof plan.event !== 'object' || ![plan.event.startsOn, plan.event.endsOn, plan.event.venue, plan.event.location].every((value) => typeof value === 'string' && value.trim())) errors.push('El plan debe identificar el evento.')
  if (!['AVAILABLE', 'COMING_SOON', 'UNAVAILABLE'].includes(plan.status)) errors.push('El estado del plan no es válido.')
  if (!Array.isArray(plan.sources) || plan.sources.some((source) => !validSource(source))) errors.push('Las fuentes del plan no son válidas.')
  if (typeof plan.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(plan.updatedAt)) errors.push('La fecha de actualización no es válida.')
  if (plan.sourceObservedAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(plan.sourceObservedAt)) errors.push('La fecha de observación de la fuente no es válida.')
  if (plan.priceType === 'OFFICIAL' && (!Array.isArray(plan.sources) || !plan.sources.some((source) => source.type === 'OFFICIAL'))) errors.push('Un precio oficial requiere una fuente oficial.')
  if (plan.camping && (typeof plan.camping.required !== 'boolean' || typeof plan.camping.equipmentProvided !== 'boolean' || !['TOMORROWLAND', 'PACKAGE', 'NOT_APPLICABLE'].includes(plan.camping.provider))) errors.push('La información de camping no es válida.')
  if (plan.camping?.required && !plan.camping.equipmentProvided) errors.push('No se permiten planes que requieran llevar equipamiento de camping propio.')
  if (plan.camping?.required && plan.camping.provider === 'NOT_APPLICABLE') errors.push('Un plan con camping debe indicar quién proporciona el equipamiento.')
  return errors
}
export function assertValidPlan(plan: TravelPlan): TravelPlan { const errors = validatePlan(plan); if (errors.length > 0) throw new Error(`Plan inválido (${plan.id}): ${errors.join(' ')}`); return plan }

export function parseTravelPlan(id: string, input: unknown): TravelPlan {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Plan inválido (${id}): el documento debe ser un objeto.`)
  const raw = input as Record<string, unknown>
  const rawCategory = typeof raw.category === 'string' ? raw.category : undefined
  const category: PlanCategory = rawCategory === 'GLOBAL_JOURNEY' || rawCategory === 'SEPARATE_PURCHASE' ? rawCategory : 'UNKNOWN'
  const plan = {
    ...raw,
    id,
    category,
    ...(category === 'UNKNOWN' && rawCategory ? { sourceCategory: rawCategory } : {}),
    accommodation: knownText(raw.accommodation),
    transport: knownText(raw.transport),
    festivalPass: knownText(raw.festivalPass),
    dreamVilleIncluded: typeof raw.dreamVilleIncluded === 'boolean' ? raw.dreamVilleIncluded : null,
    accommodationIncluded: typeof raw.accommodationIncluded === 'boolean' ? raw.accommodationIncluded : null,
    camping: validCamping(raw.camping) ? raw.camping : null,
    inclusions: Array.isArray(raw.inclusions) ? raw.inclusions : [],
    notIncluded: Array.isArray(raw.notIncluded) ? raw.notIncluded : [],
  } as TravelPlan
  return assertValidPlan(plan)
}

function knownText(value: unknown): string { return typeof value === 'string' && value.trim() ? value.trim() : 'No informado' }
function validCamping(value: unknown): value is CampingProvision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const camping = value as Record<string, unknown>
  return typeof camping.required === 'boolean' && typeof camping.equipmentProvided === 'boolean' && ['TOMORROWLAND', 'PACKAGE', 'NOT_APPLICABLE'].includes(String(camping.provider))
}

function validSource(value: unknown): value is PlanSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const source = value as Record<string, unknown>
  if (typeof source.label !== 'string' || !source.label.trim() || !['OFFICIAL', 'TRAVEL_PROVIDER', 'ESTIMATE'].includes(String(source.type))) return false
  if (typeof source.verifiedAt !== 'string' || typeof source.updatedAt !== 'string') return false
  if (source.url === undefined) return source.type !== 'OFFICIAL'
  if (typeof source.url !== 'string') return false
  try {
    const url = new URL(source.url)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    return source.type !== 'OFFICIAL' || ['tomorrowland.com', 'www.tomorrowland.com', 'brasil.tomorrowland.com'].includes(url.hostname.toLowerCase())
  } catch { return false }
}
