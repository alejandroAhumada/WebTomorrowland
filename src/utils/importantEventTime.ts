import type { ImportantEvent } from '../models/importantEvent'

export type ImportantEventState = 'UPCOMING' | 'TODAY' | 'PAST'

export function sortImportantEvents(events: readonly ImportantEvent[]): ImportantEvent[] {
  return [...events].sort((left, right) => compareEventStarts(left, right) || right.priority - left.priority || left.title.localeCompare(right.title, 'es'))
}

export function getImportantEventState(event: ImportantEvent, now = new Date()): ImportantEventState {
  const today = civilDateInTimeZone(now, event.timeZone)
  const startDate = event.startsAt.slice(0, 10)
  const endDate = (event.endsAt ?? event.startsAt).slice(0, 10)
  if (today < startDate) return 'UPCOMING'
  if (today > endDate) return 'PAST'
  if (today === startDate && event.startsAt.includes('T') && now.getTime() < Date.parse(event.startsAt)) return 'UPCOMING'
  return 'TODAY'
}

export function getNextImportantEvent(events: readonly ImportantEvent[], now = new Date()): ImportantEvent | null {
  const active = sortImportantEvents(events).filter((event) => getImportantEventState(event, now) !== 'PAST')
  return active.find((event) => getImportantEventState(event, now) === 'TODAY') ?? active[0] ?? null
}

export function getDaysUntilEvent(event: ImportantEvent, now = new Date()): number {
  const today = civilDateInTimeZone(now, event.timeZone)
  return Math.max(0, differenceInCivilDays(today, event.startsAt.slice(0, 10)))
}

export function getDaysUntilEventEnds(event: ImportantEvent, now = new Date()): number {
  const today = civilDateInTimeZone(now, event.timeZone)
  return Math.max(0, differenceInCivilDays(today, (event.endsAt ?? event.startsAt).slice(0, 10)))
}

export function formatImportantEventDate(event: ImportantEvent, locale = 'es-CL'): string {
  const start = formatCivilDate(event.startsAt.slice(0, 10), locale)
  const end = event.endsAt ? formatCivilDate(event.endsAt.slice(0, 10), locale) : null
  const time = event.startsAt.includes('T') ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: event.timeZone }).format(new Date(event.startsAt)) : null
  return `${start}${end && end !== start ? ` — ${end}` : ''}${time ? ` · ${time} hora de Brasil` : ''}`
}

export function getEventDateParts(event: ImportantEvent, locale = 'es-CL'): { day: string; month: string; year: string } {
  const [year, month, day] = event.startsAt.slice(0, 10).split('-').map(Number)
  const civil = new Date(Date.UTC(year, month - 1, day))
  return {
    day: String(day).padStart(2, '0'),
    month: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(civil).replace('.', '').toUpperCase(),
    year: String(year),
  }
}

function civilDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function differenceInCivilDays(from: string, to: string): number {
  return Math.round((civilEpoch(to) - civilEpoch(from)) / 86_400_000)
}

function civilEpoch(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function compareEventStarts(left: ImportantEvent, right: ImportantEvent): number {
  const dateDifference = left.startsAt.slice(0, 10).localeCompare(right.startsAt.slice(0, 10))
  if (dateDifference !== 0) return dateDifference
  return startTime(left.startsAt) - startTime(right.startsAt)
}

function startTime(value: string): number {
  return value.includes('T') ? Date.parse(value) : civilEpoch(value)
}

function formatCivilDate(value: string, locale: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}
