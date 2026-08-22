import { createHash } from 'node:crypto'
import type { EventSyncProposal, EventSyncResponse } from '../functions/src/eventSync'
import { initialImportantEvents } from '../src/data/importantEvents'
import type { ImportantEvent, ImportantEventApplicability, ImportantEventType } from '../src/models/importantEvent'
import {
  officialResearchUrl, sanitizeResearchError, type FetchedOfficialPage,
} from './tomorrowlandResearch'

export const EVENT_SYNC_API_URL = 'https://synctomorrowlandevent-roe56dc57a-uc.a.run.app'

export interface EventResearchSource {
  id: string
  url: string
  kind: 'SALES' | 'FESTIVAL'
}

export const EVENT_RESEARCH_SOURCES: EventResearchSource[] = [
  {
    id: 'important-sales-2027',
    url: 'https://brasil.tomorrowland.com/en/sales/sales-dates/',
    kind: 'SALES',
  },
  {
    id: 'festival-dates-2027',
    url: 'https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/',
    kind: 'FESTIVAL',
  },
]

export interface DetectedImportantEvent {
  eventId: string
  title: string
  startsAt: string
  endsAt?: string
  type: ImportantEventType
  sourceUrl: string
  excerpt: string
  sourceHash: string
  operation: 'CREATE' | 'UPDATE'
  evidenceKind: 'CREATE' | 'CONFIRMATION' | 'RESCHEDULE' | 'CANCELLATION'
  status?: 'CANCELLED'
  appliesTo?: ImportantEventApplicability
}

export interface EventSourceResearchResult {
  sourceId: string
  sourceUrl: string
  hash: string
  status: 'NO_SOURCE_CHANGE' | 'SOURCE_CHANGED_NO_EVENT_CHANGE' | 'PROPOSAL_CREATED' | 'FETCH_FAILED' | 'PARSE_FAILED'
  detected: DetectedImportantEvent[]
  proposals: EventSyncProposal[]
  notes: string[]
  error?: string
}

export interface EventSyncApiClient {
  submit(proposal: EventSyncProposal, dryRun: boolean): Promise<EventSyncResponse>
}

const knownEvents = new Map(initialImportantEvents.map((event) => [event.id, event]))
const monthNumbers: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

export function researchEventSource(
  source: EventResearchSource,
  page: FetchedOfficialPage,
  previousHash?: string,
): EventSourceResearchResult {
  try {
    const text = pageText(page.html)
    if (!/Tomorrowland\s+Brasil\s+2027/i.test(text)) throw new Error('La fuente no identifica Tomorrowland Brasil 2027.')
    const detected = source.kind === 'SALES'
      ? detectSalesEvents(text, page.url)
      : detectFestivalEvent(text, page.url)
    const notes: string[] = []
    const proposals: EventSyncProposal[] = []

    for (const event of detected) {
      if (!event.appliesTo) {
        notes.push(`${event.eventId}: no se propuso porque la fuente no demuestra su aplicabilidad a planes existentes.`)
        continue
      }
      const known = knownEvents.get(event.eventId)
      if (known && datesDiffer(event, known) && event.evidenceKind === 'CONFIRMATION') {
        notes.push(`${event.eventId}: se detectó una fecha distinta sin evidencia explícita de reprogramación.`)
        continue
      }
      proposals.push(buildEventProposal(event, sourceObservedAt(page)))
    }

    const hash = eventSourceHash(source.id, detected)
    return {
      sourceId: source.id,
      sourceUrl: page.url,
      hash,
      status: previousHash === hash
        ? 'NO_SOURCE_CHANGE'
        : proposals.length ? 'PROPOSAL_CREATED' : 'SOURCE_CHANGED_NO_EVENT_CHANGE',
      detected,
      proposals,
      notes,
    }
  } catch (error) {
    return {
      sourceId: source.id,
      sourceUrl: page.url,
      hash: '',
      status: 'PARSE_FAILED',
      detected: [],
      proposals: [],
      notes: [],
      error: sanitizeResearchError(error),
    }
  }
}

export function detectSalesEvents(text: string, sourceUrl: string): DetectedImportantEvent[] {
  const events: DetectedImportantEvent[] = []
  const patterns: Array<{ id: string; title: string; type: ImportantEventType; appliesTo: ImportantEventApplicability; pattern: RegExp }> = [
    {
      id: 'global-journey-simulator-2027', title: 'Simulador Global Journey', type: 'SIMULATOR',
      appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: ['GLOBAL_JOURNEY'] },
      pattern: /(?:Global Journey[^.]{0,180})?(?:Price )?Simulator[^.]{0,180}?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2026\s*(?:-|at)\s*\d{1,2}:\d{2}\s*BRT)/i,
    },
    {
      id: 'global-journey-sale-2027', title: 'Venta Global Journey', type: 'SALE',
      appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: ['GLOBAL_JOURNEY'] },
      pattern: /Global Journey(?:\s+Travel Packages)?\s+Sale(?:(?!Simulator)[^.]){0,180}?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2026\s*(?:-|at)\s*\d{1,2}:\d{2}\s*BRT)/i,
    },
    {
      id: 'bybit-pre-sale-2027', title: 'Preventa exclusiva Bybit', type: 'PRE_SALE',
      appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: ['SEPARATE_PURCHASE'] },
      pattern: /(?:Exclusive\s+)?Bybit\s+Pre-Sale[^.]{0,180}?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2026\s*(?:-|at)\s*\d{1,2}:\d{2}\s*BRT)/i,
    },
    {
      id: 'worldwide-ticket-sale-2027', title: 'Venta mundial de tickets', type: 'SALE',
      appliesTo: { scope: 'PLAN_CATEGORIES', planCategories: ['SEPARATE_PURCHASE'] },
      pattern: /World(?:\s|-)?Wide\s+Ticket\s+Sale[^.]{0,180}?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2026\s*(?:-|at)\s*\d{1,2}:\d{2}\s*BRT)/i,
    },
  ]

  const registration = text.match(/(?:pre-register\s+from|Pre-Registration[^.]{0,400}?from)\s+(April\s+30,\s+2026\s*(?:-|at)\s*10:00\s*BRT)[^.]{0,160}?until\s+(September\s+23,\s+2026\s*(?:-|at)\s*23:59\s*BRT)/i)
  if (registration) {
    events.push(detectedKnown('pre-registration-2027', 'Pre-registro Tomorrowland Brasil 2027', 'REGISTRATION', registration[1], sourceUrl, registration[0], { scope: 'ALL' }, registration[2]))
  }

  for (const definition of patterns) {
    const match = text.match(definition.pattern)
    if (match) events.push(detectedKnown(definition.id, definition.title, definition.type, match[1], sourceUrl, match[0], definition.appliesTo))
  }

  const cancellationLabels = [
    ['global-journey-sale-2027', 'Global Journey(?: Travel Packages)? Sale'],
    ['bybit-pre-sale-2027', '(?:Exclusive )?Bybit Pre-Sale'],
    ['worldwide-ticket-sale-2027', 'World(?:\\s|-)?Wide Ticket Sale'],
  ] as const
  for (const [eventId, label] of cancellationLabels) {
    const cancellation = text.match(new RegExp(`${label}[^.]{0,180}(?:has been |is )?(?:cancelled|canceled)`, 'i'))
    if (!cancellation) continue
    const known = knownEvents.get(eventId)!
    const excerpt = evidenceExcerpt(cancellation[0])
    const replacement: DetectedImportantEvent = {
      eventId, title: known.title, startsAt: known.startsAt, ...(known.endsAt ? { endsAt: known.endsAt } : {}),
      type: known.type, sourceUrl, excerpt, sourceHash: evidenceHash(excerpt), operation: 'UPDATE',
      evidenceKind: 'CANCELLATION', status: 'CANCELLED',
      appliesTo: known.appliesTo,
    }
    const index = events.findIndex((event) => event.eventId === eventId)
    if (index >= 0) events[index] = replacement
    else events.push(replacement)
  }

  events.push(...detectGenericSales(text, sourceUrl, new Set(events.map((event) => event.eventId))))
  return events
}

export function detectFestivalEvent(text: string, sourceUrl: string): DetectedImportantEvent[] {
  const match = text.match(/Tomorrowland\s+Brasil\s+2027[^.]{0,300}?(?:from\s+)?(April\s+30)(?:,\s*2027)?\s+(?:to|-|until)\s+(May\s+2,\s+2027)/i)
    ?? text.match(/(?:from\s+)?(April\s+30)(?:,\s*2027)?\s+(?:to|-|until)\s+(May\s+2,\s+2027)[^.]{0,300}?Tomorrowland\s+Brasil\s+2027/i)
  if (!match) return []
  const start = parseOfficialDate(`${match[1]}, 2027`)
  const end = parseOfficialDate(match[2])
  const excerpt = evidenceExcerpt(match[0])
  return [{
    eventId: 'tomorrowland-brasil-2027', title: 'Tomorrowland Brasil 2027', startsAt: start,
    endsAt: end, type: 'FESTIVAL', sourceUrl, excerpt, sourceHash: evidenceHash(excerpt),
    operation: 'UPDATE', evidenceKind: evidenceKind(excerpt),
    appliesTo: { scope: 'ALL' },
  }]
}

export function parseOfficialDate(input: string): string {
  const match = input.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s*(?:-|at)\s*(\d{1,2}):(\d{2})\s*BRT)?$/i)
  if (!match) throw new Error(`Fecha oficial no reconocida: ${input}.`)
  const month = monthNumbers[match[1].toLowerCase()]
  const day = Number(match[2])
  const year = Number(match[3])
  const hour = match[4] === undefined ? undefined : Number(match[4])
  const minute = match[5] === undefined ? undefined : Number(match[5])
  if (!month || !validCalendarDate(year, Number(month), day) || (hour !== undefined && (hour > 23 || minute! > 59))) {
    throw new Error(`Fecha oficial inválida: ${input}.`)
  }
  const date = `${year}-${month}-${String(day).padStart(2, '0')}`
  return hour === undefined ? date : `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`
}

export function buildEventProposal(event: DetectedImportantEvent, observedAt: string): EventSyncProposal {
  if (!event.appliesTo) throw new Error('La evidencia oficial no permite determinar appliesTo.')
  const known = knownEvents.get(event.eventId)
  const changes: EventSyncProposal['changes'] = event.operation === 'CREATE'
    ? {
        title: event.title,
        description: `Hito oficial de Tomorrowland Brasil 2027: ${event.title}.`,
        startsAt: event.startsAt,
        ...(event.endsAt ? { endsAt: event.endsAt } : {}),
        timeZone: 'America/Sao_Paulo',
        type: event.type,
        priority: defaultPriority(event.type),
        isFeatured: event.type !== 'ANNOUNCEMENT',
        appliesTo: event.appliesTo,
      }
    : {
        startsAt: event.startsAt,
        ...(event.endsAt ? { endsAt: event.endsAt } : {}),
        ...(event.status ? { status: event.status } : {}),
        appliesTo: event.appliesTo,
      }
  const fingerprint = JSON.stringify({ eventId: event.eventId, operation: event.operation, changes, sourceUrl: event.sourceUrl, sourceHash: event.sourceHash, observedAt })
  return {
    proposalId: `event-research-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`,
    eventId: event.eventId,
    observedAt,
    source: { url: officialResearchUrl(event.sourceUrl), type: 'OFFICIAL', publisher: 'Tomorrowland' },
    operation: known ? 'UPDATE' : event.operation,
    changes,
    evidence: { excerpt: event.excerpt, sourceHash: event.sourceHash, kind: event.evidenceKind },
  }
}

export function eventSourceHash(sourceId: string, detected: DetectedImportantEvent[]): string {
  const stable = detected.map(({ eventId, startsAt, endsAt, status, sourceHash, appliesTo }) => ({ eventId, startsAt, endsAt, status, sourceHash, appliesTo }))
  return createHash('sha256').update(JSON.stringify({ sourceId, detected: stable })).digest('hex')
}

export function createEventSyncApiClient(token: string, fetchImpl: typeof fetch = fetch, endpoint = EVENT_SYNC_API_URL): EventSyncApiClient {
  if (!token.trim()) throw new Error('Falta el ID token para Important Events Sync API.')
  return {
    async submit(proposal, dryRun) {
      const response = await fetchImpl(`${endpoint}${dryRun ? '?dryRun=true' : ''}`, {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal),
      })
      const payload = await response.json().catch(() => null) as EventSyncResponse | null
      if (!response.ok || !payload?.result) throw new Error(`Important Events Sync API falló con HTTP ${response.status}.`)
      return payload
    },
  }
}

export async function processEventProposal(
  client: EventSyncApiClient,
  proposal: EventSyncProposal,
  applyChanges: boolean,
): Promise<{ dryRun: EventSyncResponse; applied?: EventSyncResponse }> {
  const dryRun = await client.submit(proposal, true)
  if (!['CREATED', 'UPDATED'].includes(dryRun.result) || !applyChanges) return { dryRun }
  const applied = await client.submit(proposal, false)
  if (!['CREATED', 'UPDATED', 'ALREADY_PROCESSED'].includes(applied.result)) {
    throw new Error(`Important Events Sync API no aplicó la propuesta: ${applied.result}.`)
  }
  return { dryRun, applied }
}

function detectedKnown(id: string, title: string, type: ImportantEventType, start: string, sourceUrl: string, raw: string, appliesTo: ImportantEventApplicability, end?: string): DetectedImportantEvent {
  const excerpt = evidenceExcerpt(raw)
  return {
    eventId: id, title, type, startsAt: parseOfficialDate(start), ...(end ? { endsAt: parseOfficialDate(end) } : {}),
    sourceUrl, excerpt, sourceHash: evidenceHash(excerpt), operation: 'UPDATE', evidenceKind: evidenceKind(excerpt), appliesTo,
    ...(/cancelled|canceled|cancelad[ao]/i.test(excerpt) ? { status: 'CANCELLED' as const } : {}),
  }
}

function detectGenericSales(text: string, sourceUrl: string, knownIds: Set<string>): DetectedImportantEvent[] {
  const result: DetectedImportantEvent[] = []
  const pattern = /([A-Z][A-Za-z0-9&' -]{2,100}(?:Pre-Sale|Sale|Pre-Registration|Simulator))[^.]{0,160}?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(2026|2027)\s*(?:-|at)\s*(\d{1,2}):(\d{2})\s*BRT/gi
  for (const match of text.matchAll(pattern)) {
    const title = match[1].trim().replace(/\s+/g, ' ')
    if (/Tomorrowland Brasil|Global Journey|Bybit|World(?:\s|-)?Wide|Pre-Registration/i.test(title)) continue
    const type = classifyTitle(title)
    if (!type) continue
    const id = semanticEventId(title)
    if (knownIds.has(id) || knownEvents.has(id)) continue
    const excerpt = evidenceExcerpt(match[0])
    result.push({
      eventId: id, title, type,
      startsAt: parseOfficialDate(`${match[2]} ${match[3]}, ${match[4]} - ${match[5]}:${match[6]} BRT`),
      sourceUrl, excerpt, sourceHash: evidenceHash(excerpt), operation: 'CREATE', evidenceKind: 'CREATE',
    })
  }
  return result
}

function classifyTitle(title: string): ImportantEventType | null {
  if (/pre-registration/i.test(title)) return 'REGISTRATION'
  if (/simulator/i.test(title)) return 'SIMULATOR'
  if (/pre-sale/i.test(title)) return 'PRE_SALE'
  if (/sale/i.test(title)) return 'SALE'
  return null
}

function semanticEventId(title: string): string {
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-2027`
}

function evidenceExcerpt(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 430)
  return `Tomorrowland Brasil 2027 · ${normalized}`.slice(0, 500)
}

function evidenceHash(excerpt: string): string { return createHash('sha256').update(excerpt).digest('hex') }
function evidenceKind(excerpt: string): DetectedImportantEvent['evidenceKind'] {
  if (/(cancelled|canceled|cancelad[ao])/i.test(excerpt)) return 'CANCELLATION'
  if (/(reschedul|new date|nova data|reprogram|postpon|adiad|alterad[ao])/i.test(excerpt)) return 'RESCHEDULE'
  return 'CONFIRMATION'
}
function sourceObservedAt(page: FetchedOfficialPage): string {
  const lastModified = page.lastModified ? Date.parse(page.lastModified) : Number.NaN
  return Number.isFinite(lastModified) ? new Date(lastModified).toISOString() : page.fetchedAt
}
function datesDiffer(event: DetectedImportantEvent, known: ImportantEvent): boolean { return event.startsAt !== known.startsAt || event.endsAt !== known.endsAt }
function defaultPriority(type: ImportantEventType): number { return type === 'FESTIVAL' ? 100 : type === 'SALE' ? 85 : type === 'PRE_SALE' ? 75 : 70 }
function validCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
function pageText(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
