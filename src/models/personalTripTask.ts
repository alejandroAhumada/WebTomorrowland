import type { TravelPlan } from './plan.js'
import type { BudgetCategory, BudgetScope } from './travelBudget.js'
import { planIncludesAccommodation } from './travelBudget.js'

export type PersonalTripTaskType = 'DOCUMENTATION' | 'FLIGHT' | 'EXTERNAL_ACCOMMODATION' | 'TRAVEL_INSURANCE' | 'LOCAL_TRANSPORT' | 'PAYMENT_METHOD' | 'LUGGAGE' | 'FLIGHT_CHECK_IN'
export type PersonalTripTaskApplicability = 'ALL' | 'REQUIRES_EXTERNAL_ACCOMMODATION' | 'FLIGHT_REQUIRED'
export type PersonalTripTaskStatus = 'PENDING' | 'COMPLETED'
export type ExpenseTracking = BudgetScope | 'NONE'

export interface PersonalTripTaskDefinition {
  id: string
  type: PersonalTripTaskType
  title: string
  description?: string
  applicability: PersonalTripTaskApplicability
  expenseTracking: ExpenseTracking
  budgetCategory?: BudgetCategory
}

export interface PersonalTripTask extends PersonalTripTaskDefinition {
  status: PersonalTripTaskStatus
  completedAt?: string
}

export const personalTripTaskDefinitions: readonly PersonalTripTaskDefinition[] = [
  { id: 'documentation', type: 'DOCUMENTATION', title: 'Revisar documentación de viaje', description: 'Comprueba con anticipación la documentación aplicable a tu viaje.', applicability: 'ALL', expenseTracking: 'NONE' },
  { id: 'flight', type: 'FLIGHT', title: 'Comprar vuelos', description: 'Organiza el vuelo entre Santiago y São Paulo.', applicability: 'FLIGHT_REQUIRED', expenseTracking: 'PER_PERSON', budgetCategory: 'FLIGHT' },
  { id: 'external-accommodation', type: 'EXTERNAL_ACCOMMODATION', title: 'Reservar alojamiento externo', description: 'Esta alternativa no incluye alojamiento dentro del paquete.', applicability: 'REQUIRES_EXTERNAL_ACCOMMODATION', expenseTracking: 'PER_GROUP', budgetCategory: 'EXTERNAL_ACCOMMODATION' },
  { id: 'travel-insurance', type: 'TRAVEL_INSURANCE', title: 'Evaluar o contratar seguro de viaje', applicability: 'ALL', expenseTracking: 'PER_PERSON' },
  { id: 'local-transport', type: 'LOCAL_TRANSPORT', title: 'Organizar transporte local', description: 'Planifica los traslados que no estén cubiertos por el paquete.', applicability: 'ALL', expenseTracking: 'PER_GROUP', budgetCategory: 'LOCAL_TRANSPORT' },
  { id: 'payment-method', type: 'PAYMENT_METHOD', title: 'Preparar medios de pago', description: 'Revisa tarjetas, efectivo y reales para los gastos del viaje.', applicability: 'ALL', expenseTracking: 'NONE' },
  { id: 'luggage', type: 'LUGGAGE', title: 'Preparar equipaje', applicability: 'ALL', expenseTracking: 'NONE' },
  { id: 'flight-check-in', type: 'FLIGHT_CHECK_IN', title: 'Realizar check-in del vuelo', applicability: 'FLIGHT_REQUIRED', expenseTracking: 'NONE' },
]

export function buildPersonalTripTasks(plan: TravelPlan): PersonalTripTaskDefinition[] {
  return personalTripTaskDefinitions
    .filter((task) => taskApplies(task, plan))
    .map((task) => ({ ...task }))
}

export function taskApplies(task: PersonalTripTaskDefinition, plan: TravelPlan): boolean {
  if (task.applicability === 'ALL') return true
  if (task.applicability === 'REQUIRES_EXTERNAL_ACCOMMODATION') return !planIncludesAccommodation(plan)
  if (task.applicability === 'FLIGHT_REQUIRED') return true
  return false
}

export function isPersonalTripTaskId(value: unknown): value is string {
  return typeof value === 'string' && personalTripTaskDefinitions.some((task) => task.id === value)
}

export function getPersonalTripTaskDefinition(taskId: string): PersonalTripTaskDefinition | null {
  return personalTripTaskDefinitions.find((task) => task.id === taskId) ?? null
}
