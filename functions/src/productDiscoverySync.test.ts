import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import {
  parseProductDiscoveryProposal, processProductDiscoveryProposal, type DetectedProductCandidate,
  type ProductDiscoverySourceState, type ProductDiscoveryStore, type ProductDiscoveryTransaction,
  type StoredDiscoveryProposal,
} from './productDiscoverySync'

const now = () => new Date('2026-08-24T13:00:00.000Z')
const officialUrl = 'https://brasil.tomorrowland.com/en/tickets/future-package'
const observedTitle = 'Future Package'
const excerpt = 'Future Package official card.'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const baseCandidate = {
  candidateId: `product-${digest(officialUrl).slice(0, 40)}`, officialUrl,
  sourceIndexUrl: 'https://brasil.tomorrowland.com/en/tickets/', observedTitle: 'Future Package', excerpt: 'Future Package official card.',
  evidenceHash: digest(JSON.stringify({ officialUrl, observedTitle, excerpt })), detectionReason: 'OFFICIAL_CATALOG_PRODUCT_LINK' as const,
}
function proposal(overrides: Record<string, unknown> = {}) {
  return parseProductDiscoveryProposal({
    schemaVersion: 1, proposalId: 'discovery-1234567890abcdef', sourceId: 'ticket-catalog', sourceIndexUrl: 'https://brasil.tomorrowland.com/en/tickets/',
    observedAt: '2026-08-24T12:00:00.000Z', sourceHash: 'b'.repeat(64), extractorVersion: 1, candidates: [baseCandidate], ...overrides,
  })
}

class MemoryStore implements ProductDiscoveryStore {
  proposals = new Map<string, StoredDiscoveryProposal & { processedAt: string }>()
  states = new Map<string, ProductDiscoverySourceState>()
  candidates = new Map<string, DetectedProductCandidate>()
  observations = new Map<string, unknown>()
  audits = new Map<string, unknown>()
  async runTransaction<T>(operation: (transaction: ProductDiscoveryTransaction) => Promise<T>): Promise<T> {
    return operation({
      getProcessedProposal: async (id) => this.proposals.get(id) ?? null,
      getSourceState: async (id) => this.states.get(id) ?? null,
      getCandidate: async (id) => this.candidates.get(id) ?? null,
      setCandidate: (id, value) => { this.candidates.set(id, structuredClone(value)) },
      setObservation: (id, hash, value) => { this.observations.set(`${id}/${hash}`, structuredClone(value)) },
      setSourceState: (id, value) => { this.states.set(id, structuredClone(value)) },
      setProcessedProposal: (id, value) => { this.proposals.set(id, structuredClone(value)) },
      setAudit: (id, value) => { this.audits.set(id, structuredClone(value)) },
    })
  }
}

describe('Product Discovery Sync', () => {
  it('valida fuente oficial, campos exactos y evidencia sanitizada', () => {
    expect(() => proposal({ sourceIndexUrl: 'https://tomorrowland.com.evil.test/tickets/' })).toThrow('fuente oficial')
    expect(() => proposal({ schemaVersion: 2 })).toThrow('schemaVersion')
    expect(() => proposal({ sourceId: 'unknown-catalog' })).toThrow('índice de discovery')
    expect(() => proposal({ candidates: [{ ...baseCandidate, observedTitle: '<script>x</script>' }] })).toThrow('sanitizado')
    expect(() => proposal({ candidates: [{ ...baseCandidate, candidateId: 'product-tampered-candidate' }] })).toThrow('identidad estructural')
    expect(() => proposal({ candidates: [{ ...baseCandidate, extra: true }] })).toThrow('campos no permitidos')
  })

  it('rechaza una observación futura sin persistencia', async () => {
    const store = new MemoryStore()
    const future = proposal({ observedAt: '2026-08-25T12:00:00.000Z' })
    await expect(processProductDiscoveryProposal(store, future, { dryRun: false, now })).resolves.toMatchObject({ result: 'REJECTED', rejectionCode: 'INVALID_PROPOSAL' })
    expect(store.candidates.size).toBe(0)
  })

  it('dry-run detecta sin persistir y apply solo escribe colecciones de discovery', async () => {
    const store = new MemoryStore()
    const input = proposal()
    const dryRun = await processProductDiscoveryProposal(store, input, { dryRun: true, now })
    expect(dryRun).toMatchObject({ result: 'UPDATED', newCandidates: [baseCandidate.candidateId] })
    expect(store.candidates.size).toBe(0)
    await processProductDiscoveryProposal(store, input, { dryRun: false, now })
    expect(store.candidates.get(baseCandidate.candidateId)).toMatchObject({ reviewState: 'PENDING', observationState: 'OBSERVED' })
    expect(store.observations.size).toBe(1)
    expect(store.proposals.size).toBe(1)
  })

  it('es idempotente y rechaza conflicto de proposalId', async () => {
    const store = new MemoryStore(); const input = proposal()
    await processProductDiscoveryProposal(store, input, { dryRun: false, now })
    await expect(processProductDiscoveryProposal(store, input, { dryRun: false, now })).resolves.toMatchObject({ result: 'ALREADY_PROCESSED' })
    const conflict = proposal({ sourceHash: 'c'.repeat(64) })
    await expect(processProductDiscoveryProposal(store, conflict, { dryRun: false, now })).resolves.toMatchObject({ result: 'REJECTED', rejectionCode: 'IDEMPOTENCY_CONFLICT' })
  })

  it('conserva candidato y reviewState al cambiar evidencia', async () => {
    const store = new MemoryStore(); const first = proposal()
    await processProductDiscoveryProposal(store, first, { dryRun: false, now })
    store.candidates.get(baseCandidate.candidateId)!.reviewState = 'ACKNOWLEDGED'
    const changedExcerpt = 'Changed official description.'
    const changed = proposal({ proposalId: 'discovery-changed-evidence', observedAt: '2026-08-25T12:00:00.000Z', sourceHash: 'c'.repeat(64), candidates: [{ ...baseCandidate, excerpt: changedExcerpt, evidenceHash: digest(JSON.stringify({ officialUrl, observedTitle, excerpt: changedExcerpt })) }] })
    await processProductDiscoveryProposal(store, changed, { dryRun: false, now: () => new Date('2026-08-25T13:00:00Z') })
    expect(store.candidates.get(baseCandidate.candidateId)).toMatchObject({ reviewState: 'ACKNOWLEDGED', excerpt: 'Changed official description.' })
    expect(store.observations.size).toBe(2)
  })

  it('reobserva el mismo candidato sin duplicar evidencia', async () => {
    const store = new MemoryStore(); await processProductDiscoveryProposal(store, proposal(), { dryRun: false, now })
    const repeated = proposal({ proposalId: 'discovery-repeated-observation', observedAt: '2026-08-25T12:00:00.000Z' })
    const result = await processProductDiscoveryProposal(store, repeated, { dryRun: false, now: () => new Date('2026-08-25T13:00:00Z') })
    expect(result).toMatchObject({ result: 'UPDATED', newCandidates: [], existingCandidates: [baseCandidate.candidateId] })
    expect(store.candidates.get(baseCandidate.candidateId)?.lastObservedAt).toBe('2026-08-25T12:00:00.000Z')
    expect(store.observations.size).toBe(1)
  })

  it('requiere tres ausencias exitosas y nunca elimina el candidato', async () => {
    const store = new MemoryStore(); await processProductDiscoveryProposal(store, proposal(), { dryRun: false, now })
    for (let run = 1; run <= 3; run += 1) {
      const absent = proposal({ proposalId: `discovery-absent-${run}`, observedAt: `2026-08-${24 + run}T12:00:00.000Z`, sourceHash: String(run).repeat(64).slice(0, 64), candidates: [] })
      await processProductDiscoveryProposal(store, absent, { dryRun: false, now: () => new Date(`2026-08-${24 + run}T13:00:00Z`) })
      expect(store.candidates.has(baseCandidate.candidateId)).toBe(true)
      expect(store.candidates.get(baseCandidate.candidateId)?.observationState).toBe(run < 3 ? 'OBSERVED' : 'NO_LONGER_OBSERVED')
    }
  })

  it('una observación posterior restaura OBSERVED sin alterar aprobación humana', async () => {
    const store = new MemoryStore(); const existing = {
      ...baseCandidate, observationState: 'NO_LONGER_OBSERVED' as const, reviewState: 'APPROVED_FOR_MODELING' as const,
      discoveredAt: '2026-08-01T12:00:00Z', lastObservedAt: '2026-08-01T12:00:00Z', missedSuccessfulRuns: 3, lastSourceHash: 'f'.repeat(64),
    }
    store.candidates.set(baseCandidate.candidateId, existing)
    store.states.set('ticket-catalog', { sourceId: 'ticket-catalog', sourceIndexUrl: baseCandidate.sourceIndexUrl, sourceHash: 'f'.repeat(64), lastSuccessfulAt: '2026-08-23T12:00:00Z', observedCandidateIds: [], trackedCandidateIds: [baseCandidate.candidateId], proposalId: 'old-proposal' })
    await processProductDiscoveryProposal(store, proposal(), { dryRun: false, now })
    expect(store.candidates.get(baseCandidate.candidateId)).toMatchObject({ observationState: 'OBSERVED', reviewState: 'APPROVED_FOR_MODELING', missedSuccessfulRuns: 0 })
  })
})
