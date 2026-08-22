import type { BudgetEstimate } from '../models/travelBudget'

const updatedAt = '2026-08-22'

export const initialTravelBudgetEstimates: BudgetEstimate[] = [
  { category: 'FLIGHT', money: { amount: 400000, currency: 'CLP' }, scope: 'PER_PERSON', description: 'Vuelo ida y vuelta Santiago (SCL) ↔ São Paulo.', updatedAt },
  { category: 'LOCAL_TRANSPORT', money: { amount: 120000, currency: 'CLP' }, scope: 'PER_GROUP', description: 'Traslados referenciales aeropuerto, alojamiento y terminales.', updatedAt },
  { category: 'FOOD', money: { amount: 180000, currency: 'CLP' }, scope: 'PER_PERSON', description: 'Alimentación referencial durante el viaje.', updatedAt },
  { category: 'PERSONAL_EXPENSES', money: { amount: 150000, currency: 'CLP' }, scope: 'PER_PERSON', description: 'Margen referencial para gastos personales.', updatedAt },
]
