import { describe, expect, it } from 'vitest'
import { createTravelBudgetEstimates, defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import { localExchangeRates } from '../data/localExchangeRates'
import { productionPlans } from '../../scripts/productionPlans'
import { createTravelBudget } from './travelBudget'
import { budgetPreferencesStorageKey, isBudgetCustomized, parseBudgetPreferences, preferencesFromStorageChange, serializeBudgetPreferences, updateBudgetPreference, validateBudgetPreference, type BudgetPreferenceKey } from './budgetPreferences'

describe('preferencias de presupuesto', () => {
  it('usa una única configuración de defaults', () => {
    expect(defaultBudgetPreferences).toEqual({ days: 5, nights: 4, flightPerPerson: 400000, accommodationPerNight: 70000, localTransportPerGroup: 120000, foodPerPersonPerDay: 36000, personalExpensesPerPerson: 150000 })
    expect(isBudgetCustomized(defaultBudgetPreferences, defaultBudgetPreferences)).toBe(false)
  })

  it.each<[BudgetPreferenceKey, number]>([
    ['flightPerPerson', 520000], ['days', 6], ['nights', 5], ['accommodationPerNight', 90000],
    ['foodPerPersonPerDay', 45000], ['localTransportPerGroup', 180000], ['personalExpensesPerPerson', 220000],
  ])('modifica %s sin mutar preferencias previas', (key, value) => {
    const original = { ...defaultBudgetPreferences }
    const updated = updateBudgetPreference(original, key, value)
    expect(updated[key]).toBe(value)
    expect(original).toEqual(defaultBudgetPreferences)
    expect(isBudgetCustomized(updated, defaultBudgetPreferences)).toBe(true)
  })

  it('persiste v1, mezcla campos faltantes y permite reset mediante defaults', () => {
    const customized = { ...defaultBudgetPreferences, flightPerPerson: 520000 }
    expect(parseBudgetPreferences(serializeBudgetPreferences(customized), defaultBudgetPreferences)).toEqual(customized)
    expect(parseBudgetPreferences(JSON.stringify({ version: 1, values: { days: 8 } }), defaultBudgetPreferences)).toEqual({ ...defaultBudgetPreferences, days: 8 })
    expect(isBudgetCustomized({ ...defaultBudgetPreferences }, defaultBudgetPreferences)).toBe(false)
  })

  it('sincroniza cambios v1 entre pestañas e ignora otras keys', () => {
    const customized = { ...defaultBudgetPreferences, foodPerPersonPerDay: 48000 }
    expect(preferencesFromStorageChange(budgetPreferencesStorageKey, serializeBudgetPreferences(customized), defaultBudgetPreferences)).toEqual(customized)
    expect(preferencesFromStorageChange('otra:key', serializeBudgetPreferences(customized), defaultBudgetPreferences)).toBeNull()
    expect(preferencesFromStorageChange(budgetPreferencesStorageKey, null, defaultBudgetPreferences)).toEqual(defaultBudgetPreferences)
  })

  it('ignora almacenamiento corrupto, versiones desconocidas y valores inválidos', () => {
    expect(parseBudgetPreferences('{oops', defaultBudgetPreferences)).toEqual(defaultBudgetPreferences)
    expect(parseBudgetPreferences(JSON.stringify({ version: 2, values: { days: 8 } }), defaultBudgetPreferences)).toEqual(defaultBudgetPreferences)
    expect(parseBudgetPreferences(JSON.stringify({ version: 1, values: { days: -2, flightPerPerson: Infinity } }), defaultBudgetPreferences)).toEqual(defaultBudgetPreferences)
  })

  it('rechaza negativos, decimales y límites excedidos sin aplicar clamp silencioso', () => {
    expect(validateBudgetPreference('days', 0)).not.toBeNull()
    expect(validateBudgetPreference('nights', -1)).not.toBeNull()
    expect(validateBudgetPreference('flightPerPerson', 10000001)).not.toBeNull()
    expect(validateBudgetPreference('foodPerPersonPerDay', 1.5)).not.toBeNull()
    expect(updateBudgetPreference(defaultBudgetPreferences, 'days', 0)).toBe(defaultBudgetPreferences)
  })

  it('recalcula globalmente un plan con preferencias personalizadas', () => {
    const preferences = { ...defaultBudgetPreferences, flightPerPerson: 520000, days: 6, nights: 5, accommodationPerNight: 90000 }
    const fullMadness = productionPlans.find((plan) => plan.id === 'full-madness-2p-2027')!
    const budget = createTravelBudget(fullMadness, createTravelBudgetEstimates(preferences), localExchangeRates[0])
    expect(budget.items.find((item) => item.category === 'FLIGHT')?.money?.amount).toBe(520000)
    expect(budget.items.find((item) => item.category === 'FOOD')?.quantity).toBe(6)
    expect(budget.items.find((item) => item.category === 'EXTERNAL_ACCOMMODATION')?.quantity).toBe(5)
  })

  it('hotel externo solo altera Full Madness y no un plan con alojamiento incluido', () => {
    const preferences = { ...defaultBudgetPreferences, accommodationPerNight: 120000 }
    const estimates = createTravelBudgetEstimates(preferences)
    const fullMadness = createTravelBudget(productionPlans.find((plan) => plan.id === 'full-madness-1p-2027')!, estimates, localExchangeRates[0])
    const easyTent = createTravelBudget(productionPlans.find((plan) => plan.id === 'easy-tent-2p-2027')!, estimates, localExchangeRates[0])
    expect(fullMadness.items.find((item) => item.category === 'EXTERNAL_ACCOMMODATION')?.money?.amount).toBe(120000)
    expect(easyTent.items.some((item) => item.category === 'EXTERNAL_ACCOMMODATION')).toBe(false)
  })

  it('mantiene total pendiente aunque personalice componentes conocidos', () => {
    const pending = productionPlans.find((plan) => plan.id === 'global-journey-hotel-1p-2027')!
    expect(createTravelBudget(pending, createTravelBudgetEstimates({ ...defaultBudgetPreferences, flightPerPerson: 520000 })).total).toBeNull()
  })
})
