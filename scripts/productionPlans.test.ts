import { describe, expect, it } from 'vitest'
import { validatePlan } from '../src/models/plan'
import { productionPlans } from './productionPlans'

describe('dataset de producción', () => {
  it('usa IDs únicos y pasa las reglas de dominio', () => {
    const ids = productionPlans.map((plan) => plan.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(productionPlans.flatMap(validatePlan)).toEqual([])
  })

  it('no exige equipamiento de camping propio', () => {
    expect(productionPlans.every((plan) => !plan.camping.required || plan.camping.equipmentProvided)).toBe(true)
  })

  it('solo marca como oficiales precios publicados por fuentes oficiales', () => {
    const officialPlans = productionPlans.filter((plan) => plan.priceType === 'OFFICIAL')
    expect(officialPlans.length).toBeGreaterThan(0)
    expect(officialPlans.every((plan) => plan.totalPrice && plan.sources.some((source) => source.type === 'OFFICIAL'))).toBe(true)
  })
})
