import { isOfficialTomorrowlandUrl } from './importantEvent.js'
import type { Money, PriceType } from './plan.js'

export type TicketTierType = 'REGULAR' | 'COMFORT' | 'NUMBER_ONE'
export interface TicketTierOffering {
  planId: string
  available: boolean
  totalPrice: Money | null
  priceType: PriceType | null
  sourceUrl: string
}
export interface TicketTier {
  id: string
  type: TicketTierType
  name: string
  description: string
  benefits: string[]
  conditions: string[]
  offerings: TicketTierOffering[]
  sourceName: 'Tomorrowland Brasil'
  sourceUrl: string
  sourceObservedAt: string
  updatedAt: string
}

export function validateTicketTier(tier: TicketTier): string[] {
  const errors: string[] = []
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tier.id)) errors.push('El ID del tier no es válido.')
  if (!['REGULAR', 'COMFORT', 'NUMBER_ONE'].includes(tier.type)) errors.push('El tipo de tier no es válido.')
  if (!tier.name.trim() || !tier.description.trim()) errors.push('El tier requiere nombre y descripción.')
  if (!Array.isArray(tier.benefits) || tier.benefits.some(invalidText) || !Array.isArray(tier.conditions) || tier.conditions.some(invalidText)) errors.push('Los beneficios o condiciones no son válidos.')
  if (!isOfficialTomorrowlandUrl(tier.sourceUrl) || tier.sourceName !== 'Tomorrowland Brasil') errors.push('El tier requiere una fuente oficial.')
  if (!isTimestamp(tier.sourceObservedAt) || !isCivilDate(tier.updatedAt)) errors.push('La trazabilidad del tier no es válida.')
  if (!Array.isArray(tier.offerings) || tier.offerings.length === 0) errors.push('El tier requiere ofertas explícitas.')
  const ids = new Set<string>()
  for (const offering of tier.offerings ?? []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(offering.planId) || ids.has(offering.planId)) errors.push('La oferta contiene un planId inválido o duplicado.')
    ids.add(offering.planId)
    if (typeof offering.available !== 'boolean' || !isOfficialTomorrowlandUrl(offering.sourceUrl)) errors.push('La oferta requiere disponibilidad y fuente oficial.')
    if (offering.totalPrice && (offering.totalPrice.currency !== 'BRL' || !Number.isFinite(offering.totalPrice.amount) || offering.totalPrice.amount <= 0 || offering.priceType !== 'OFFICIAL')) errors.push('Un precio de tier conocido debe ser BRL oficial y positivo.')
    if (!offering.totalPrice && offering.priceType !== null) errors.push('Un precio pendiente debe tener priceType null.')
  }
  return errors
}

export function assertValidTicketTier(tier: TicketTier): TicketTier {
  const errors = validateTicketTier(tier)
  if (errors.length) throw new Error(`Ticket tier inválido (${tier.id}): ${errors.join(' ')}`)
  return tier
}

export function getTierOffering(tier: TicketTier, planId: string): TicketTierOffering | null {
  return tier.offerings.find((offering) => offering.planId === planId && offering.available) ?? null
}

function invalidText(value: unknown): boolean { return typeof value !== 'string' || !value.trim() || value.length > 500 }
function isTimestamp(value: string): boolean { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) }
function isCivilDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) }
