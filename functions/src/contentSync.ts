import { createHash } from 'node:crypto'
import { assertValidTicketTier, type TicketTier } from '../../src/models/ticketTier.js'
import { assertValidImportantInformation, type ImportantInformation } from '../../src/models/importantInformation.js'
import { officialSourceUrl } from './planSync.js'

export type OfficialContentType = 'TICKET_TIER' | 'IMPORTANT_INFORMATION'
export type OfficialContentDocument = TicketTier | ImportantInformation
export interface ContentSyncProposal { proposalId: string; contentType: OfficialContentType; documentId: string; observedAt: string; source: { url: string; type: 'OFFICIAL'; publisher: 'Tomorrowland' }; document: OfficialContentDocument; evidence: { excerpt: string; sourceHash: string; kind: 'CONFIRMATION' | 'CORRECTION' } }
export type ContentSyncResult = 'CREATED' | 'UPDATED' | 'NO_CHANGE' | 'REJECTED' | 'ALREADY_PROCESSED'
export interface ContentSyncResponse { proposalId: string; documentId: string; result: ContentSyncResult; changedFields: string[]; dryRun: boolean; rejectionCode?: string; message?: string }
export interface StoredContentProposal { payloadHash: string; response: ContentSyncResponse }
export interface ContentSyncTransaction {
  getDocument(type: OfficialContentType, id: string): Promise<OfficialContentDocument | null>; getProposal(id: string): Promise<StoredContentProposal | null>; getLatestObservedAt(key: string): Promise<string | null>
  setDocument(type: OfficialContentType, value: OfficialContentDocument): void; setProposal(id: string, value: StoredContentProposal & { processedAt: string }): void; setState(key: string, value: Record<string, unknown>): void; setAudit(id: string, value: Record<string, unknown>): void; setHistory(type: OfficialContentType, documentId: string, id: string, value: Record<string, unknown>): void
}
export interface ContentSyncStore { runTransaction<T>(operation: (transaction: ContentSyncTransaction) => Promise<T>): Promise<T> }
export class ContentProposalValidationError extends Error { constructor(public readonly code: string, message: string) { super(message) } }

export function parseContentSyncProposal(input: unknown): ContentSyncProposal {
  const value = object(input, 'La propuesta debe ser un objeto JSON.'); exact(value, ['proposalId','contentType','documentId','observedAt','source','document','evidence'])
  const proposalId = identifier(value.proposalId, 'proposalId'); const documentId = semanticId(value.documentId, 'documentId'); const observedAt = timestamp(value.observedAt)
  if (value.contentType !== 'TICKET_TIER' && value.contentType !== 'IMPORTANT_INFORMATION') invalid('contentType no es válido.')
  const sourceValue = object(value.source, 'source debe ser un objeto.'); exact(sourceValue, ['url','type','publisher'])
  if (sourceValue.type !== 'OFFICIAL' || sourceValue.publisher !== 'Tomorrowland') invalid('La fuente debe ser oficial.')
  const source = { url: officialSourceUrl(sourceValue.url), type: 'OFFICIAL' as const, publisher: 'Tomorrowland' as const }
  const evidenceValue = object(value.evidence, 'evidence debe ser un objeto.'); exact(evidenceValue, ['excerpt','sourceHash','kind'])
  if (typeof evidenceValue.excerpt !== 'string' || evidenceValue.excerpt.trim().length < 40 || evidenceValue.excerpt.length > 700) invalid('La evidencia no es válida.')
  if (typeof evidenceValue.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(evidenceValue.sourceHash)) invalid('sourceHash no es válido.')
  if (evidenceValue.kind !== 'CONFIRMATION' && evidenceValue.kind !== 'CORRECTION') invalid('evidence.kind no es válido.')
  const document = structuredClone(value.document) as OfficialContentDocument
  if (!document || typeof document !== 'object' || document.id !== documentId) invalid('document debe corresponder a documentId.')
  validateDocumentKeys(value.contentType, document)
  if (value.contentType === 'TICKET_TIER') assertValidTicketTier(document as TicketTier); else assertValidImportantInformation(document as ImportantInformation)
  if (document.sourceUrl !== source.url || document.sourceObservedAt !== observedAt) invalid('Documento, fuente y observedAt deben coincidir con la propuesta.')
  return { proposalId, contentType: value.contentType, documentId, observedAt, source, document, evidence: { excerpt: evidenceValue.excerpt.trim(), sourceHash: evidenceValue.sourceHash, kind: evidenceValue.kind } }
}

function validateDocumentKeys(type: OfficialContentType, document: OfficialContentDocument): void {
  if (type === 'TICKET_TIER') {
    exact(object(document, 'document inválido.'), ['id','type','name','description','benefits','conditions','offerings','sourceName','sourceUrl','sourceObservedAt','updatedAt'])
    for (const offering of (document as TicketTier).offerings) exact(object(offering, 'offering inválida.'), ['planId','available','totalPrice','priceType','sourceUrl'])
  } else {
    const allowed=['id','title','summary','details','category','sourceName','sourceUrl','sourceObservedAt','priority','highlighted','appliesTo','updatedAt','effectiveFrom','effectiveUntil','relatedEventId']
    const keys=Object.keys(document); if(keys.some((key)=>!allowed.includes(key))) invalid('document contiene campos no permitidos.')
  }
}

export async function processContentSyncProposal(store: ContentSyncStore, proposal: ContentSyncProposal, options: { dryRun: boolean; now: () => Date }): Promise<ContentSyncResponse> {
  const payloadHash = hash(proposal); const stateKey = `${proposal.contentType.toLowerCase()}_${proposal.documentId}`
  return store.runTransaction(async (transaction) => {
    const processed = await transaction.getProposal(proposal.proposalId)
    if (processed) return processed.payloadHash === payloadHash ? { ...processed.response, result: 'ALREADY_PROCESSED', dryRun: options.dryRun } : rejected(proposal, options.dryRun, 'IDEMPOTENCY_CONFLICT', 'proposalId ya fue usado con otro contenido.')
    const current = await transaction.getDocument(proposal.contentType, proposal.documentId); const latest = await transaction.getLatestObservedAt(stateKey)
    if ((latest && proposal.observedAt < latest) || (current && proposal.observedAt < current.sourceObservedAt)) return rejected(proposal, options.dryRun, 'STALE_PROPOSAL', 'La propuesta es anterior a la observación almacenada.')
    try { validateRegression(current, proposal) } catch (error) { return rejected(proposal, options.dryRun, 'ANTI_REGRESSION', sanitize(error)) }
    const changedFields = current ? Object.keys(proposal.document).filter((key) => key !== 'sourceObservedAt' && key !== 'updatedAt' && JSON.stringify(current[key as keyof OfficialContentDocument]) !== JSON.stringify(proposal.document[key as keyof OfficialContentDocument])) : Object.keys(proposal.document)
    const result: ContentSyncResponse = { proposalId: proposal.proposalId, documentId: proposal.documentId, result: current ? (changedFields.length ? 'UPDATED' : 'NO_CHANGE') : 'CREATED', changedFields, dryRun: options.dryRun }
    if (options.dryRun) return result
    const completedAt = options.now().toISOString()
    if (result.result !== 'NO_CHANGE') { transaction.setDocument(proposal.contentType, proposal.document); transaction.setHistory(proposal.contentType, proposal.documentId, proposal.proposalId, { proposalId: proposal.proposalId, contentType: proposal.contentType, sourceUrl: proposal.source.url, observedAt: proposal.observedAt, changedAt: completedAt, changedFields, previous: current, final: proposal.document }) }
    transaction.setProposal(proposal.proposalId, { payloadHash, response: result, processedAt: completedAt }); transaction.setState(stateKey, { latestObservedAt: proposal.observedAt, proposalId: proposal.proposalId, updatedAt: completedAt })
    transaction.setAudit(proposal.proposalId, { jobType: 'TOMORROWLAND_OFFICIAL_CONTENT_SYNC', contentType: proposal.contentType, documentId: proposal.documentId, proposalId: proposal.proposalId, sourceUrl: proposal.source.url, observedAt: proposal.observedAt, completedAt, result: result.result, changedFields })
    return result
  })
}

function validateRegression(current: OfficialContentDocument | null, proposal: ContentSyncProposal): void {
  if (!current) return
  if (proposal.contentType === 'TICKET_TIER') {
    const before = current as TicketTier; const after = proposal.document as TicketTier
    for (const oldOffer of before.offerings) { const next = after.offerings.find((item) => item.planId === oldOffer.planId); if (!next) invalid(`No se puede eliminar la oferta ${oldOffer.planId}.`); if (oldOffer.available && !next.available) invalid('Un tier no puede desaparecer automáticamente.'); if (oldOffer.totalPrice && (!next.totalPrice || next.priceType !== 'OFFICIAL')) invalid('Un precio oficial conocido no puede desaparecer ni degradarse.') }
    if (proposal.evidence.kind !== 'CORRECTION') for (const benefit of before.benefits) if (!after.benefits.includes(benefit)) invalid('Los beneficios no pueden desaparecer sin una corrección explícita.')
  } else {
    const before = current as ImportantInformation; const after = proposal.document as ImportantInformation
    if (proposal.evidence.kind !== 'CORRECTION') for (const detail of before.details) if (!after.details.includes(detail)) invalid('La información oficial no puede desaparecer sin evidencia de corrección.')
    if (before.effectiveUntil && !after.effectiveUntil) invalid('Una fecha límite conocida no puede desaparecer.')
  }
}
function rejected(proposal: ContentSyncProposal, dryRun: boolean, rejectionCode: string, message: string): ContentSyncResponse { return { proposalId: proposal.proposalId, documentId: proposal.documentId, result:'REJECTED', changedFields:[], dryRun, rejectionCode, message } }
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function sanitize(value: unknown) { return (value instanceof Error ? value.message : String(value)).replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').replace(/[\r\n\t]/g,' ').slice(0,300) }
function invalid(message: string): never { throw new ContentProposalValidationError('INVALID_PROPOSAL', message) }
function object(value: unknown, message: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(message); return value as Record<string, unknown> }
function exact(value: Record<string, unknown>, keys: string[]) { const allowed = new Set(keys); if (Object.keys(value).some((key) => !allowed.has(key)) || keys.some((key) => !(key in value))) invalid('La propuesta contiene campos ausentes o no permitidos.') }
function identifier(value: unknown, field: string) { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(value)) invalid(`${field} no es válido.`); return value }
function semanticId(value: unknown, field: string) { if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 128) invalid(`${field} debe ser semántico.`); return value }
function timestamp(value: unknown) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) invalid('observedAt no es válido.'); return new Date(value).toISOString() }
