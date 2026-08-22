export type ImportantEventType = 'REGISTRATION' | 'SIMULATOR' | 'SALE' | 'FESTIVAL' | 'ANNOUNCEMENT'

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
  if (!['REGISTRATION', 'SIMULATOR', 'SALE', 'FESTIVAL', 'ANNOUNCEMENT'].includes(event.type)) errors.push('El tipo de acontecimiento no es válido.')
  if (!event.sourceName.trim()) errors.push('El acontecimiento requiere una fuente oficial.')
  if (!isOfficialTomorrowlandUrl(event.sourceUrl)) errors.push('La URL debe pertenecer a una fuente oficial de Tomorrowland.')
  if (!Number.isInteger(event.priority) || event.priority < 0) errors.push('La prioridad debe ser un entero no negativo.')
  if (typeof event.isFeatured !== 'boolean') errors.push('El indicador destacado no es válido.')
  if (!isCivilDate(event.verifiedAt) || !isCivilDate(event.updatedAt)) errors.push('Las fechas de trazabilidad no son válidas.')
  return errors
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

function comparableTime(value: string): number {
  if (isCivilDate(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Date.parse(value)
}
