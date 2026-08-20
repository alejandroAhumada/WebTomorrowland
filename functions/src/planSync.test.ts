import { beforeEach, describe, expect, it } from 'vitest'
import { productionPlans } from '../../scripts/productionPlans'
import type { TravelPlan } from '../../src/models/plan'
import {
  evaluateProposal, officialSourceUrl, parsePlanSyncProposal, processPlanSyncProposal,
  type PlanHistory, type PlanSyncAudit, type PlanSyncProposal, type PlanSyncState, type PlanSyncStore,
  type PlanSyncTransaction, type StoredProposal,
} from './planSync'
import { sanitizeSyncError } from './index'

const now = () => new Date('2026-09-03T15:00:00.000Z')
const officialUrl = 'https://brasil.tomorrowland.com/en/tickets/festival-tickets/'

function proposal(changes: PlanSyncProposal['changes'], overrides: Partial<PlanSyncProposal> = {}): PlanSyncProposal {
  return {
    proposalId: 'proposal-valid-001',
    planId: 'easy-tent-2p-2027',
    observedAt: '2026-09-03T12:00:00.000Z',
    source: { url: officialUrl, type: 'OFFICIAL', publisher: 'Tomorrowland' },
    changes,
    ...overrides,
  }
}

class MemoryStore implements PlanSyncStore {
  plans = new Map<string, TravelPlan>()
  processed = new Map<string, StoredProposal & { processedAt: string }>()
  audits = new Map<string, PlanSyncAudit>()
  histories = new Map<string, PlanHistory>()
  states = new Map<string, PlanSyncState>()

  constructor(plans: TravelPlan[] = productionPlans) { plans.forEach((plan) => this.plans.set(plan.id, structuredClone(plan))) }

  async runTransaction<T>(operation: (transaction: PlanSyncTransaction) => Promise<T>): Promise<T> {
    const transaction: PlanSyncTransaction = {
      getPlan: async (id) => structuredClone(this.plans.get(id) ?? null),
      getProcessedProposal: async (id) => structuredClone(this.processed.get(id) ?? null),
      getPlanSyncState: async (id) => structuredClone(this.states.get(id) ?? null),
      setPlan: (plan) => { this.plans.set(plan.id, structuredClone(plan)) },
      setProcessedProposal: (id, value) => { this.processed.set(id, structuredClone(value)) },
      setPlanSyncState: (id, value) => { this.states.set(id, structuredClone(value)) },
      setAudit: (id, value) => { this.audits.set(id, structuredClone(value)) },
      setHistory: (planId, id, value) => { this.histories.set(`${planId}/${id}`, structuredClone(value)) },
    }
    return operation(transaction)
  }
}

describe('contrato Tomorrowland Plan Sync', () => {
  it('sanitiza errores sin conservar tokens ni saltos de línea', () => {
    const sanitized = sanitizeSyncError(new Error('request failed\nAuthorization: Bearer secret-token password=hidden'))
    expect(sanitized).not.toContain('secret-token')
    expect(sanitized).not.toContain('hidden')
    expect(sanitized).not.toMatch(/[\r\n]/)
  })
  it('acepta una propuesta oficial válida y normaliza observedAt', () => {
    const parsed = parsePlanSyncProposal(proposal({ status: 'AVAILABLE' }))
    expect(parsed.observedAt).toBe('2026-09-03T12:00:00.000Z')
  })

  it.each([
    [{}, 'proposalId'],
    [{ ...proposal({ status: 'AVAILABLE' }), unknown: true }, 'campos no permitidos'],
    [{ ...proposal({ status: 'AVAILABLE' }), changes: {} }, 'al menos un cambio'],
    [{ ...proposal({ status: 'AVAILABLE' }), observedAt: '03/09/2026' }, 'timestamp ISO'],
    [{ ...proposal({ status: 'AVAILABLE' }), observedAt: '2026-02-31T12:00:00Z' }, 'fecha calendario inválida'],
  ])('rechaza schema inválido', (input, message) => {
    expect(() => parsePlanSyncProposal(input)).toThrow(message as string)
  })

  it.each(['https://tomorrowland.com/path', 'https://www.tomorrowland.com/path', officialUrl])('acepta host oficial exacto: %s', (url) => {
    expect(officialSourceUrl(url)).toBe(url)
  })

  it.each([
    'https://tomorrowland.com.evil.example/path',
    'http://tomorrowland.com/path',
    'https://localhost/path',
    'https://127.0.0.1/path',
    'ftp://brasil.tomorrowland.com/path',
  ])('rechaza URL no oficial: %s', (url) => {
    expect(() => officialSourceUrl(url)).toThrow('fuente oficial permitida')
  })

  it('rechaza OFFICIAL sin fuente oficial y campos estructurales', () => {
    expect(() => parsePlanSyncProposal({ ...proposal({ status: 'AVAILABLE' }), source: { url: officialUrl, type: 'ESTIMATE', publisher: 'Tomorrowland' } })).toThrow('fuente debe ser oficial')
    expect(() => parsePlanSyncProposal({ ...proposal({ status: 'AVAILABLE' }), changes: { camping: { required: true, equipmentProvided: false } } })).toThrow('campos no permitidos')
    expect(() => parsePlanSyncProposal({ ...proposal({ status: 'AVAILABLE' }), changes: { travelerCount: 1 } })).toThrow('campos no permitidos')
  })

  it('rechaza precio negativo, moneda inválida y precio pendiente inconsistente', () => {
    expect(() => parsePlanSyncProposal(proposal({ price: { totalPrice: { amount: -1, currency: 'BRL' }, priceType: 'OFFICIAL' } }))).toThrow('mayor que cero')
    expect(() => parsePlanSyncProposal(proposal({ price: { totalPrice: { amount: 10, currency: 'GBP' as 'BRL' }, priceType: 'OFFICIAL' } }))).toThrow('moneda')
    expect(() => parsePlanSyncProposal(proposal({ price: { totalPrice: null, priceType: 'OFFICIAL' } }))).toThrow('priceType null')
  })
})

describe('barrera de dominio y persistencia', () => {
  let store: MemoryStore
  beforeEach(() => { store = new MemoryStore() })

  it('permite PENDING → OFFICIAL', () => {
    const current = store.plans.get('global-journey-hotel-1p-2027')!
    const result = evaluateProposal(current, proposal(
      { price: { totalPrice: { amount: 9000, currency: 'BRL' }, priceType: 'OFFICIAL' } },
      { planId: current.id },
    ), now().toISOString())
    expect(result.candidate.priceType).toBe('OFFICIAL')
  })

  it('permite ESTIMATED → OFFICIAL', () => {
    const current = store.plans.get('full-madness-2p-2027')!
    expect(evaluateProposal(current, proposal(
      { price: { totalPrice: { amount: 6400, currency: 'BRL' }, priceType: 'OFFICIAL' } },
      { planId: current.id },
    ), now().toISOString()).candidate.priceType).toBe('OFFICIAL')
  })

  it('permite corrección OFFICIAL → OFFICIAL y conserva identidad estructural', () => {
    const current = store.plans.get('easy-tent-2p-2027')!
    const result = evaluateProposal(current, proposal({ price: { totalPrice: { amount: 7799, currency: 'BRL' }, priceType: 'OFFICIAL' } }), now().toISOString())
    expect(result.changedFields).toEqual(['price'])
    expect(result.candidate.totalPrice?.amount).toBe(7799)
    expect(result.candidate.travelerCount).toBe(current.travelerCount)
    expect(result.candidate.camping).toEqual(current.camping)
  })

  it.each([
    { totalPrice: { amount: 7000, currency: 'BRL' as const }, priceType: 'ESTIMATED' as const },
    { totalPrice: null, priceType: null },
  ])('rechaza degradar OFFICIAL a estimado o pendiente', (price) => {
    expect(() => evaluateProposal(store.plans.get('easy-tent-2p-2027')!, proposal({ price }), now().toISOString())).toThrow('no puede degradarse')
  })

  it('rechaza una propuesta antigua y una fecha futura', () => {
    const current = { ...store.plans.get('easy-tent-2p-2027')!, sourceObservedAt: '2026-09-03T13:00:00.000Z' }
    expect(() => evaluateProposal(current, proposal({ status: 'AVAILABLE' }), now().toISOString())).toThrow('anterior')
    expect(() => evaluateProposal(current, proposal({ status: 'AVAILABLE' }, { observedAt: '2026-09-03T15:06:00.000Z' }), now().toISOString())).toThrow('futuro')
  })

  it('devuelve NO_CHANGE sin alterar plan, crea auditoría y no crea historial', async () => {
    const current = store.plans.get('easy-tent-2p-2027')!
    const input = proposal({ price: { totalPrice: current.totalPrice, priceType: current.priceType } })
    const result = await processPlanSyncProposal(store, input, { dryRun: false, now })
    expect(result.result).toBe('NO_CHANGE')
    expect(store.audits.get(input.proposalId)).toMatchObject({ jobType: 'TOMORROWLAND_PLAN_SYNC', result: 'NO_CHANGE', previousPrice: current.totalPrice, finalPrice: current.totalPrice, error: null })
    expect(store.histories.size).toBe(0)
    expect(store.states.get(input.planId)?.latestObservedAt).toBe(input.observedAt)
  })

  it('actualiza atómicamente plan, auditoría, historial e idempotencia', async () => {
    const input = proposal({ status: 'AVAILABLE' })
    const result = await processPlanSyncProposal(store, input, { dryRun: false, now })
    expect(result).toMatchObject({ result: 'UPDATED', changedFields: ['status'] })
    expect(store.plans.get(input.planId)?.status).toBe('AVAILABLE')
    expect(store.audits.get(input.proposalId)?.result).toBe('UPDATED')
    expect(store.histories.get(`${input.planId}/${input.proposalId}`)).toMatchObject({ previousValues: { status: 'COMING_SOON' }, newValues: { status: 'AVAILABLE' } })
    expect(store.processed.has(input.proposalId)).toBe(true)
  })

  it('es idempotente y rechaza reutilizar proposalId con otro payload', async () => {
    const input = proposal({ status: 'AVAILABLE' })
    await processPlanSyncProposal(store, input, { dryRun: false, now })
    expect((await processPlanSyncProposal(store, input, { dryRun: false, now })).result).toBe('ALREADY_PROCESSED')
    const conflict = await processPlanSyncProposal(store, { ...input, changes: { status: 'UNAVAILABLE' } }, { dryRun: false, now })
    expect(conflict).toMatchObject({ result: 'REJECTED', rejectionCode: 'IDEMPOTENCY_CONFLICT' })
    expect(store.audits.size).toBe(1)
  })

  it('dry-run usa las reglas reales sin escribir Firestore lógico', async () => {
    const input = proposal({ status: 'AVAILABLE' })
    const result = await processPlanSyncProposal(store, input, { dryRun: true, now })
    expect(result).toMatchObject({ result: 'UPDATED', dryRun: true, changedFields: ['status'] })
    expect((await processPlanSyncProposal(store, input, { dryRun: true, now })).result).toBe('UPDATED')
    expect(store.audits.size).toBe(0)
    expect(store.histories.size).toBe(0)
    expect(store.processed.size).toBe(0)
    expect(store.states.size).toBe(0)
    expect(store.plans.get('easy-tent-2p-2027')?.status).toBe('COMING_SOON')
  })

  it('un NO_CHANGE reciente impide una actualización posterior más antigua sin tocar el plan', async () => {
    const current = store.plans.get('easy-tent-2p-2027')!
    await processPlanSyncProposal(store, proposal(
      { price: { totalPrice: current.totalPrice, priceType: current.priceType } },
      { proposalId: 'proposal-newer-nochange', observedAt: '2026-09-03T14:00:00.000Z' },
    ), { dryRun: false, now })
    const stale = await processPlanSyncProposal(store, proposal(
      { status: 'AVAILABLE' },
      { proposalId: 'proposal-older-update', observedAt: '2026-09-03T13:00:00.000Z' },
    ), { dryRun: false, now })
    expect(stale).toMatchObject({ result: 'REJECTED', rejectionCode: 'STALE_PROPOSAL' })
    expect(store.plans.get(current.id)).toEqual(current)
  })

  it('rechaza plan desconocido y audita un error sanitizado', async () => {
    const input = proposal({ status: 'AVAILABLE' }, { planId: 'unknown-plan-2027' })
    const result = await processPlanSyncProposal(store, input, { dryRun: false, now })
    expect(result).toMatchObject({ result: 'REJECTED', rejectionCode: 'PLAN_NOT_FOUND' })
    expect(store.audits.get(input.proposalId)).toMatchObject({ result: 'REJECTED', error: 'El plan no existe.' })
    expect(store.audits.get(input.proposalId)?.error).not.toMatch(/[\r\n]/)
  })
})
