import { createHash } from 'node:crypto'
import { assertValidImportantEvent, type ImportantEvent, type ImportantEventStatus, type ImportantEventType } from '../../src/models/importantEvent.js'
import { officialSourceUrl } from './planSync.js'

const proposalKeys = new Set(['proposalId', 'eventId', 'observedAt', 'source', 'operation', 'changes', 'evidence'])
const createKeys = new Set(['title', 'description', 'startsAt', 'endsAt', 'timeZone', 'type', 'priority', 'isFeatured', 'status'])
const updateKeys = new Set(['title', 'description', 'startsAt', 'endsAt', 'type', 'priority', 'isFeatured', 'status'])
const eventTypes = new Set<ImportantEventType>(['REGISTRATION', 'SIMULATOR', 'SALE', 'PRE_SALE', 'FESTIVAL', 'ANNOUNCEMENT'])

export type EventSyncOperation = 'CREATE' | 'UPDATE'
export type EventEvidenceKind = 'CREATE' | 'CONFIRMATION' | 'RESCHEDULE' | 'CANCELLATION'
export interface EventSyncEvidence { excerpt: string; sourceHash: string; kind: EventEvidenceKind }
export interface EventSyncSource { url: string; type: 'OFFICIAL'; publisher: 'Tomorrowland' }
export interface EventChanges {
  title?: string
  description?: string
  startsAt?: string
  endsAt?: string
  timeZone?: 'America/Sao_Paulo'
  type?: ImportantEventType
  priority?: number
  isFeatured?: boolean
  status?: ImportantEventStatus
}
export interface EventSyncProposal {
  proposalId: string
  eventId: string
  observedAt: string
  source: EventSyncSource
  operation: EventSyncOperation
  changes: EventChanges
  evidence: EventSyncEvidence
}

export type EventSyncResult = 'CREATED' | 'UPDATED' | 'NO_CHANGE' | 'REJECTED' | 'ALREADY_PROCESSED'
export type EventRejectionCode = 'INVALID_PROPOSAL' | 'EVENT_ALREADY_EXISTS' | 'EVENT_NOT_FOUND' | 'STALE_PROPOSAL' | 'IDEMPOTENCY_CONFLICT' | 'RESCHEDULE_EVIDENCE_REQUIRED' | 'CANCELLATION_EVIDENCE_REQUIRED' | 'TIME_REGRESSION'
export interface EventSyncResponse { proposalId: string; eventId: string; result: EventSyncResult; changedFields: string[]; dryRun: boolean; rejectionCode?: EventRejectionCode; message?: string }
export interface StoredEventProposal { payloadHash: string; response: EventSyncResponse }
export interface EventSyncState { latestObservedAt: string; proposalId: string; updatedAt: string }
export interface EventSyncAudit {
  jobType: 'TOMORROWLAND_EVENT_SYNC'; proposalId: string; eventId: string; operation: EventSyncOperation
  sourceUrl: string; sourceType: 'OFFICIAL'; observedAt: string; receivedAt: string; completedAt: string
  result: Exclude<EventSyncResult, 'ALREADY_PROCESSED'>; changedFields: string[]; error: string | null
}
export interface EventHistory {
  proposalId: string; operation: EventSyncOperation; sourceUrl: string; observedAt: string; changedAt: string
  changedFields: string[]; previousValues: Record<string, unknown>; newValues: Record<string, unknown>
}
export interface EventSyncTransaction {
  getEvent(id: string): Promise<ImportantEvent | null>
  findEventByTitle(title: string): Promise<ImportantEvent | null>
  getProcessedProposal(id: string): Promise<StoredEventProposal | null>
  getEventSyncState(eventId: string): Promise<EventSyncState | null>
  setEvent(event: ImportantEvent): void
  setProcessedProposal(id: string, value: StoredEventProposal & { processedAt: string }): void
  setEventSyncState(eventId: string, value: EventSyncState): void
  setAudit(id: string, value: EventSyncAudit): void
  setHistory(eventId: string, id: string, value: EventHistory): void
}
export interface EventSyncStore { runTransaction<T>(operation: (transaction: EventSyncTransaction) => Promise<T>): Promise<T> }

export class EventProposalValidationError extends Error {
  constructor(public readonly code: EventRejectionCode, message: string) { super(message) }
}

export function parseEventSyncProposal(input: unknown): EventSyncProposal {
  const value = object(input, 'La propuesta debe ser un objeto JSON.')
  exactKeys(value, proposalKeys, 'La propuesta contiene campos no permitidos.')
  const proposalId = identifier(value.proposalId, 'proposalId')
  const eventId = eventIdentifier(value.eventId)
  const observedAt = timestamp(value.observedAt)
  const sourceValue = object(value.source, 'source debe ser un objeto.')
  exactKeys(sourceValue, new Set(['url', 'type', 'publisher']), 'source contiene campos no permitidos.')
  if (sourceValue.type !== 'OFFICIAL' || sourceValue.publisher !== 'Tomorrowland') invalid('La fuente debe ser oficial y publicada por Tomorrowland.')
  const source: EventSyncSource = { url: officialSourceUrl(sourceValue.url), type: 'OFFICIAL', publisher: 'Tomorrowland' }
  if (value.operation !== 'CREATE' && value.operation !== 'UPDATE') invalid('operation debe ser CREATE o UPDATE; DELETE no está permitido.')
  const operation = value.operation
  const changesValue = object(value.changes, 'changes debe ser un objeto.')
  exactKeys(changesValue, operation === 'CREATE' ? createKeys : updateKeys, 'changes contiene campos no permitidos.')
  if (Object.keys(changesValue).length === 0) invalid('changes debe incluir al menos un campo.')
  const changes = parseChanges(changesValue, operation)
  const evidenceValue = object(value.evidence, 'evidence debe ser un objeto.')
  exactKeys(evidenceValue, new Set(['excerpt', 'sourceHash', 'kind']), 'evidence contiene campos no permitidos.')
  const excerpt = boundedString(evidenceValue.excerpt, 'evidence.excerpt', 40, 500)
  if (typeof evidenceValue.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(evidenceValue.sourceHash)) invalid('evidence.sourceHash no es válido.')
  if (!['CREATE', 'CONFIRMATION', 'RESCHEDULE', 'CANCELLATION'].includes(String(evidenceValue.kind))) invalid('evidence.kind no es válido.')
  if (!/Tomorrowland\s+Brasil\s+2027|Brasil\s+2027/i.test(excerpt)) invalid('La evidencia no identifica inequívocamente Tomorrowland Brasil 2027.')
  return { proposalId, eventId, observedAt, source, operation, changes, evidence: { excerpt, sourceHash: evidenceValue.sourceHash, kind: evidenceValue.kind as EventEvidenceKind } }
}

export function eventProposalHash(proposal: EventSyncProposal): string {
  return createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
}

export async function processEventSyncProposal(store: EventSyncStore, proposal: EventSyncProposal, options: { dryRun: boolean; now: () => Date }): Promise<EventSyncResponse> {
  const hash = eventProposalHash(proposal)
  const receivedAt = options.now().toISOString()
  return store.runTransaction(async (transaction) => {
    const processed = await transaction.getProcessedProposal(proposal.proposalId)
    if (processed) {
      if (processed.payloadHash !== hash) return rejected(proposal, options.dryRun, 'IDEMPOTENCY_CONFLICT', 'proposalId ya fue utilizado con otro contenido.')
      return { ...processed.response, result: 'ALREADY_PROCESSED', dryRun: options.dryRun }
    }
    const current = await transaction.getEvent(proposal.eventId)
    const state = await transaction.getEventSyncState(proposal.eventId)
    const duplicate = proposal.operation === 'CREATE' && proposal.changes.title
      ? await transaction.findEventByTitle(proposal.changes.title)
      : null
    if (duplicate && duplicate.id !== proposal.eventId) {
      return finishRejection(transaction, proposal, hash, receivedAt, options, 'EVENT_ALREADY_EXISTS', 'Ya existe un acontecimiento con el mismo título oficial.')
    }
    let evaluated: ReturnType<typeof evaluateEventProposal>
    try { evaluated = evaluateEventProposal(current, proposal, receivedAt, state?.latestObservedAt) } catch (error) {
      const rejection = error instanceof EventProposalValidationError ? error : new EventProposalValidationError('INVALID_PROPOSAL', sanitizeEventError(error))
      return finishRejection(transaction, proposal, hash, receivedAt, options, rejection.code, rejection.message)
    }
    const outcome: 'CREATED' | 'UPDATED' | 'NO_CHANGE' = current === null ? 'CREATED' : evaluated.changedFields.length ? 'UPDATED' : 'NO_CHANGE'
    const result: EventSyncResponse = { proposalId: proposal.proposalId, eventId: proposal.eventId, result: outcome, changedFields: evaluated.changedFields, dryRun: options.dryRun }
    if (options.dryRun) return result
    const completedAt = options.now().toISOString()
    if (outcome !== 'NO_CHANGE') {
      transaction.setEvent(evaluated.candidate)
      transaction.setHistory(proposal.eventId, proposal.proposalId, {
        proposalId: proposal.proposalId, operation: proposal.operation, sourceUrl: proposal.source.url,
        observedAt: proposal.observedAt, changedAt: completedAt, changedFields: evaluated.changedFields,
        previousValues: current ? selectValues(current, evaluated.changedFields) : {}, newValues: selectValues(evaluated.candidate, evaluated.changedFields),
      })
    }
    transaction.setAudit(proposal.proposalId, auditDocument(proposal, receivedAt, completedAt, outcome, evaluated.changedFields))
    transaction.setProcessedProposal(proposal.proposalId, { payloadHash: hash, response: result, processedAt: completedAt })
    transaction.setEventSyncState(proposal.eventId, { latestObservedAt: proposal.observedAt, proposalId: proposal.proposalId, updatedAt: completedAt })
    return result
  })
}

export function evaluateEventProposal(current: ImportantEvent | null, proposal: EventSyncProposal, serverTimestamp: string, latestObservedAt?: string): { candidate: ImportantEvent; changedFields: string[] } {
  if (Date.parse(proposal.observedAt) > Date.parse(serverTimestamp) + 5 * 60_000) invalid('La fecha de observación no puede estar en el futuro.')
  const reference = [latestObservedAt, current?.sourceObservedAt].filter((value): value is string => Boolean(value)).sort().at(-1)
  if (reference && proposal.observedAt < reference) throw new EventProposalValidationError('STALE_PROPOSAL', 'La propuesta es anterior a la observación almacenada.')
  if (proposal.operation === 'CREATE' && current) throw new EventProposalValidationError('EVENT_ALREADY_EXISTS', 'El acontecimiento ya existe.')
  if (proposal.operation === 'UPDATE' && !current) throw new EventProposalValidationError('EVENT_NOT_FOUND', 'El acontecimiento no existe.')

  if (proposal.operation === 'CREATE') {
    if (proposal.evidence.kind !== 'CREATE') invalid('CREATE requiere evidencia de creación explícita.')
    const candidate = buildCreatedEvent(proposal, serverTimestamp)
    assertValidImportantEvent(candidate)
    validateImportantCreation(candidate, proposal.evidence.excerpt)
    return { candidate, changedFields: [...createKeys].filter((field) => field in proposal.changes) }
  }

  const existing = assertValidImportantEvent(structuredClone(current!))
  if (existing.status === 'CANCELLED' && proposal.changes.status !== undefined) invalid('Un acontecimiento cancelado no puede reactivarse automáticamente.')
  const dateChanged = (proposal.changes.startsAt !== undefined && proposal.changes.startsAt !== existing.startsAt)
    || (proposal.changes.endsAt !== undefined && proposal.changes.endsAt !== existing.endsAt)
  if (dateChanged && (proposal.evidence.kind !== 'RESCHEDULE' || !hasExplicitRescheduleEvidence(proposal.evidence.excerpt))) {
    throw new EventProposalValidationError('RESCHEDULE_EVIDENCE_REQUIRED', 'Cambiar una fecha requiere evidencia oficial explícita de reprogramación.')
  }
  if (proposal.changes.startsAt && existing.startsAt.includes('T') && !proposal.changes.startsAt.includes('T')) {
    throw new EventProposalValidationError('TIME_REGRESSION', 'Una actualización no puede eliminar una hora oficial existente.')
  }
  if (proposal.changes.status === 'CANCELLED' && (proposal.evidence.kind !== 'CANCELLATION' || !hasExplicitCancellationEvidence(proposal.evidence.excerpt))) {
    throw new EventProposalValidationError('CANCELLATION_EVIDENCE_REQUIRED', 'Cancelar requiere evidencia oficial explícita.')
  }

  const candidate: ImportantEvent = { ...existing, ...proposal.changes }
  const changedFields = [...updateKeys].filter((field) => field in proposal.changes && !same(existing[field as keyof ImportantEvent], candidate[field as keyof ImportantEvent]))
  if (changedFields.length) {
    candidate.sourceName = proposal.source.publisher
    candidate.sourceUrl = proposal.source.url
    candidate.sourceObservedAt = proposal.observedAt
    candidate.verifiedAt = proposal.observedAt.slice(0, 10)
    candidate.updatedAt = serverTimestamp.slice(0, 10)
  }
  assertValidImportantEvent(candidate)
  return { candidate, changedFields }
}

function buildCreatedEvent(proposal: EventSyncProposal, serverTimestamp: string): ImportantEvent {
  const changes = proposal.changes
  for (const field of ['title', 'description', 'startsAt', 'timeZone', 'type', 'priority', 'isFeatured'] as const) {
    if (changes[field] === undefined) invalid(`CREATE requiere ${field}.`)
  }
  return {
    id: proposal.eventId, title: changes.title!, description: changes.description!, startsAt: changes.startsAt!,
    ...(changes.endsAt ? { endsAt: changes.endsAt } : {}), timeZone: changes.timeZone!, type: changes.type!,
    priority: changes.priority!, isFeatured: changes.isFeatured!, ...(changes.status ? { status: changes.status } : {}),
    sourceName: proposal.source.publisher, sourceUrl: proposal.source.url, sourceObservedAt: proposal.observedAt,
    verifiedAt: proposal.observedAt.slice(0, 10), updatedAt: serverTimestamp.slice(0, 10),
  }
}

function validateImportantCreation(event: ImportantEvent, excerpt: string): void {
  if (!event.id.endsWith('-2027')) invalid('Los nuevos IDs deben ser semánticos y terminar en -2027.')
  if (event.startsAt.slice(0, 4) !== '2026' && event.startsAt.slice(0, 4) !== '2027') invalid('El acontecimiento no corresponde al ciclo Brasil 2027.')
  const text = `${event.title} ${event.description} ${excerpt}`
  if (!/(pre-?registr|simulador|simulator|venta|sale|festival|DreamVille|ticket|anuncio|announcement)/i.test(text)) invalid('El acontecimiento no pertenece a una categoría importante permitida.')
}

function parseChanges(value: Record<string, unknown>, operation: EventSyncOperation): EventChanges {
  const changes: EventChanges = {}
  if ('title' in value) changes.title = boundedString(value.title, 'title', 4, 120)
  if ('description' in value) changes.description = boundedString(value.description, 'description', 15, 400)
  if ('startsAt' in value) changes.startsAt = eventDate(value.startsAt, 'startsAt')
  if ('endsAt' in value) changes.endsAt = eventDate(value.endsAt, 'endsAt')
  if ('timeZone' in value) { if (value.timeZone !== 'America/Sao_Paulo') invalid('timeZone debe ser America/Sao_Paulo.'); changes.timeZone = value.timeZone }
  if ('type' in value) { if (!eventTypes.has(value.type as ImportantEventType)) invalid('type no es válido.'); changes.type = value.type as ImportantEventType }
  if ('priority' in value) { if (!Number.isInteger(value.priority) || Number(value.priority) < 0 || Number(value.priority) > 100) invalid('priority debe ser un entero entre 0 y 100.'); changes.priority = value.priority as number }
  if ('isFeatured' in value) { if (typeof value.isFeatured !== 'boolean') invalid('isFeatured debe ser boolean.'); changes.isFeatured = value.isFeatured }
  if ('status' in value) { if (value.status !== 'CANCELLED') invalid('status solo admite CANCELLED.'); changes.status = value.status }
  if (operation === 'CREATE' && changes.status === 'CANCELLED') invalid('No se puede crear automáticamente un acontecimiento ya cancelado.')
  return changes
}

function finishRejection(transaction: EventSyncTransaction, proposal: EventSyncProposal, hash: string, receivedAt: string, options: { dryRun: boolean; now: () => Date }, code: EventRejectionCode, message: string): EventSyncResponse {
  const response = rejected(proposal, options.dryRun, code, message)
  if (!options.dryRun) {
    const completedAt = options.now().toISOString()
    transaction.setAudit(proposal.proposalId, auditDocument(proposal, receivedAt, completedAt, 'REJECTED', [], message))
    transaction.setProcessedProposal(proposal.proposalId, { payloadHash: hash, response, processedAt: completedAt })
  }
  return response
}

function auditDocument(proposal: EventSyncProposal, receivedAt: string, completedAt: string, result: EventSyncAudit['result'], changedFields: string[], error?: string): EventSyncAudit {
  return { jobType: 'TOMORROWLAND_EVENT_SYNC', proposalId: proposal.proposalId, eventId: proposal.eventId, operation: proposal.operation, sourceUrl: proposal.source.url, sourceType: proposal.source.type, observedAt: proposal.observedAt, receivedAt, completedAt, result, changedFields, error: error ? sanitizeEventError(error) : null }
}
function rejected(proposal: EventSyncProposal, dryRun: boolean, rejectionCode: EventRejectionCode, message: string): EventSyncResponse { return { proposalId: proposal.proposalId, eventId: proposal.eventId, result: 'REJECTED', changedFields: [], dryRun, rejectionCode, message: sanitizeEventError(message) } }
function selectValues(event: ImportantEvent, fields: string[]): Record<string, unknown> { return Object.fromEntries(fields.map((field) => [field, event[field as keyof ImportantEvent] ?? null])) }
function hasExplicitRescheduleEvidence(value: string): boolean { return /(reschedul|new date|nova data|reprogram|postpon|adiad|alterad[ao])/i.test(value) }
function hasExplicitCancellationEvidence(value: string): boolean { return /(cancelled|canceled|cancelad[ao]|não acontecerá|will not take place)/i.test(value) }
function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right) }
export function sanitizeEventError(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/((?:password|private_key|token)["']?\s*[:=]\s*)\S+/gi, '$1[REDACTED]').replace(/[\r\n\t]/g, ' ').slice(0, 300) }
function invalid(message: string): never { throw new EventProposalValidationError('INVALID_PROPOSAL', message) }
function object(value: unknown, message: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(message); return value as Record<string, unknown> }
function exactKeys(value: Record<string, unknown>, allowed: Set<string>, message: string): void { if (Object.keys(value).some((key) => !allowed.has(key))) invalid(message) }
function identifier(value: unknown, field: string): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(value)) invalid(`${field} no es válido.`); return value }
function eventIdentifier(value: unknown): string { const id = identifier(value, 'eventId'); if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(id)) invalid('eventId debe ser un ID semántico estable.'); return id }
function boundedString(value: unknown, field: string, minimum: number, maximum: number): string { if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) invalid(`${field} no es válido.`); return value.trim() }
function timestamp(value: unknown): string { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid('observedAt debe ser un timestamp ISO válido con zona horaria.'); return new Date(value).toISOString() }
function eventDate(value: unknown, field: string): string { if (typeof value !== 'string' || (!/^\d{4}-\d{2}-\d{2}$/.test(value) && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))) invalid(`${field} no es una fecha válida.`); return value }
