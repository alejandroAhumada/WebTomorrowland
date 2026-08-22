import { describe, expect, it } from 'vitest'
import type { PriceType, TravelPlan } from '../models/plan'
import { sortPlansByPrice } from './sortPlans'

function plan(id: string, name: string, travelerCount: 1 | 2, amount: number | null, priceType: PriceType | null = amount === null ? null : 'OFFICIAL'): TravelPlan {
  return {
    id,
    name,
    travelerCount,
    event: { startsOn: '2027-04-30', endsOn: '2027-05-02', venue: 'Parque Maeda', location: 'Itu, São Paulo' },
    category: 'SEPARATE_PURCHASE',
    accommodation: 'No incluido',
    transport: 'No incluido',
    festivalPass: 'Full Madness Pass',
    dreamVilleIncluded: false,
    camping: { required: false, equipmentProvided: false, provider: 'NOT_APPLICABLE' },
    totalPrice: amount === null ? null : { amount, currency: 'BRL' },
    priceType,
    inclusions: ['Festival'],
    notIncluded: [],
    status: 'AVAILABLE',
    sources: [],
    updatedAt: '2026-08-22',
  }
}

describe('sortPlansByPrice', () => {
  it('ordena precios conocidos de menor a mayor por el monto original', () => {
    const plans = [plan('high', 'Alto', 2, 8359), plan('low', 'Bajo', 2, 6320), plan('mid', 'Medio', 2, 7609)]
    expect(sortPlansByPrice(plans).map(({ id }) => id)).toEqual(['low', 'mid', 'high'])
  })

  it('mezcla OFFICIAL y ESTIMATED sin dar prioridad al tipo de precio', () => {
    const plans = [plan('official', 'Oficial', 2, 7609, 'OFFICIAL'), plan('estimated', 'Estimado', 2, 6320, 'ESTIMATED')]
    expect(sortPlansByPrice(plans).map(({ id }) => id)).toEqual(['estimated', 'official'])
  })

  it('deja todos los planes PENDING al final', () => {
    const plans = [plan('pending', 'Pendiente', 1, null), plan('priced', 'Con precio', 2, 9000)]
    expect(sortPlansByPrice(plans).map(({ id }) => id)).toEqual(['priced', 'pending'])
  })

  it('ordena varios PENDING por travelerCount y luego alfabéticamente', () => {
    const plans = [plan('two', 'Beta', 2, null), plan('one-z', 'Zeta', 1, null), plan('one-a', 'Alfa', 1, null)]
    expect(sortPlansByPrice(plans).map(({ id }) => id)).toEqual(['one-a', 'one-z', 'two'])
  })

  it('resuelve empates de precio alfabéticamente', () => {
    const plans = [plan('z', 'Zeta', 2, 7000), plan('a', 'Alfa', 1, 7000)]
    expect(sortPlansByPrice(plans).map(({ id }) => id)).toEqual(['a', 'z'])
  })

  it('no muta el array original', () => {
    const plans = [plan('high', 'Alto', 1, 8000), plan('low', 'Bajo', 1, 6000)]
    const originalOrder = plans.map(({ id }) => id)
    const result = sortPlansByPrice(plans)
    expect(result).not.toBe(plans)
    expect(plans.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('acepta una lista vacía', () => {
    expect(sortPlansByPrice([])).toEqual([])
  })

  it('conserva correctamente un único elemento', () => {
    const onlyPlan = plan('only', 'Único', 1, 3160)
    expect(sortPlansByPrice([onlyPlan])).toEqual([onlyPlan])
  })
})
