import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/v2/https'
import { FirestorePlanSyncStore } from './firestorePlanSyncStore.js'
import { FirestoreEventSyncStore } from './firestoreEventSyncStore.js'
import { EventProposalValidationError, parseEventSyncProposal, processEventSyncProposal, type EventSyncProposal, type EventSyncResponse } from './eventSync.js'
import { parsePlanSyncProposal, processPlanSyncProposal, ProposalValidationError, type PlanSyncProposal, type PlanSyncResponse } from './planSync.js'
import { ContentProposalValidationError, parseContentSyncProposal, processContentSyncProposal, type ContentSyncProposal } from './contentSync.js'
import { FirestoreContentSyncStore } from './firestoreContentSyncStore.js'

const projectId = 'web-pack-tomorrowland'
const runtimeServiceAccount = `tomorrowland-sync-api@${projectId}.iam.gserviceaccount.com`
const callerServiceAccount = `tomorrowland-sync-client@${projectId}.iam.gserviceaccount.com`

if (getApps().length === 0) initializeApp({ projectId })

export const syncTomorrowlandPlan = onRequest({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 3,
  concurrency: 10,
  serviceAccount: runtimeServiceAccount,
  invoker: [callerServiceAccount],
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.set('Allow', 'POST').status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }
  if (!request.is('application/json')) {
    response.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE' })
    return
  }
  if (Number(request.get('content-length') ?? 0) > 64 * 1024) {
    response.status(413).json({ error: 'PAYLOAD_TOO_LARGE' })
    return
  }

  let proposal: PlanSyncProposal | undefined
  try {
    proposal = parsePlanSyncProposal(request.body)
    const dryRun = parseDryRun(request.query.dryRun)
    const result = await processPlanSyncProposal(new FirestorePlanSyncStore(getFirestore()), proposal, { dryRun, now: () => new Date() })
    response.status(statusFor(result)).json(result)
  } catch (error) {
    if (error instanceof ProposalValidationError) {
      response.status(400).json({ error: error.code, message: error.message })
      return
    }
    const sanitized = sanitizeSyncError(error)
    if (proposal) {
      try { await writeFailedAudit(proposal, sanitized) } catch { logger.error('Tomorrowland plan sync failed and FAILED audit was unavailable.') }
    }
    logger.error('Tomorrowland plan sync failed.', { error: sanitized })
    response.status(500).json({ error: 'INTERNAL_ERROR', message: 'No fue posible procesar la propuesta.' })
  }
})

export const syncTomorrowlandEvent = onRequest({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 3,
  concurrency: 10,
  serviceAccount: runtimeServiceAccount,
  invoker: [callerServiceAccount],
}, async (request, response) => {
  if (request.method !== 'POST') { response.set('Allow', 'POST').status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return }
  if (!request.is('application/json')) { response.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE' }); return }
  if (Number(request.get('content-length') ?? 0) > 64 * 1024) { response.status(413).json({ error: 'PAYLOAD_TOO_LARGE' }); return }

  let proposal: EventSyncProposal | undefined
  try {
    proposal = parseEventSyncProposal(request.body)
    const dryRun = parseEventDryRun(request.query.dryRun)
    const result = await processEventSyncProposal(new FirestoreEventSyncStore(getFirestore()), proposal, { dryRun, now: () => new Date() })
    response.status(statusForEvent(result)).json(result)
  } catch (error) {
    if (error instanceof EventProposalValidationError) { response.status(400).json({ error: error.code, message: error.message }); return }
    const sanitized = sanitizeSyncError(error)
    if (proposal) {
      try { await writeFailedEventAudit(proposal, sanitized) } catch { logger.error('Tomorrowland event sync failed and FAILED audit was unavailable.') }
    }
    logger.error('Tomorrowland event sync failed.', { error: sanitized })
    response.status(500).json({ error: 'INTERNAL_ERROR', message: 'No fue posible procesar la propuesta.' })
  }
})

export const syncTomorrowlandContent = onRequest({
  region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, maxInstances: 3, concurrency: 10,
  serviceAccount: runtimeServiceAccount, invoker: [callerServiceAccount],
}, async (request, response) => {
  if (request.method !== 'POST') { response.set('Allow', 'POST').status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return }
  if (!request.is('application/json')) { response.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE' }); return }
  if (Number(request.get('content-length') ?? 0) > 96 * 1024) { response.status(413).json({ error: 'PAYLOAD_TOO_LARGE' }); return }
  let proposal: ContentSyncProposal | undefined
  try {
    proposal = parseContentSyncProposal(request.body)
    const dryRun = parseContentDryRun(request.query.dryRun)
    const result = await processContentSyncProposal(new FirestoreContentSyncStore(getFirestore()), proposal, { dryRun, now: () => new Date() })
    response.status(result.result === 'REJECTED' ? 409 : 200).json(result)
  } catch (error) {
    if (error instanceof ContentProposalValidationError) { response.status(400).json({ error: error.code, message: error.message }); return }
    logger.error('Tomorrowland content sync failed.', { error: sanitizeSyncError(error), proposalId: proposal?.proposalId })
    response.status(500).json({ error: 'INTERNAL_ERROR', message: 'No fue posible procesar la propuesta.' })
  }
})

function parseDryRun(value: unknown): boolean {
  if (value === undefined || value === 'false') return false
  if (value === 'true') return true
  throw new ProposalValidationError('INVALID_PROPOSAL', 'dryRun debe ser true o false.')
}

function parseEventDryRun(value: unknown): boolean {
  if (value === undefined || value === 'false') return false
  if (value === 'true') return true
  throw new EventProposalValidationError('INVALID_PROPOSAL', 'dryRun debe ser true o false.')
}

function parseContentDryRun(value: unknown): boolean {
  if (value === undefined || value === 'false') return false
  if (value === 'true') return true
  throw new ContentProposalValidationError('INVALID_PROPOSAL', 'dryRun debe ser true o false.')
}

function statusFor(result: PlanSyncResponse): number {
  if (result.result !== 'REJECTED') return 200
  if (result.rejectionCode === 'PLAN_NOT_FOUND') return 404
  if (result.rejectionCode === 'STALE_PROPOSAL' || result.rejectionCode === 'OFFICIAL_DOWNGRADE' || result.rejectionCode === 'IDEMPOTENCY_CONFLICT') return 409
  return 400
}

function statusForEvent(result: EventSyncResponse): number {
  if (result.result !== 'REJECTED') return 200
  if (result.rejectionCode === 'EVENT_NOT_FOUND') return 404
  if (['EVENT_ALREADY_EXISTS', 'STALE_PROPOSAL', 'IDEMPOTENCY_CONFLICT', 'RESCHEDULE_EVIDENCE_REQUIRED', 'CANCELLATION_EVIDENCE_REQUIRED', 'TIME_REGRESSION'].includes(result.rejectionCode ?? '')) return 409
  return 400
}

export function sanitizeSyncError(error: unknown): string {
  return (error instanceof Error ? error.message : 'Unexpected error')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|private_key|token)["']?\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 300)
}

async function writeFailedAudit(proposal: PlanSyncProposal, error: string): Promise<void> {
  const completedAt = new Date().toISOString()
  await getFirestore().collection('syncRuns').add({
    jobType: 'TOMORROWLAND_PLAN_SYNC', proposalId: proposal.proposalId, planId: proposal.planId,
    sourceUrl: proposal.source.url, sourceType: proposal.source.type, observedAt: proposal.observedAt,
    receivedAt: completedAt, completedAt, result: 'FAILED', changedFields: [], previousPrice: null,
    proposedPrice: proposal.changes.price?.totalPrice ?? null, finalPrice: null, error,
  })
}

async function writeFailedEventAudit(proposal: EventSyncProposal, error: string): Promise<void> {
  const completedAt = new Date().toISOString()
  await getFirestore().collection('syncRuns').add({
    jobType: 'TOMORROWLAND_EVENT_SYNC', proposalId: proposal.proposalId, eventId: proposal.eventId,
    operation: proposal.operation, sourceUrl: proposal.source.url, sourceType: proposal.source.type,
    observedAt: proposal.observedAt, receivedAt: completedAt, completedAt, result: 'FAILED',
    changedFields: [], error,
  })
}
