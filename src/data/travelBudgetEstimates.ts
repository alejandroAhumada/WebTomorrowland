import type { BudgetEstimate } from '../models/travelBudget'
import type { BudgetPreferences } from '../models/budgetPreferences'

const updatedAt = '2026-08-22'

export const defaultBudgetPreferences: BudgetPreferences = {
  days: 5,
  nights: 4,
  flightPerPerson: 400000,
  accommodationPerNight: 70000,
  localTransportPerGroup: 120000,
  foodPerPersonPerDay: 36000,
  personalExpensesPerPerson: 150000,
}

export function createTravelBudgetEstimates(preferences: BudgetPreferences): BudgetEstimate[] {
  return [
    { category: 'FLIGHT', money: { amount: preferences.flightPerPerson, currency: 'CLP' }, scope: 'PER_PERSON', unit: 'TRIP', quantity: 1, description: 'Vuelo ida y vuelta Santiago (SCL) ↔ São Paulo.', updatedAt },
    { category: 'EXTERNAL_ACCOMMODATION', money: { amount: preferences.accommodationPerNight, currency: 'CLP' }, scope: 'PER_GROUP', unit: 'NIGHT', quantity: preferences.nights, description: 'Alojamiento externo referencial por habitación/grupo.', updatedAt },
    { category: 'LOCAL_TRANSPORT', money: { amount: preferences.localTransportPerGroup, currency: 'CLP' }, scope: 'PER_GROUP', unit: 'TRIP', quantity: 1, description: 'Traslados referenciales aeropuerto, alojamiento y terminales.', updatedAt },
    { category: 'FOOD', money: { amount: preferences.foodPerPersonPerDay, currency: 'CLP' }, scope: 'PER_PERSON', unit: 'DAY', quantity: preferences.days, description: 'Alimentación referencial durante el viaje.', updatedAt },
    { category: 'PERSONAL_EXPENSES', money: { amount: preferences.personalExpensesPerPerson, currency: 'CLP' }, scope: 'PER_PERSON', unit: 'TRIP', quantity: 1, description: 'Margen referencial para gastos personales.', updatedAt },
  ]
}

export const initialTravelBudgetEstimates = createTravelBudgetEstimates(defaultBudgetPreferences)
