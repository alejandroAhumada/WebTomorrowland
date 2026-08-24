import { describe, expect, it } from 'vitest'
import { parsePlan } from '../data/FirestorePlanRepository'
import { futurePlanFixtures } from '../testFixtures/futurePlans'
import { buildPersonalTripTasks } from './personalTripTask'
import { parseTravelPlan } from './plan'
import { getPlanAccommodationInclusion, getPlanClassificationLabel, getPlanTierOptions } from './planCatalog'
import { createPlanRecommendations } from './planRecommendation'
import { createTravelBudget } from './travelBudget'

const fixtureId = 'fixture-future-official-package-2027'
const estimates = [
  { category: 'FLIGHT' as const, money: { amount: 400_000, currency: 'CLP' as const }, scope: 'PER_PERSON' as const, unit: 'TRIP' as const, quantity: 1, description: 'Fixture vuelo', updatedAt: '2026-08-24' },
  { category: 'EXTERNAL_ACCOMMODATION' as const, money: { amount: 70_000, currency: 'CLP' as const }, scope: 'PER_GROUP' as const, unit: 'NIGHT' as const, quantity: 4, description: 'Fixture alojamiento', updatedAt: '2026-08-24' },
]

describe('compatibilidad conservadora con productos futuros ficticios', () => {
  it('acepta una categoría externa nueva sin convertirla a una familia parecida', () => {
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_UNKNOWN_CATEGORY)
    expect(plan.category).toBe('UNKNOWN')
    expect(plan.sourceCategory).toBe('FUTURE_OFFICIAL_PACKAGE')
    expect(getPlanClassificationLabel(plan)).toBe('Alternativa para planificar')
  })

  it('el repository usa la misma frontera de parsing segura', () => {
    expect(parsePlan(fixtureId, futurePlanFixtures.NEW_UNKNOWN_CATEGORY)).toMatchObject({ category: 'UNKNOWN', sourceCategory: 'FUTURE_OFFICIAL_PACKAGE' })
  })

  it('DreamVille parcial no inventa entrada ni alojamiento', () => {
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_DREAMVILLE_PARTIAL)
    expect(getPlanClassificationLabel(plan)).toBe('DreamVille')
    expect(getPlanAccommodationInclusion(plan)).toBeNull()
  })

  it('Global Journey parcial conserva la familia pero no presume alojamiento', () => {
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_GLOBAL_JOURNEY_PARTIAL)
    expect(getPlanClassificationLabel(plan)).toBe('Global Journey')
    expect(getPlanAccommodationInclusion(plan)).toBeNull()
  })

  it('precio pendiente permanece desconocido y nunca se transforma en cero', () => {
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_PRODUCT_PENDING_PRICE)
    const budget = createTravelBudget(plan, estimates)
    expect(plan.totalPrice).toBeNull()
    expect(budget.items[0].money).toBeNull()
    expect(budget.total).toBeNull()
    expect(budget.pendingReason).toBe('PLAN_PRICE')
  })

  it('alojamiento desconocido no agrega una estimación externa inventada', () => {
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_PRODUCT_UNKNOWN_ACCOMMODATION)
    const budget = createTravelBudget(plan, estimates)
    const accommodation = budget.items.find((item) => item.category === 'EXTERNAL_ACCOMMODATION')
    expect(budget.accommodationIncluded).toBeNull()
    expect(accommodation).toMatchObject({ money: null, valueType: 'PENDING' })
    expect(budget.total).toBeNull()
    expect(buildPersonalTripTasks(plan).some((task) => task.type === 'EXTERNAL_ACCOMMODATION')).toBe(false)
  })

  it('no inventa tiers ni hereda una modalidad no soportada', () => {
    const noTiers = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_PRODUCT_NO_TIERS)
    const unsupported = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_PRODUCT_NEW_TIER_UNSUPPORTED)
    expect(getPlanTierOptions(noTiers, [])).toEqual([])
    expect(getPlanTierOptions(unsupported, [])).toEqual([])
  })

  it('tolera campos futuros y normaliza opcionales ausentes como desconocidos', () => {
    expect(() => parseTravelPlan(fixtureId, futurePlanFixtures.FUTURE_PRODUCT_WITH_EXTRA_FIELD)).not.toThrow()
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.FUTURE_PRODUCT_MISSING_OPTIONAL_FIELD)
    expect(plan).toMatchObject({ accommodation: 'No informado', transport: 'No informado', festivalPass: 'No informado', dreamVilleIncluded: null, camping: null })
  })

  it('excluye datos incompletos de rankings que exigen presupuesto o alojamiento conocidos', () => {
    const plan = parseTravelPlan(fixtureId, futurePlanFixtures.NEW_PRODUCT_UNKNOWN_ACCOMMODATION)
    const budget = createTravelBudget(plan, estimates)
    const recommendations = createPlanRecommendations([plan], new Map([[plan.id, budget]]), 2)
    expect(recommendations).toEqual([])
  })

  it('no muta el documento externo durante parsing o presupuesto', () => {
    const raw = structuredClone(futurePlanFixtures.FUTURE_PRODUCT_WITH_EXTRA_FIELD)
    const before = structuredClone(raw)
    createTravelBudget(parseTravelPlan(fixtureId, raw), estimates)
    expect(raw).toEqual(before)
  })

  it('rechaza campos esenciales inválidos en vez de publicar un fallback engañoso', () => {
    expect(() => parseTravelPlan(fixtureId, { ...futurePlanFixtures.NEW_UNKNOWN_CATEGORY, travelerCount: 3 })).toThrow('cantidad de viajeros')
    expect(() => parseTravelPlan(fixtureId, { ...futurePlanFixtures.NEW_UNKNOWN_CATEGORY, name: '' })).toThrow('nombre')
    expect(() => parseTravelPlan(fixtureId, { ...futurePlanFixtures.NEW_UNKNOWN_CATEGORY, priceType: 'PUBLISHED' })).toThrow('tipo de precio')
    expect(() => parseTravelPlan(fixtureId, { ...futurePlanFixtures.NEW_UNKNOWN_CATEGORY, sources: undefined })).toThrow('fuentes')
  })
})
