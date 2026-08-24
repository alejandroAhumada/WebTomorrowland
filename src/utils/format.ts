import type { Money, PlanCategory, PlanStatus } from '../models/plan'
export function formatMoney(money: Money): string {
  if (money.currency === 'BRL') return `R$ ${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(money.amount)}`
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: money.currency, maximumFractionDigits: 0 }).format(money.amount)
}
export function formatDate(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat('es-CL', { timeZone: dateOnly ? 'UTC' : 'America/Santiago' }).format(new Date(value))
}
export const categoryLabels: Record<PlanCategory, string> = { GLOBAL_JOURNEY: 'Global Journey', SEPARATE_PURCHASE: 'Entrada y viaje por separado' }
export const statusLabels: Record<PlanStatus, string> = { AVAILABLE: 'Disponible', COMING_SOON: 'Próximamente', UNAVAILABLE: 'No disponible' }
