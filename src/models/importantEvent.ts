export type ImportantEventType = 'REGISTRATION' | 'SIMULATOR' | 'SALE' | 'PRE_SALE' | 'FESTIVAL' | 'ANNOUNCEMENT'
export type ImportantEventStatus = 'CANCELLED'
export type ImportantEventApplicability =
  | { scope: 'ALL' }
  | { scope: 'PLAN_CATEGORIES'; planCategories: PlanCategory[] }
  | { scope: 'PLAN_IDS'; planIds: string[] }

export interface ImportantEvent {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt?: string
  timeZone: 'America/Sao_Paulo'
  type: ImportantEventType
  sourceName: string
  sourceUrl: string
  priority: number
  isFeatured: boolean
  appliesTo: ImportantEventApplicability
  status?: ImportantEventStatus
  sourceObservedAt?: string
  verifiedAt: string
  updatedAt: string
}

const allowedOfficialHosts = new Set(['tomorrowland.com', 'www.tomorrowland.com', 'brasil.tomorrowland.com'])

export function isOfficialTomorrowlandUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && allowedOfficialHosts.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function validateImportantEvent(event: ImportantEvent): string[] {
  const errors: string[] = []
  if (!event.id.trim() || !/^[a-z0-9-]+$/.test(event.id)) errors.push('El ID del acontecimiento no es válido.')
  if (!event.title.trim()) errors.push('El acontecimiento debe tener título.')
  if (!event.description.trim()) errors.push('El acontecimiento debe tener descripción.')
  if (!isValidEventDate(event.startsAt)) errors.push('La fecha de inicio no es válida.')
  if (event.endsAt && !isValidEventDate(event.endsAt)) errors.push('La fecha de término no es válida.')
  if (event.endsAt && isValidEventDate(event.startsAt) && isValidEventDate(event.endsAt) && comparableTime(event.endsAt) < comparableTime(event.startsAt)) errors.push('La fecha de término no puede ser anterior al inicio.')
  if (event.timeZone !== 'America/Sao_Paulo') errors.push('El acontecimiento debe utilizar la zona horaria de São Paulo.')
  if (!['REGISTRATION', 'SIMULATOR', 'SALE', 'PRE_SALE', 'FESTIVAL', 'ANNOUNCEMENT'].includes(event.type)) errors.push('El tipo de acontecimiento no es válido.')
  if (!event.sourceName.trim()) errors.push('El acontecimiento requiere una fuente oficial.')
  if (!isOfficialTomorrowlandUrl(event.sourceUrl)) errors.push('La URL debe pertenecer a una fuente oficial de Tomorrowland.')
  if (!Number.isInteger(event.priority) || event.priority < 0) errors.push('La prioridad debe ser un entero no negativo.')
  if (typeof event.isFeatured !== 'boolean') errors.push('El indicador destacado no es válido.')
  errors.push(...validateImportantEventApplicability(event.appliesTo))
  if (event.status !== undefined && event.status !== 'CANCELLED') errors.push('El estado del acontecimiento no es válido.')
  if (event.sourceObservedAt !== undefined && !isTimestamp(event.sourceObservedAt)) errors.push('La fecha de observación de la fuente no es válida.')
  if (!isCivilDate(event.verifiedAt) || !isCivilDate(event.updatedAt)) errors.push('Las fechas de trazabilidad no son válidas.')
  return errors
}

export function validateImportantEventApplicability(value: ImportantEventApplicability): string[] {
  if (!value || typeof value !== 'object') return ['La aplicabilidad del acontecimiento no es válida.']
  const keys = Object.keys(value)
  if (value.scope === 'ALL') return keys.length === 1 ? [] : ['La aplicabilidad ALL no admite filtros adicionales.']
  if (value.scope === 'PLAN_CATEGORIES') {
    if (keys.some((key) => !['scope', 'planCategories'].includes(key)) || !Array.isArray(value.planCategories) || value.planCategories.length === 0) return ['La aplicabilidad por categoría requiere categorías válidas.']
    if (new Set(value.planCategories).size !== value.planCategories.length || value.planCategories.some((category) => !['GLOBAL_JOURNEY', 'SEPARATE_PURCHASE'].includes(category))) return ['La aplicabilidad contiene categorías de plan inválidas.']
    return []
  }
  if (value.scope === 'PLAN_IDS') {
    if (keys.some((key) => !['scope', 'planIds'].includes(key)) || !Array.isArray(value.planIds) || value.planIds.length === 0) return ['La aplicabilidad por plan requiere IDs válidos.']
    if (new Set(value.planIds).size !== value.planIds.length || value.planIds.some((id) => typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(id) || id.length > 100)) return ['La aplicabilidad contiene IDs de plan inválidos.']
    return []
  }
  return ['El alcance de aplicabilidad no es válido.']
}

export function assertValidImportantEvent(event: ImportantEvent): ImportantEvent {
  const errors = validateImportantEvent(event)
  if (errors.length > 0) throw new Error(`Acontecimiento inválido (${event.id}): ${errors.join(' ')}`)
  return event
}

export function isCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isValidEventDate(value: string): boolean {
  if (isCivilDate(value)) return true
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{3})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match || !isCivilDate(match[1])) return false
  const hour = Number(match[2]); const minute = Number(match[3]); const second = Number(match[4])
  return hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value))
}

function isTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

function comparableTime(value: string): number {
  if (isCivilDate(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Date.parse(value)
}
import type { PlanCategory } from './plan.js'
