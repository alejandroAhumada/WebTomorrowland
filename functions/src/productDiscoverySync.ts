import { createHash } from 'node:crypto'
import { officialSourceUrl } from './planSync.js'

export const NO_LONGER_OBSERVED_THRESHOLD = 3

export type CandidateObservationState = 'OBSERVED' | 'NO_LONGER_OBSERVED'
export type CandidateReviewState = 'PENDING' | 'ACKNOWLEDGED' | 'APPROVED_FOR_MODELING' | 'REJECTED'

export interface DiscoveryCandidateEvidence {
  candidateId: string
  officialUrl: string
  sourceIndexUrl: string
  observedTitle: string
  excerpt: string
  evidenceHash: string
  detectionReason: 'OFFICIAL_CATALOG_PRODUCT_LINK' | 'OFFICIAL_CATALOG_PRODUCT_CARD'
}

export interface ProductDiscoveryProposal {
  schemaVersion: 1
  proposalId: string
  sourceId: string
  sourceIndexUrl: string
  observedAt: string
  sourceHash: string
  extractorVersion: number
  candidates: DiscoveryCandidateEvidence[]
}

export interface DetectedProductCandidate extends DiscoveryCandidateEvidence {
  observationState: CandidateObservationState
  reviewState: CandidateReviewState
  discoveredAt: string
  lastObservedAt: string
  missedSuccessfulRuns: number
  lastSourceHash: string
}

export interface ProductDiscoverySourceState {
  sourceId: string
  sourceIndexUrl: string
  sourceHash: string
  lastSuccessfulAt: string
  observedCandidateIds: string[]
  trackedCandidateIds: string[]
  proposalId: string
}

export type ProductDiscoveryResult = 'UPDATED' | 'NO_CHANGE' | 'REJECTED' | 'ALREADY_PROCESSED'
export interface ProductDiscoveryResponse {
  proposalId: string
  result: ProductDiscoveryResult
  dryRun: boolean
  newCandidates: string[]
  existingCandidates: string[]
  noLongerObserved: string[]
  rejectionCode?: 'INVALID_PROPOSAL' | 'STALE_PROPOSAL' | 'IDEMPOTENCY_CONFLICT'
  message?: string
}
export interface StoredDiscoveryProposal { payloadHash: string; response: ProductDiscoveryResponse }

export interface ProductDiscoveryTransaction {
  getProcessedProposal(id: string): Promise<StoredDiscoveryProposal | null>
  getSourceState(sourceId: string): Promise<ProductDiscoverySourceState | null>
  getCandidate(id: string): Promise<DetectedProductCandidate | null>
  setCandidate(id: string, candidate: DetectedProductCandidate): void
  setObservation(candidateId: string, evidenceHash: string, observation: DiscoveryCandidateEvidence & { observedAt: string; sourceHash: string }): void
  setSourceState(sourceId: string, state: ProductDiscoverySourceState): void
  setProcessedProposal(id: string, value: StoredDiscoveryProposal & { processedAt: string }): void
  setAudit(id: string, audit: Record<string, unknown>): void
}
export interface ProductDiscoveryStore { runTransaction<T>(operation: (transaction: ProductDiscoveryTransaction) => Promise<T>): Promise<T> }

export class ProductDiscoveryValidationError extends Error {
  constructor(public readonly code: 'INVALID_PROPOSAL', message: string) { super(message) }
}

const discoverySourceUrls: Readonly<Record<string, string>> = {
  'ticket-catalog': 'https://brasil.tomorrowland.com/en/tickets',
  'global-journey-catalog': 'https://brasil.tomorrowland.com/en/tickets/global-journey',
  'dreamville-catalog': 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages',
  'magnificent-greens-catalog': 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages',
  'easy-tent-catalog': 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages',
}

export function parseProductDiscoveryProposal(input: unknown): ProductDiscoveryProposal {
  const value = object(input, 'La propuesta debe ser un objeto JSON.')
  exactKeys(value, new Set(['schemaVersion', 'proposalId', 'sourceId', 'sourceIndexUrl', 'observedAt', 'sourceHash', 'extractorVersion', 'candidates']))
  if (value.schemaVersion !== 1) invalid('schemaVersion no es compatible.')
  const proposalId = identifier(value.proposalId, 'proposalId')
  const sourceId = identifier(value.sourceId, 'sourceId')
  const sourceIndexUrl = officialSourceUrl(value.sourceIndexUrl)
  if (discoverySourceUrls[sourceId] !== canonicalUrl(sourceIndexUrl)) invalid('La fuente no corresponde a un índice de discovery configurado.')
  const observedAt = timestamp(value.observedAt)
  const sourceHash = sha256(value.sourceHash, 'sourceHash')
  if (!Number.isInteger(value.extractorVersion) || Number(value.extractorVersion) < 1 || Number(value.extractorVersion) > 1000) invalid('extractorVersion no es válido.')
  if (!Array.isArray(value.candidates) || value.candidates.length > 100) invalid('candidates no es una lista válida.')
  const candidates = value.candidates.map(parseCandidate)
  if (new Set(candidates.map((candidate) => candidate.candidateId)).size !== candidates.length) invalid('candidates contiene IDs duplicados.')
  if (candidates.some((candidate) => canonicalUrl(candidate.sourceIndexUrl) !== canonicalUrl(sourceIndexUrl))) invalid('El candidato no corresponde a la fuente observada.')
  return { schemaVersion: 1, proposalId, sourceId, sourceIndexUrl: canonicalUrl(sourceIndexUrl), observedAt, sourceHash, extractorVersion: Number(value.extractorVersion), candidates }
}

export function productDiscoveryProposalHash(proposal: ProductDiscoveryProposal): string {
  return createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
}

export async function processProductDiscoveryProposal(store: ProductDiscoveryStore, proposal: ProductDiscoveryProposal, options: { dryRun: boolean; now: () => Date }): Promise<ProductDiscoveryResponse> {
  const payloadHash = productDiscoveryProposalHash(proposal)
  const now = options.now().toISOString()
  if (Date.parse(proposal.observedAt) > options.now().getTime() + 5 * 60_000) return rejected(proposal, options.dryRun, 'INVALID_PROPOSAL', 'La observación no puede estar en el futuro.')
  return store.runTransaction(async (transaction) => {
    const processed = await transaction.getProcessedProposal(proposal.proposalId)
    if (processed) {
      if (processed.payloadHash !== payloadHash) return rejected(proposal, options.dryRun, 'IDEMPOTENCY_CONFLICT', 'proposalId ya fue utilizado con otro contenido.')
      return { ...processed.response, result: 'ALREADY_PROCESSED', dryRun: options.dryRun }
    }
    const sourceState = await transaction.getSourceState(proposal.sourceId)
    if (sourceState && proposal.observedAt < sourceState.lastSuccessfulAt) return rejected(proposal, options.dryRun, 'STALE_PROPOSAL', 'La observación es anterior al estado de la fuente.')

    const incoming = new Map(proposal.candidates.map((candidate) => [candidate.candidateId, candidate]))
    const priorIds = sourceState?.trackedCandidateIds ?? sourceState?.observedCandidateIds ?? []
    const idsToRead = [...new Set([...incoming.keys(), ...priorIds])]
    const currentCandidates = new Map<string, DetectedProductCandidate | null>()
    for (const id of idsToRead) currentCandidates.set(id, await transaction.getCandidate(id))

    const newCandidates: string[] = []
    const existingCandidates: string[] = []
    const noLongerObserved: string[] = []
    let absenceProgressed = false
    let observationProgressed = false
    const nextCandidates = new Map<string, DetectedProductCandidate>()
    const observations: Array<{ candidate: DiscoveryCandidateEvidence; materiallyChanged: boolean }> = []

    for (const candidate of incoming.values()) {
      const current = currentCandidates.get(candidate.candidateId)
      if (!current) {
        newCandidates.push(candidate.candidateId)
        nextCandidates.set(candidate.candidateId, {
          ...candidate, observationState: 'OBSERVED', reviewState: 'PENDING', discoveredAt: proposal.observedAt,
          lastObservedAt: proposal.observedAt, missedSuccessfulRuns: 0, lastSourceHash: proposal.sourceHash,
        })
        observations.push({ candidate, materiallyChanged: true })
      } else {
        existingCandidates.push(candidate.candidateId)
        const materiallyChanged = current.evidenceHash !== candidate.evidenceHash
        if (current.lastObservedAt !== proposal.observedAt) observationProgressed = true
        nextCandidates.set(candidate.candidateId, {
          ...current, ...candidate, observationState: 'OBSERVED', lastObservedAt: proposal.observedAt,
          missedSuccessfulRuns: 0, lastSourceHash: proposal.sourceHash,
        })
        observations.push({ candidate, materiallyChanged })
      }
    }

    for (const id of priorIds) {
      if (incoming.has(id)) continue
      const current = currentCandidates.get(id)
      if (!current) continue
      const missedSuccessfulRuns = Math.min(current.missedSuccessfulRuns + 1, NO_LONGER_OBSERVED_THRESHOLD)
      if (missedSuccessfulRuns !== current.missedSuccessfulRuns) absenceProgressed = true
      const observationState = missedSuccessfulRuns >= NO_LONGER_OBSERVED_THRESHOLD ? 'NO_LONGER_OBSERVED' as const : current.observationState
      if (observationState === 'NO_LONGER_OBSERVED' && current.observationState !== observationState) noLongerObserved.push(id)
      nextCandidates.set(id, { ...current, missedSuccessfulRuns, observationState, lastSourceHash: proposal.sourceHash })
    }

    const incomingIds = [...incoming.keys()].sort()
    const sameSource = sourceState?.sourceHash === proposal.sourceHash
      && same(sourceState.observedCandidateIds, incomingIds)
    const materiallyChanged = newCandidates.length > 0 || noLongerObserved.length > 0
      || observations.some((item) => item.materiallyChanged) || observationProgressed || absenceProgressed || !sameSource
    const result: ProductDiscoveryResponse = {
      proposalId: proposal.proposalId, result: materiallyChanged ? 'UPDATED' : 'NO_CHANGE', dryRun: options.dryRun,
      newCandidates, existingCandidates, noLongerObserved,
    }
    if (options.dryRun) return result

    for (const [id, candidate] of nextCandidates) transaction.setCandidate(id, candidate)
    for (const { candidate, materiallyChanged: changed } of observations) {
      if (changed) transaction.setObservation(candidate.candidateId, candidate.evidenceHash, { ...candidate, observedAt: proposal.observedAt, sourceHash: proposal.sourceHash })
    }
    transaction.setSourceState(proposal.sourceId, {
      sourceId: proposal.sourceId, sourceIndexUrl: proposal.sourceIndexUrl, sourceHash: proposal.sourceHash,
      lastSuccessfulAt: proposal.observedAt, observedCandidateIds: incomingIds,
      trackedCandidateIds: [...new Set([...priorIds, ...incoming.keys()])].sort(), proposalId: proposal.proposalId,
    })
    transaction.setProcessedProposal(proposal.proposalId, { payloadHash, response: result, processedAt: now })
    transaction.setAudit(proposal.proposalId, {
      jobType: 'TOMORROWLAND_PRODUCT_DISCOVERY', proposalId: proposal.proposalId, sourceId: proposal.sourceId,
      sourceIndexUrl: proposal.sourceIndexUrl, observedAt: proposal.observedAt, completedAt: now,
      result: result.result, newCandidateCount: newCandidates.length, existingCandidateCount: existingCandidates.length,
      noLongerObservedCount: noLongerObserved.length,
    })
    return result
  })
}

function parseCandidate(input: unknown): DiscoveryCandidateEvidence {
  const value = object(input, 'Cada candidato debe ser un objeto.')
  exactKeys(value, new Set(['candidateId', 'officialUrl', 'sourceIndexUrl', 'observedTitle', 'excerpt', 'evidenceHash', 'detectionReason']))
  const candidateId = identifier(value.candidateId, 'candidateId')
  const officialUrl = officialSourceUrl(value.officialUrl)
  const sourceIndexUrl = officialSourceUrl(value.sourceIndexUrl)
  const observedTitle = safeText(value.observedTitle, 'observedTitle', 140)
  const excerpt = safeText(value.excerpt, 'excerpt', 500)
  const evidenceHash = sha256(value.evidenceHash, 'evidenceHash')
  if (value.detectionReason !== 'OFFICIAL_CATALOG_PRODUCT_LINK' && value.detectionReason !== 'OFFICIAL_CATALOG_PRODUCT_CARD') invalid('detectionReason no es válido.')
  const canonicalOfficialUrl = canonicalUrl(officialUrl)
  const canonicalSourceIndexUrl = canonicalUrl(sourceIndexUrl)
  const expectedIdentity = value.detectionReason === 'OFFICIAL_CATALOG_PRODUCT_LINK'
    ? canonicalOfficialUrl : `${canonicalSourceIndexUrl}|${normalizeIdentity(observedTitle)}`
  if (candidateId !== `product-${hash(expectedIdentity).slice(0, 40)}`) invalid('candidateId no coincide con la identidad estructural.')
  if (evidenceHash !== hash(JSON.stringify({ officialUrl: canonicalOfficialUrl, observedTitle, excerpt }))) invalid('evidenceHash no coincide con la evidencia.')
  return { candidateId, officialUrl: canonicalOfficialUrl, sourceIndexUrl: canonicalSourceIndexUrl, observedTitle, excerpt, evidenceHash, detectionReason: value.detectionReason }
}

function rejected(proposal: ProductDiscoveryProposal, dryRun: boolean, rejectionCode: NonNullable<ProductDiscoveryResponse['rejectionCode']>, message: string): ProductDiscoveryResponse {
  return { proposalId: proposal.proposalId, result: 'REJECTED', dryRun, newCandidates: [], existingCandidates: [], noLongerObserved: [], rejectionCode, message }
}
function object(value: unknown, message: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(message); return value as Record<string, unknown> }
function exactKeys(value: Record<string, unknown>, allowed: Set<string>): void { if (Object.keys(value).some((key) => !allowed.has(key))) invalid('La propuesta contiene campos no permitidos.') }
function identifier(value: unknown, field: string): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/.test(value)) invalid(`${field} no es válido.`); return value }
function sha256(value: unknown, field: string): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid(`${field} no es un hash válido.`); return value }
function safeText(value: unknown, field: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /<[^>]*>/.test(value)
    || [...value].some((character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127 })) invalid(`${field} no es texto sanitizado válido.`)
  return value.trim()
}
function timestamp(value: unknown): string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) invalid('observedAt no es válido.'); return new Date(value as string).toISOString() }
function invalid(message: string): never { throw new ProductDiscoveryValidationError('INVALID_PROPOSAL', message) }
function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right) }
function canonicalUrl(input: string): string { const url = new URL(input); url.search = ''; url.hash = ''; url.pathname = url.pathname.replace(/\/$/, '') || '/'; return url.toString().replace(/\/$/, '') }
function normalizeIdentity(value: string): string { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex') }
