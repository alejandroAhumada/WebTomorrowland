import type { BudgetEstimate } from '../models/travelBudget'

const updatedAt = '2026-08-22'

export const standardTravelDuration = { days: 5, nights: 4 } as const

export const initialTravelBudgetEstimates: BudgetEstimate[] = [
  { category: 'FLIGHT', money: { amount: 400000, currency: 'CLP' }, scope: 'PER_PERSON', unit: 'TRIP', quantity: 1, description: 'Vuelo ida y vuelta Santiago (SCL) ↔ São Paulo.', updatedAt },
  { category: 'EXTERNAL_ACCOMMODATION', money: { amount: 70000, currency: 'CLP' }, scope: 'PER_GROUP', unit: 'NIGHT', quantity: standardTravelDuration.nights, description: 'Alojamiento externo referencial por habitación/grupo.', updatedAt },
  { category: 'LOCAL_TRANSPORT', money: { amount: 120000, currency: 'CLP' }, scope: 'PER_GROUP', unit: 'TRIP', quantity: 1, description: 'Traslados referenciales aeropuerto, alojamiento y terminales.', updatedAt },
  { category: 'FOOD', money: { amount: 36000, currency: 'CLP' }, scope: 'PER_PERSON', unit: 'DAY', quantity: standardTravelDuration.days, description: 'Alimentación referencial durante el viaje.', updatedAt },
  { category: 'PERSONAL_EXPENSES', money: { amount: 150000, currency: 'CLP' }, scope: 'PER_PERSON', unit: 'TRIP', quantity: 1, description: 'Margen referencial para gastos personales.', updatedAt },
]
