import { describe, expect, it } from 'vitest'
import { demoPlans } from '../data/demoPlans'
import { getPricePerPerson, validatePlan, type TravelPlan } from './plan'

describe('reglas de TravelPlan', () => {
  it('acepta todos los planes demo', () => { expect(demoPlans.flatMap(validatePlan)).toEqual([]) })
  it('rechaza camping que exige equipamiento propio', () => {
    const plan: TravelPlan = { ...demoPlans[0], id: 'invalid-camping', camping: { required: true, equipmentProvided: false, provider: 'PACKAGE' } }
    expect(validatePlan(plan)).toContain('No se permiten planes que requieran llevar equipamiento de camping propio.')
  })
  it('exige fuente oficial para precios oficiales', () => {
    const plan: TravelPlan = { ...demoPlans[0], id: 'invalid-official', priceType: 'OFFICIAL' }
    expect(validatePlan(plan)).toContain('Un precio oficial requiere una fuente oficial.')
  })
  it('calcula el precio por persona con un único modelo', () => {
    const duo = demoPlans.find((plan) => plan.travelerCount === 2)!
    expect(getPricePerPerson(duo).amount).toBe(duo.totalPrice.amount / 2)
  })
})
