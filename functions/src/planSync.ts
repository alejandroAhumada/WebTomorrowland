import { createHash } from 'node:crypto'
import { assertValidPlan, type Money, type PlanSource, type PlanStatus, type PriceType, type TravelPlan } from '../../src/models/plan.js'

export const OFFICIAL_SOURCE_HOSTS = new Set(['tomorrowland.com', 'www.tomorrowland.com', 'brasil.tomorrowland.com'])
const currencies = new Set(['BRL', 'CLP', 'USD', 'EUR'])
const statuses = new Set(['AVAILABLE', 'COMING_SOON', 'UNAVAILABLE'])
const proposalKeys = new Set(['proposalId', 'planId', 'observedAt', 'source', 'changes'])
const changeKeys = new Set(['price', 'inclusions', 'notIncluded', 'status'])

export interface PlanSyncProposal {
  proposalId: string
  planId: string
  observedAt: string
  source: { url: string; type: 'OFFICIAL'; publisher: 'Tomorrowland' }
  changes: {
    price?: { totalPrice: Money | null; priceType: PriceType | null }
    inclusions?: string[]
    notIncluded?: string[]
    status?: PlanStatus
  }
}

export type PlanSyncResult = 'UPDATED' | 'NO_CHANGE' | 'REJECTED' | 'ALREADY_PROCESSED'
export type RejectionCode = 'INVALID_PROPOSAL' | 'PLAN_NOT_FOUND' | 'UNSUPPORTED_PLAN' | 'STALE_PROPOSAL' | 'OFFICIAL_DOWNGRADE' | 'IDEMPOTENCY_CONFLICT'

export interface PlanSyncResponse {
  proposalId: string
  planId: string
  result: PlanSyncResult
  changedFields: string[]
  dryRun: boolean
  rejectionCode?: RejectionCode
  message?: string
}

export interface StoredProposal { payloadHash: string; response: PlanSyncResponse }
export interface PlanSyncState { latestObservedAt: string; proposalId: string; updatedAt: string }
export interface PlanSyncAudit {
  jobType: 'TOMORROWLAND_PLAN_SYNC'
  proposalId: string
  planId: string
  sourceUrl: string
  sourceType: 'OFFICIAL'
  observedAt: string
  receivedAt: string
  completedAt: string
  result: Exclude<PlanSyncResult, 'ALREADY_PROCESSED'>
  changedFields: string[]
  previousPrice: TravelPlan['totalPrice']
  proposedPrice: TravelPlan['totalPrice']
  finalPrice: TravelPlan['totalPrice']
  error: string | null
}
export interface PlanHistory {
  proposalId: string
  sourceUrl: string
  observedAt: string
  changedAt: string
  changedFields: string[]
  previousValues: Record<string, unknown>
  newValues: Record<string, unknown>
}

export interface PlanSyncTransaction {
  getPlan(id: string): Promise<TravelPlan | null>
  getProcessedProposal(id: string): Promise<StoredProposal | null>
  getPlanSyncState(planId: string): Promise<PlanSyncState | null>
  setPlan(plan: TravelPlan): void
  setProcessedProposal(id: string, value: StoredProposal & { processedAt: string }): void
  setPlanSyncState(planId: string, value: PlanSyncState): void
  setAudit(id: string, value: PlanSyncAudit): void
  setHistory(planId: string, id: string, value: PlanHistory): void
}
export interface PlanSyncStore { runTransaction<T>(operation: (transaction: PlanSyncTransaction) => Promise<T>): Promise<T> }

export class ProposalValidationError extends Error {
  constructor(public readonly code: RejectionCode, message: string) { super(message) }
}

export function parsePlanSyncProposal(input: unknown): PlanSyncProposal {
  const value = object(input, 'La propuesta debe ser un objeto JSON.')
  exactKeys(value, proposalKeys, 'La propuesta contiene campos no permitidos.')
  const proposalId = identifier(value.proposalId, 'proposalId')
  const planId = identifier(value.planId, 'planId')
  const observedAt = timestamp(value.observedAt)
  const sourceValue = object(value.source, 'source debe ser un objeto.')
  exactKeys(sourceValue, new Set(['url', 'type', 'publisher']), 'source contiene campos no permitidos.')
  if (sourceValue.type !== 'OFFICIAL' || sourceValue.publisher !== 'Tomorrowland') invalid('La fuente debe ser oficial y publicada por Tomorrowland.')
  const url = officialSourceUrl(sourceValue.url)
  const changesValue = object(value.changes, 'changes debe ser un objeto.')
  exactKeys(changesValue, changeKeys, 'changes contiene campos no permitidos.')
  if (Object.keys(changesValue).length === 0) invalid('changes debe incluir al menos un cambio.')

  const changes: PlanSyncProposal['changes'] = {}
  if ('price' in changesValue) changes.price = parsePrice(changesValue.price)
  if ('inclusions' in changesValue) changes.inclusions = stringList(changesValue.inclusions, 'inclusions')
  if ('notIncluded' in changesValue) changes.notIncluded = stringList(changesValue.notIncluded, 'notIncluded', true)
  if ('status' in changesValue) {
    if (typeof changesValue.status !== 'string' || !statuses.has(changesValue.status)) invalid('status no es válido.')
    changes.status = changesValue.status as PlanStatus
  }
  return { proposalId, planId, observedAt, source: { url, type: 'OFFICIAL', publisher: 'Tomorrowland' }, changes }
}

export function proposalHash(proposal: PlanSyncProposal): string {
  return createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
}

export async function processPlanSyncProposal(store: PlanSyncStore, proposal: PlanSyncProposal, options: { dryRun: boolean; now: () => Date }): Promise<PlanSyncResponse> {
  const hash = proposalHash(proposal)
  const receivedAt = options.now().toISOString()
  return store.runTransaction(async (transaction) => {
    const processed = await transaction.getProcessedProposal(proposal.proposalId)
    if (processed) {
      if (processed.payloadHash !== hash) return rejected(proposal, options.dryRun, 'IDEMPOTENCY_CONFLICT', 'proposalId ya fue utilizado con otro contenido.')
      return { ...processed.response, result: 'ALREADY_PROCESSED', dryRun: options.dryRun }
    }

    const current = await transaction.getPlan(proposal.planId)
    if (!current) return finishRejection(transaction, proposal, hash, receivedAt, options, 'PLAN_NOT_FOUND', 'El plan no existe.')
    if (current.category === 'UNKNOWN') return finishRejection(transaction, proposal, hash, receivedAt, options, 'UNSUPPORTED_PLAN', 'El producto todavía no está aprobado por el dominio de planes.')
    const syncState = await transaction.getPlanSyncState(proposal.planId)

    let evaluated: ReturnType<typeof evaluateProposal>
    try { evaluated = evaluateProposal(current, proposal, receivedAt, syncState?.latestObservedAt) } catch (error) {
      const rejection = error instanceof ProposalValidationError ? error : new ProposalValidationError('INVALID_PROPOSAL', sanitizeError(error))
      return finishRejection(transaction, proposal, hash, receivedAt, options, rejection.code, rejection.message, current)
    }

    const outcome: 'UPDATED' | 'NO_CHANGE' = evaluated.changedFields.length ? 'UPDATED' : 'NO_CHANGE'
    const result: PlanSyncResponse = { proposalId: proposal.proposalId, planId: proposal.planId, result: outcome, changedFields: evaluated.changedFields, dryRun: options.dryRun }
    if (options.dryRun) return result

    const completedAt = options.now().toISOString()
    if (result.result === 'UPDATED') {
      transaction.setPlan(evaluated.candidate)
      transaction.setHistory(proposal.planId, proposal.proposalId, {
        proposalId: proposal.proposalId, sourceUrl: proposal.source.url, observedAt: proposal.observedAt,
        changedAt: completedAt, changedFields: evaluated.changedFields,
        previousValues: selectValues(current, evaluated.changedFields), newValues: selectValues(evaluated.candidate, evaluated.changedFields),
      })
    }
    const audit = auditDocument(proposal, receivedAt, completedAt, outcome, evaluated.changedFields, current, evaluated.candidate)
    transaction.setAudit(proposal.proposalId, audit)
    transaction.setProcessedProposal(proposal.proposalId, { payloadHash: hash, response: result, processedAt: completedAt })
    transaction.setPlanSyncState(proposal.planId, { latestObservedAt: proposal.observedAt, proposalId: proposal.proposalId, updatedAt: completedAt })
    return result
  })
}

export function evaluateProposal(current: TravelPlan, proposal: PlanSyncProposal, serverTimestamp: string, latestProcessedObservation?: string): { candidate: TravelPlan; changedFields: string[] } {
  assertValidPlan(current)
  if (Date.parse(proposal.observedAt) > Date.parse(serverTimestamp) + 5 * 60_000) throw new ProposalValidationError('INVALID_PROPOSAL', 'La fecha de observación no puede estar en el futuro.')
  const reference = [latestProcessedObservation, current.sourceObservedAt, latestSourceDate(current.sources)].filter((value): value is string => Boolean(value)).sort().at(-1)
  if (reference && proposal.observedAt < reference) throw new ProposalValidationError('STALE_PROPOSAL', 'La propuesta es anterior a la información almacenada.')
  if (current.priceType === 'OFFICIAL' && proposal.changes.price?.priceType !== undefined && proposal.changes.price.priceType !== 'OFFICIAL') {
    throw new ProposalValidationError('OFFICIAL_DOWNGRADE', 'Un precio oficial no puede degradarse automáticamente.')
  }

  const candidate: TravelPlan = structuredClone(current)
  if (proposal.changes.price) {
    candidate.totalPrice = proposal.changes.price.totalPrice
    candidate.priceType = proposal.changes.price.priceType
  }
  if (proposal.changes.inclusions) candidate.inclusions = proposal.changes.inclusions
  if (proposal.changes.notIncluded) candidate.notIncluded = proposal.changes.notIncluded
  if (proposal.changes.status) candidate.status = proposal.changes.status
  assertValidPlan(candidate)

  const changedFields = [...changeKeys].filter((field) => field !== 'price' && field in proposal.changes && !same(current[field as keyof TravelPlan], candidate[field as keyof TravelPlan]))
  if (proposal.changes.price && (!same(current.totalPrice, candidate.totalPrice) || current.priceType !== candidate.priceType)) changedFields.unshift('price')
  if (changedFields.length) {
    const date = proposal.observedAt.slice(0, 10)
    const source: PlanSource = { label: proposal.source.publisher, type: 'OFFICIAL', url: proposal.source.url, verifiedAt: date, updatedAt: date }
    candidate.sources = [...current.sources.filter((item) => item.url !== source.url), source]
    candidate.sourceObservedAt = proposal.observedAt
    candidate.updatedAt = serverTimestamp
    assertValidPlan(candidate)
  }
  return { candidate, changedFields }
}

export function officialSourceUrl(value: unknown): string {
  if (typeof value !== 'string') invalid('La URL de fuente no es válida.')
  let url: URL
  try { url = new URL(value) } catch { invalid('La URL de fuente no es válida.') }
  if (url.protocol !== 'https:' || !OFFICIAL_SOURCE_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) invalid('La URL no pertenece a una fuente oficial permitida.')
  return url.toString()
}

function parsePrice(input: unknown): NonNullable<PlanSyncProposal['changes']['price']> {
  const value = object(input, 'price debe ser un objeto.')
  exactKeys(value, new Set(['totalPrice', 'priceType']), 'price contiene campos no permitidos.')
  if (!('totalPrice' in value) || !('priceType' in value)) invalid('price requiere totalPrice y priceType.')
  if (value.totalPrice === null) {
    if (value.priceType !== null) invalid('Un precio pendiente debe tener priceType null.')
    return { totalPrice: null, priceType: null }
  }
  const money = object(value.totalPrice, 'totalPrice debe ser un objeto o null.')
  exactKeys(money, new Set(['amount', 'currency']), 'totalPrice contiene campos no permitidos.')
  if (typeof money.amount !== 'number' || !Number.isFinite(money.amount) || money.amount <= 0) invalid('El precio debe ser numérico y mayor que cero.')
  if (typeof money.currency !== 'string' || !currencies.has(money.currency)) invalid('La moneda no es válida.')
  if (value.priceType !== 'OFFICIAL' && value.priceType !== 'ESTIMATED') invalid('priceType no es válido.')
  return { totalPrice: { amount: money.amount, currency: money.currency as Money['currency'] }, priceType: value.priceType }
}

function finishRejection(transaction: PlanSyncTransaction, proposal: PlanSyncProposal, hash: string, receivedAt: string, options: { dryRun: boolean; now: () => Date }, code: RejectionCode, message: string, current?: TravelPlan): PlanSyncResponse {
  const response = rejected(proposal, options.dryRun, code, message)
  if (!options.dryRun) {
    const completedAt = options.now().toISOString()
    transaction.setAudit(proposal.proposalId, auditDocument(proposal, receivedAt, completedAt, 'REJECTED', [], current ?? null, current ?? null, message))
    transaction.setProcessedProposal(proposal.proposalId, { payloadHash: hash, response, processedAt: completedAt })
  }
  return response
}

function auditDocument(proposal: PlanSyncProposal, receivedAt: string, completedAt: string, result: PlanSyncAudit['result'], changedFields: string[], previous: TravelPlan | null, final: TravelPlan | null, error?: string): PlanSyncAudit {
  return {
    jobType: 'TOMORROWLAND_PLAN_SYNC', proposalId: proposal.proposalId, planId: proposal.planId,
    sourceUrl: proposal.source.url, sourceType: proposal.source.type, observedAt: proposal.observedAt,
    receivedAt, completedAt, result, changedFields, previousPrice: previous?.totalPrice ?? null,
    proposedPrice: proposal.changes.price?.totalPrice ?? null, finalPrice: final?.totalPrice ?? null, error: error ? sanitizeError(error) : null,
  }
}

function rejected(proposal: PlanSyncProposal, dryRun: boolean, rejectionCode: RejectionCode, message: string): PlanSyncResponse {
  return { proposalId: proposal.proposalId, planId: proposal.planId, result: 'REJECTED', changedFields: [], dryRun, rejectionCode, message: sanitizeError(message) }
}

function latestSourceDate(sources: PlanSource[]): string | undefined {
  const dates = sources.map((source) => source.updatedAt).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort()
  return dates.length ? `${dates.at(-1)}T00:00:00.000Z` : undefined
}

function selectValues(plan: TravelPlan, fields: string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field === 'price') values.price = { totalPrice: plan.totalPrice, priceType: plan.priceType }
    else values[field] = plan[field as keyof TravelPlan]
  }
  return values
}

function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right) }
function sanitizeError(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]/g, ' ').slice(0, 300) }
function invalid(message: string): never { throw new ProposalValidationError('INVALID_PROPOSAL', message) }
function object(value: unknown, message: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(message); return value as Record<string, unknown> }
function exactKeys(value: Record<string, unknown>, allowed: Set<string>, message: string): void { if (Object.keys(value).some((key) => !allowed.has(key))) invalid(message) }
function identifier(value: unknown, field: string): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(value)) invalid(`${field} no es válido.`); return value }
function timestamp(value: unknown): string {
  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/) : null
  if (!match || !Number.isFinite(Date.parse(value as string))) invalid('observedAt debe ser un timestamp ISO válido con zona horaria.')
  const calendar = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (calendar.getUTCFullYear() !== Number(match[1]) || calendar.getUTCMonth() !== Number(match[2]) - 1 || calendar.getUTCDate() !== Number(match[3])) invalid('observedAt contiene una fecha calendario inválida.')
  return new Date(value as string).toISOString()
}
function stringList(value: unknown, field: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > 40 || value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 300)) invalid(`${field} no es una lista válida.`)
  return value.map((item) => (item as string).trim())
}
