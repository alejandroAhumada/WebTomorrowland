import { isOfficialTomorrowlandUrl, isCivilDate } from './importantEvent.js'
import type { ImportantEventApplicability } from './importantEvent.js'
import { validateImportantEventApplicability } from './importantEvent.js'

export type ImportantInformationCategory = 'TICKETS' | 'DELIVERY' | 'TREASURE_CASE' | 'WRISTBANDS' | 'PAYMENT_INFORMATION' | 'TRANSPORT' | 'ACCOMMODATION' | 'GENERAL'
export interface ImportantInformation {
  id: string
  title: string
  summary: string
  details: string[]
  category: ImportantInformationCategory
  sourceName: 'Tomorrowland Brasil'
  sourceUrl: string
  sourceObservedAt: string
  effectiveFrom?: string
  effectiveUntil?: string
  priority: number
  highlighted: boolean
  appliesTo: ImportantEventApplicability
  relatedEventId?: string
  updatedAt: string
}

export function validateImportantInformation(item: ImportantInformation): string[] {
  const errors: string[] = []
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) errors.push('El ID de información no es válido.')
  if (!item.title.trim() || !item.summary.trim() || !Array.isArray(item.details) || item.details.length === 0 || item.details.some((value) => typeof value !== 'string' || !value.trim() || value.length > 700)) errors.push('El contenido informativo no es válido.')
  if (!['TICKETS', 'DELIVERY', 'TREASURE_CASE', 'WRISTBANDS', 'PAYMENT_INFORMATION', 'TRANSPORT', 'ACCOMMODATION', 'GENERAL'].includes(item.category)) errors.push('La categoría informativa no es válida.')
  if (item.sourceName !== 'Tomorrowland Brasil' || !isOfficialTomorrowlandUrl(item.sourceUrl)) errors.push('La información requiere una fuente oficial.')
  if (!isTimestamp(item.sourceObservedAt) || !isCivilDate(item.updatedAt)) errors.push('La trazabilidad no es válida.')
  if (item.effectiveFrom && !isCivilDate(item.effectiveFrom)) errors.push('effectiveFrom no es válido.')
  if (item.effectiveUntil && !isCivilDate(item.effectiveUntil)) errors.push('effectiveUntil no es válido.')
  if (item.effectiveFrom && item.effectiveUntil && item.effectiveUntil < item.effectiveFrom) errors.push('El rango efectivo no es válido.')
  if (!Number.isInteger(item.priority) || item.priority < 0 || typeof item.highlighted !== 'boolean') errors.push('La prioridad o destacado no son válidos.')
  errors.push(...validateImportantEventApplicability(item.appliesTo))
  if (item.relatedEventId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.relatedEventId)) errors.push('relatedEventId no es válido.')
  return errors
}

export function assertValidImportantInformation(item: ImportantInformation): ImportantInformation {
  const errors = validateImportantInformation(item)
  if (errors.length) throw new Error(`Información importante inválida (${item.id}): ${errors.join(' ')}`)
  return item
}

function isTimestamp(value: string): boolean { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) }
