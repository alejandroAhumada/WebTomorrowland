import type { Money, PlanCategory, PlanStatus } from '../models/plan'
export function formatMoney(money: Money): string { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: money.currency, maximumFractionDigits: 0 }).format(money.amount) }
export function formatDate(value: string): string { return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago' }).format(new Date(value)) }
export const categoryLabels: Record<PlanCategory, string> = { GLOBAL_JOURNEY: 'Global Journey', SEPARATE_PURCHASE: 'Compra separada' }
export const statusLabels: Record<PlanStatus, string> = { AVAILABLE: 'Disponible', COMING_SOON: 'Próximamente', UNAVAILABLE: 'No disponible' }
