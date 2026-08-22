import { beforeEach, describe, expect, it } from 'vitest'
import { initialImportantEvents } from '../../src/data/importantEvents'
import type { ImportantEvent } from '../../src/models/importantEvent'
import {
  evaluateEventProposal, parseEventSyncProposal, processEventSyncProposal, sanitizeEventError,
  type EventHistory, type EventSyncAudit, type EventSyncProposal, type EventSyncState,
  type EventSyncStore, type EventSyncTransaction, type StoredEventProposal,
} from './eventSync'

const now = () => new Date('2026-08-22T15:00:00.000Z')
const sourceUrl = 'https://brasil.tomorrowland.com/en/sales/sales-dates/'
const sourceHash = 'a'.repeat(64)
const current = initialImportantEvents.find((event) => event.id === 'global-journey-sale-2027')!

function proposal(overrides: Partial<EventSyncProposal> = {}): EventSyncProposal {
  return {
    proposalId: 'event-proposal-valid-001', eventId: current.id, observedAt: '2026-08-22T14:00:00.000Z',
    source: { url: sourceUrl, type: 'OFFICIAL', publisher: 'Tomorrowland' }, operation: 'UPDATE',
    changes: { title: current.title, description: current.description, startsAt: current.startsAt, type: current.type, priority: current.priority, isFeatured: current.isFeatured },
    evidence: { excerpt: 'Tomorrowland Brasil 2027 · Global Journey Sale September 15, 2026 at 10:00 BRT.', sourceHash, kind: 'CONFIRMATION' },
    ...overrides,
  }
}

function createProposal(eventId = 'dreamville-sale-2027'): EventSyncProposal {
  return proposal({
    proposalId: 'event-create-valid-001', eventId, operation: 'CREATE',
    changes: { title: 'Venta DreamVille', description: 'Venta oficial de paquetes DreamVille para Tomorrowland Brasil 2027.', startsAt: '2026-10-01T10:00:00-03:00', timeZone: 'America/Sao_Paulo', type: 'SALE', priority: 80, isFeatured: true },
    evidence: { excerpt: 'Tomorrowland Brasil 2027 announces the DreamVille sale on October 1, 2026 at 10:00 BRT.', sourceHash, kind: 'CREATE' },
  })
}

class MemoryEventStore implements EventSyncStore {
  events = new Map<string, ImportantEvent>(initialImportantEvents.map((event) => [event.id, structuredClone(event)]))
  processed = new Map<string, StoredEventProposal & { processedAt: string }>()
  audits = new Map<string, EventSyncAudit>()
  histories = new Map<string, EventHistory>()
  states = new Map<string, EventSyncState>()
  async runTransaction<T>(operation: (transaction: EventSyncTransaction) => Promise<T>): Promise<T> {
    return operation({
      getEvent: async (id) => structuredClone(this.events.get(id) ?? null),
      findEventByTitle: async (title) => structuredClone([...this.events.values()].find((event) => event.title === title) ?? null),
      getProcessedProposal: async (id) => structuredClone(this.processed.get(id) ?? null),
      getEventSyncState: async (id) => structuredClone(this.states.get(id) ?? null),
      setEvent: (event) => { this.events.set(event.id, structuredClone(event)) },
      setProcessedProposal: (id, value) => { this.processed.set(id, structuredClone(value)) },
      setEventSyncState: (id, value) => { this.states.set(id, structuredClone(value)) },
      setAudit: (id, value) => { this.audits.set(id, structuredClone(value)) },
      setHistory: (eventId, id, value) => { this.histories.set(`${eventId}/${id}`, structuredClone(value)) },
    })
  }
}

describe('contrato de Event Sync API', () => {
  it('acepta un schema estricto válido', () => expect(parseEventSyncProposal(proposal())).toMatchObject({ operation: 'UPDATE', eventId: current.id }))
  it('rechaza schema inválido y campos desconocidos', () => {
    expect(() => parseEventSyncProposal({ ...proposal(), unexpected: true })).toThrow('campos no permitidos')
    expect(() => parseEventSyncProposal({ ...proposal(), changes: {} })).toThrow('al menos un campo')
  })
  it('rechaza DELETE explícitamente', () => expect(() => parseEventSyncProposal({ ...proposal(), operation: 'DELETE' })).toThrow('DELETE no está permitido'))
  it('acepta fuente oficial y rechaza hostname falso', () => {
    expect(parseEventSyncProposal(proposal()).source.url).toBe(sourceUrl)
    expect(() => parseEventSyncProposal({ ...proposal(), source: { ...proposal().source, url: 'https://tomorrowland.com.evil.example/path' } })).toThrow('fuente oficial')
  })
  it('rechaza evidencia de otra edición', () => expect(() => parseEventSyncProposal({ ...proposal(), evidence: { ...proposal().evidence, excerpt: 'Tomorrowland Brasil 2025 sale date is available now.' } })).toThrow('Brasil 2027'))
  it('rechaza evidencia excesiva y hash inválido', () => {
    expect(() => parseEventSyncProposal({ ...proposal(), evidence: { ...proposal().evidence, excerpt: `Tomorrowland Brasil 2027 ${'x'.repeat(600)}` } })).toThrow('excerpt')
    expect(() => parseEventSyncProposal({ ...proposal(), evidence: { ...proposal().evidence, sourceHash: 'short' } })).toThrow('sourceHash')
  })
})

describe('dominio, transacción e idempotencia de eventos', () => {
  let store: MemoryEventStore
  beforeEach(() => { store = new MemoryEventStore() })

  it('permite CREATE conservador y genera historial/auditoría', async () => {
    const input = createProposal()
    const result = await processEventSyncProposal(store, input, { dryRun: false, now })
    expect(result).toMatchObject({ result: 'CREATED', dryRun: false })
    expect(store.events.get(input.eventId)?.sourceObservedAt).toBe(input.observedAt)
    expect(store.audits.get(input.proposalId)?.result).toBe('CREATED')
    expect(store.histories.get(`${input.eventId}/${input.proposalId}`)?.previousValues).toEqual({})
  })

  it('rechaza CREATE duplicado', async () => {
    const result = await processEventSyncProposal(store, createProposal(current.id), { dryRun: false, now })
    expect(result).toMatchObject({ result: 'REJECTED', rejectionCode: 'EVENT_ALREADY_EXISTS' })
  })

  it('rechaza un CREATE con otro ID pero el mismo título oficial', async () => {
    const duplicate = createProposal('otro-global-journey-2027')
    duplicate.changes.title = current.title
    const result = await processEventSyncProposal(store, duplicate, { dryRun: false, now })
    expect(result).toMatchObject({ result: 'REJECTED', rejectionCode: 'EVENT_ALREADY_EXISTS' })
  })

  it('permite UPDATE útil y registra solo campos cambiados', async () => {
    const input = proposal({ changes: { description: `${current.description} Información actualizada.` } })
    const result = await processEventSyncProposal(store, input, { dryRun: false, now })
    expect(result).toMatchObject({ result: 'UPDATED', changedFields: ['description'] })
    expect(store.histories.get(`${input.eventId}/${input.proposalId}`)?.changedFields).toEqual(['description'])
  })

  it('devuelve NO_CHANGE y audita sin historial', async () => {
    const input = proposal()
    expect((await processEventSyncProposal(store, input, { dryRun: false, now })).result).toBe('NO_CHANGE')
    expect(store.audits.get(input.proposalId)?.result).toBe('NO_CHANGE')
    expect(store.histories.size).toBe(0)
  })

  it('admite fecha futura válida con evidencia explícita de reprogramación', () => {
    const input = proposal({ changes: { startsAt: '2026-09-16T10:00:00-03:00' }, evidence: { excerpt: 'Tomorrowland Brasil 2027: Global Journey Sale rescheduled to September 16, 2026 at 10:00 BRT.', sourceHash, kind: 'RESCHEDULE' } })
    expect(evaluateEventProposal(current, input, now().toISOString()).candidate.startsAt).toBe('2026-09-16T10:00:00-03:00')
  })

  it('rechaza cambio de fecha sin evidencia de reprogramación', () => {
    expect(() => evaluateEventProposal(current, proposal({ changes: { startsAt: '2026-09-16T10:00:00-03:00' } }), now().toISOString())).toThrow('evidencia oficial explícita')
  })

  it('rechaza cambio de hora sin evidencia y ausencia de hora no elimina la existente', () => {
    expect(() => evaluateEventProposal(current, proposal({ changes: { startsAt: '2026-09-15T11:00:00-03:00' } }), now().toISOString())).toThrow('evidencia oficial explícita')
    const input = proposal({ changes: { startsAt: '2026-09-16' }, evidence: { excerpt: 'Tomorrowland Brasil 2027 sale rescheduled with a new date.', sourceHash, kind: 'RESCHEDULE' } })
    expect(() => evaluateEventProposal(current, input, now().toISOString())).toThrow('eliminar una hora')
  })

  it('permite CANCELLED solo con evidencia explícita', () => {
    const valid = proposal({ changes: { status: 'CANCELLED' }, evidence: { excerpt: 'Tomorrowland Brasil 2027: Global Journey Sale has been cancelled.', sourceHash, kind: 'CANCELLATION' } })
    expect(evaluateEventProposal(current, valid, now().toISOString()).candidate.status).toBe('CANCELLED')
    expect(() => evaluateEventProposal(current, proposal({ changes: { status: 'CANCELLED' } }), now().toISOString())).toThrow('evidencia oficial explícita')
  })

  it('la ausencia en una fuente no cancela ni modifica', () => {
    const result = evaluateEventProposal(current, proposal({ changes: { title: current.title } }), now().toISOString())
    expect(result.changedFields).toEqual([])
    expect(result.candidate.status).toBeUndefined()
  })

  it('rechaza regresión temporal', async () => {
    store.states.set(current.id, { latestObservedAt: '2026-08-22T14:30:00.000Z', proposalId: 'newer-proposal', updatedAt: now().toISOString() })
    const result = await processEventSyncProposal(store, proposal(), { dryRun: false, now })
    expect(result).toMatchObject({ result: 'REJECTED', rejectionCode: 'STALE_PROPOSAL' })
  })

  it('es idempotente y detecta conflicto', async () => {
    const input = proposal()
    await processEventSyncProposal(store, input, { dryRun: false, now })
    expect((await processEventSyncProposal(store, input, { dryRun: false, now })).result).toBe('ALREADY_PROCESSED')
    expect(await processEventSyncProposal(store, { ...input, changes: { description: 'Descripción oficial diferente y suficientemente extensa.' } }, { dryRun: false, now })).toMatchObject({ result: 'REJECTED', rejectionCode: 'IDEMPOTENCY_CONFLICT' })
    expect(store.audits.size).toBe(1)
  })

  it('dry-run CREATE y UPDATE no escriben nada', async () => {
    expect((await processEventSyncProposal(store, createProposal(), { dryRun: true, now })).result).toBe('CREATED')
    expect((await processEventSyncProposal(store, proposal({ changes: { description: `${current.description} Actualizada.` } }), { dryRun: true, now })).result).toBe('UPDATED')
    expect(store.audits.size).toBe(0); expect(store.histories.size).toBe(0); expect(store.processed.size).toBe(0); expect(store.states.size).toBe(0)
    expect(store.events.has('dreamville-sale-2027')).toBe(false)
  })

  it('sanitiza errores y credenciales', () => {
    const sanitized = sanitizeEventError(new Error('Bearer abc.def token=secret\nprivate_key=hidden'))
    expect(sanitized).not.toMatch(/abc\.def|secret|hidden|\n/)
  })
})
