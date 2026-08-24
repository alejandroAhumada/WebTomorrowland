import type { Money, TravelPlan } from './plan'
import type { TicketTier } from './ticketTier'

export type CatalogClassification = 'OFFICIAL_PRODUCT' | 'DERIVED_SCENARIO' | 'PENDING_OFFICIAL_INFORMATION'
export type TierPriceNature = 'OFFICIAL' | 'DERIVED' | 'PENDING'

interface CatalogEntry {
  classification: CatalogClassification
  officialProductName: string
  sourceUrl: string
  derivedFromPlanId?: string
  multiplier?: number
  explanation?: string
}

export interface PlanTierOption {
  tier: TicketTier
  totalPrice: Money | null
  priceNature: TierPriceNature
  sourceUrl: string
  multiplier: number
  unitPrice: Money | null
}

const tierOrder: Readonly<Record<TicketTier['type'], number>> = { REGULAR: 0, COMFORT: 1, NUMBER_ONE: 2 }

const festivalTickets = 'https://brasil.tomorrowland.com/en/tickets/festival-tickets/'
const catalog: Readonly<Record<string, CatalogEntry>> = {
  'full-madness-1p-2027': { classification: 'OFFICIAL_PRODUCT', officialProductName: 'Full Madness Pass', sourceUrl: festivalTickets },
  'full-madness-2p-2027': {
    classification: 'DERIVED_SCENARIO', officialProductName: 'Full Madness Pass', sourceUrl: festivalTickets,
    derivedFromPlanId: 'full-madness-1p-2027', multiplier: 2,
    explanation: 'Escenario de planificación calculado como dos entradas individuales; Tomorrowland no publica un pack Full Madness 2P.',
  },
  'vida-nova-2p-2027': { classification: 'OFFICIAL_PRODUCT', officialProductName: 'Vida Nova 2P Package', sourceUrl: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/vida-nova-package/' },
  'easy-tent-2p-2027': { classification: 'OFFICIAL_PRODUCT', officialProductName: 'Easy Tent 2P Package', sourceUrl: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/' },
  'spectacular-easy-tent-2p-2027': { classification: 'OFFICIAL_PRODUCT', officialProductName: 'Spectacular Easy Tent 2P Package', sourceUrl: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/spectacular-easy-tent-package/' },
  'global-journey-hotel-1p-2027': { classification: 'PENDING_OFFICIAL_INFORMATION', officialProductName: 'Global Journey Hotel Package', sourceUrl: 'https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages/', explanation: 'La familia Hotel Packages está publicada; el precio y la configuración exacta para una persona siguen pendientes.' },
  'global-journey-hotel-2p-2027': { classification: 'PENDING_OFFICIAL_INFORMATION', officialProductName: 'Global Journey Hotel Package', sourceUrl: 'https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages/', explanation: 'La familia Hotel Packages está publicada; el precio y la configuración exacta para dos personas siguen pendientes.' },
}

export function getPlanCatalogEntry(planId: string): CatalogEntry | null { return catalog[planId] ?? null }

export function getPlanTierOptions(plan: TravelPlan, tiers: readonly TicketTier[]): PlanTierOption[] {
  const entry = getPlanCatalogEntry(plan.id)
  if (!entry) return []
  const options: PlanTierOption[] = []
  for (const tier of tiers) {
    const direct = tier.offerings.find((offering) => offering.planId === plan.id && offering.available)
    if (direct) { options.push({ tier, totalPrice: cloneMoney(direct.totalPrice), unitPrice: cloneMoney(direct.totalPrice), priceNature: direct.totalPrice ? 'OFFICIAL' : 'PENDING', sourceUrl: direct.sourceUrl, multiplier: 1 }); continue }
    if (entry.classification !== 'DERIVED_SCENARIO' || !entry.derivedFromPlanId || !entry.multiplier) continue
    const base = tier.offerings.find((offering) => offering.planId === entry.derivedFromPlanId && offering.available)
    if (!base) continue
    options.push({
      tier, unitPrice: cloneMoney(base.totalPrice),
      totalPrice: base.totalPrice ? { amount: base.totalPrice.amount * entry.multiplier, currency: base.totalPrice.currency } : null,
      priceNature: base.totalPrice ? 'DERIVED' as const : 'PENDING' as const,
      sourceUrl: base.sourceUrl, multiplier: entry.multiplier,
    })
  }
  return options.sort((left, right) => tierOrder[left.tier.type] - tierOrder[right.tier.type] || left.tier.name.localeCompare(right.tier.name, 'es'))
}

export function resolvePlanTierOption(plan: TravelPlan, tiers: readonly TicketTier[], tierId: string | null): PlanTierOption | null {
  const options = getPlanTierOptions(plan, tiers)
  return options.find((option) => option.tier.id === tierId) ?? options.find((option) => option.tier.type === 'REGULAR') ?? options[0] ?? null
}

export function planForTierBudget(plan: TravelPlan, option: PlanTierOption | null): TravelPlan {
  if (!option) return plan
  return {
    ...plan,
    totalPrice: cloneMoney(option.totalPrice),
    priceType: option.totalPrice ? (option.priceNature === 'OFFICIAL' ? 'OFFICIAL' : 'ESTIMATED') : null,
  }
}

export function tierDeltaFromRegular(option: PlanTierOption, regular: PlanTierOption | undefined): Money | null {
  if (!option.totalPrice || !regular?.totalPrice || option.totalPrice.currency !== regular.totalPrice.currency) return null
  return { amount: option.totalPrice.amount - regular.totalPrice.amount, currency: option.totalPrice.currency }
}

function cloneMoney(money: Money | null): Money | null { return money ? { ...money } : null }
