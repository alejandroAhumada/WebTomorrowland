import { describe, expect, it } from 'vitest'
import { initialTicketTiers } from '../data/officialContent'
import { localExchangeRates } from '../data/localExchangeRates'
import { initialTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import { productionPlans } from '../../scripts/productionPlans'
import { createTravelBudget } from './travelBudget'
import { getPlanCatalogEntry, getPlanTierOptions, planForTierBudget, resolvePlanTierOption, tierDeltaFromRegular } from './planCatalog'

const plan = (id: string) => productionPlans.find((item) => item.id === id)!

describe('catálogo oficial y modalidad considerada', () => {
  it('distingue producto oficial, escenario derivado e información pendiente', () => {
    expect(getPlanCatalogEntry('full-madness-1p-2027')?.classification).toBe('OFFICIAL_PRODUCT')
    expect(getPlanCatalogEntry('full-madness-2p-2027')?.classification).toBe('DERIVED_SCENARIO')
    expect(getPlanCatalogEntry('global-journey-hotel-2p-2027')?.classification).toBe('PENDING_OFFICIAL_INFORMATION')
  })

  it('conserva Full Madness individual oficial y presenta 2P como dos entradas derivadas', () => {
    const individual = resolvePlanTierOption(plan('full-madness-1p-2027'), initialTicketTiers, 'comfort')!
    const two = resolvePlanTierOption(plan('full-madness-2p-2027'), initialTicketTiers, 'comfort')!
    expect(individual).toMatchObject({ priceNature: 'OFFICIAL', totalPrice: { amount: 5535, currency: 'BRL' }, multiplier: 1 })
    expect(two).toMatchObject({ priceNature: 'DERIVED', unitPrice: { amount: 5535 }, totalPrice: { amount: 11070 }, multiplier: 2 })
    expect(plan('full-madness-2p-2027').name).toBe('2 × Full Madness Pass')
  })

  it('solo expone tiers aplicables y mantiene PENDING cuando no hay precio oficial', () => {
    expect(getPlanTierOptions(plan('easy-tent-2p-2027'), initialTicketTiers).map(({ tier }) => tier.id)).toEqual(['regular', 'comfort', 'number-one'])
    expect(getPlanTierOptions(plan('easy-tent-2p-2027'), [...initialTicketTiers].reverse()).map(({ tier }) => tier.id)).toEqual(['regular', 'comfort', 'number-one'])
    expect(resolvePlanTierOption(plan('global-journey-hotel-1p-2027'), initialTicketTiers, 'comfort')).toMatchObject({ priceNature: 'PENDING', totalPrice: null })
    expect(getPlanTierOptions({ ...plan('easy-tent-2p-2027'), id: 'unknown-plan' }, initialTicketTiers)).toEqual([])
  })

  it('recalcula presupuesto al cambiar Regular → Comfort → N°1 sin mutar plan ni tiers', () => {
    const originalPlan = structuredClone(plan('easy-tent-2p-2027'))
    const originalTiers = structuredClone(initialTicketTiers)
    const totals = ['regular', 'comfort', 'number-one'].map((id) => {
      const planningPlan = planForTierBudget(originalPlan, resolvePlanTierOption(originalPlan, initialTicketTiers, id))
      return createTravelBudget(planningPlan, initialTravelBudgetEstimates, localExchangeRates[0]).total?.amount
    })
    expect(totals[0]).toBeLessThan(totals[1]!)
    expect(totals[1]).toBeLessThan(totals[2]!)
    expect(plan('easy-tent-2p-2027')).toEqual(originalPlan)
    expect(initialTicketTiers).toEqual(originalTiers)
  })

  it('calcula delta solo con precios comparables y no convierte PENDING en cero', () => {
    const options = getPlanTierOptions(plan('vida-nova-2p-2027'), initialTicketTiers)
    expect(tierDeltaFromRegular(options[1], options[0])).toEqual({ amount: 4750, currency: 'BRL' })
    const pending = getPlanTierOptions(plan('global-journey-hotel-2p-2027'), initialTicketTiers)
    expect(tierDeltaFromRegular(pending[1], pending[0])).toBeNull()
    expect(planForTierBudget(plan('global-journey-hotel-2p-2027'), pending[1]).totalPrice).toBeNull()
  })
})
