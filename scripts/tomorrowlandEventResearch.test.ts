import { describe, expect, it, vi } from 'vitest'
import type { EventSyncResponse } from '../functions/src/eventSync'
import {
  EVENT_RESEARCH_SOURCES, buildEventProposal, createEventSyncApiClient, detectFestivalEvent,
  detectSalesEvents, eventSourceHash, parseOfficialDate, processEventProposal, researchEventSource,
  type EventSyncApiClient,
} from './tomorrowlandEventResearch'

const salesUrl = EVENT_RESEARCH_SOURCES[0].url
const salesFixture = `<!doctype html><html><body>
  <h1>Tomorrowland Brasil 2027 Sales Dates</h1>
  <h2>Pre-Registration</h2><p>Pre-Registration is open from April 30, 2026 - 10:00 BRT until September 23, 2026 - 23:59 BRT.</p>
  <h2>Global Journey Travel Packages Sale</h2><p>The Global Journey Price Simulator is available September 3, 2026 - 10:00 BRT.</p><p>Global Journey Travel Packages Sale starts September 15, 2026 - 10:00 BRT.</p>
  <h2>Exclusive Bybit Pre-Sale</h2><p>Exclusive Bybit Pre-Sale starts September 21, 2026 - 10:00 BRT.</p>
  <h2>WorldWide Ticket Sale</h2><p>WorldWide Ticket Sale starts September 24, 2026 - 10:00 BRT.</p>
  </body></html>`
const festivalFixture = '<!doctype html><html><body><h1>Tomorrowland Brasil 2027</h1><p>Tomorrowland Brasil 2027 returns to Parque Maeda from April 30 to May 2, 2027.</p></body></html>'

function eventResponse(result: EventSyncResponse['result'], dryRun: boolean): EventSyncResponse {
  return { proposalId: 'event-proposal', eventId: 'global-journey-sale-2027', result, changedFields: result === 'UPDATED' ? ['startsAt'] : [], dryRun }
}

describe('investigación determinista de acontecimientos', () => {
  it('detecta los cinco hitos de venta conocidos', () => {
    expect(detectSalesEvents(salesFixture, salesUrl).map((event) => event.eventId)).toEqual([
      'pre-registration-2027', 'global-journey-simulator-2027', 'global-journey-sale-2027',
      'bybit-pre-sale-2027', 'worldwide-ticket-sale-2027',
    ])
  })

  it('detecta el rango oficial del festival', () => {
    expect(detectFestivalEvent(festivalFixture.replace(/<[^>]+>/g, ' '), EVENT_RESEARCH_SOURCES[1].url)[0]).toMatchObject({
      eventId: 'tomorrowland-brasil-2027', startsAt: '2027-04-30', endsAt: '2027-05-02',
    })
  })

  it('normaliza fecha BRT sin depender del timezone', () => {
    expect(parseOfficialDate('September 3, 2026 - 10:00 BRT')).toBe('2026-09-03T10:00:00-03:00')
    expect(parseOfficialDate('May 2, 2027')).toBe('2027-05-02')
  })

  it('rechaza fechas imposibles y formatos ambiguos', () => {
    expect(() => parseOfficialDate('February 31, 2026')).toThrow('inválida')
    expect(() => parseOfficialDate('03/09/2026')).toThrow('no reconocida')
  })

  it('misma fuente conserva hash y queda NO_SOURCE_CHANGE', () => {
    const source = EVENT_RESEARCH_SOURCES[0]
    const page = { url: source.url, html: salesFixture, fetchedAt: '2026-08-22T12:00:00.000Z' }
    const first = researchEventSource(source, page)
    expect(researchEventSource(source, page, first.hash).status).toBe('NO_SOURCE_CHANGE')
    expect(eventSourceHash(source.id, first.detected)).toBe(first.hash)
  })

  it('contenido irrelevante no cambia el hash de evidencia', () => {
    const source = EVENT_RESEARCH_SOURCES[0]
    const base = researchEventSource(source, { url: source.url, html: salesFixture, fetchedAt: '2026-08-22T12:00:00Z' })
    const changed = researchEventSource(source, { url: source.url, html: salesFixture.replace('</body>', '<footer>Newsletter nueva</footer></body>'), fetchedAt: '2026-08-22T12:00:00Z' })
    expect(changed.hash).toBe(base.hash)
  })

  it('no propone un acontecimiento sin fecha', () => {
    expect(detectSalesEvents('<h1>Tomorrowland Brasil 2027</h1><h2>DreamVille Sale</h2>', salesUrl)).toEqual([])
  })

  it('crea conservadoramente un hito nuevo inequívoco', () => {
    const fixture = 'Tomorrowland Brasil 2027. DreamVille Package Sale starts October 1, 2026 - 10:00 BRT.'
    const event = detectSalesEvents(fixture, salesUrl)[0]
    expect(event).toMatchObject({ eventId: 'dreamville-package-sale-2027', operation: 'CREATE', type: 'SALE' })
    expect(buildEventProposal(event, '2026-08-22T12:00:00Z').operation).toBe('CREATE')
  })

  it('proposalId es determinista para la misma evidencia', () => {
    const event = detectSalesEvents(salesFixture, salesUrl)[1]
    expect(buildEventProposal(event, '2026-08-22T12:00:00Z').proposalId).toBe(buildEventProposal(event, '2026-08-22T12:00:00Z').proposalId)
  })

  it('una fecha conocida distinta sin reprogramación explícita no se propone', () => {
    const source = EVENT_RESEARCH_SOURCES[0]
    const changed = salesFixture.replace('September 15, 2026 - 10:00 BRT', 'September 16, 2026 - 10:00 BRT')
    const result = researchEventSource(source, { url: source.url, html: changed, fetchedAt: '2026-08-22T12:00:00Z' })
    expect(result.proposals.some((proposal) => proposal.eventId === 'global-journey-sale-2027')).toBe(false)
    expect(result.notes.join(' ')).toContain('sin evidencia explícita')
  })

  it('una reprogramación explícita genera UPDATE con evidencia', () => {
    const source = EVENT_RESEARCH_SOURCES[0]
    const changed = salesFixture.replace('Global Journey Travel Packages Sale starts September 15, 2026 - 10:00 BRT.', 'Global Journey Travel Packages Sale new date September 16, 2026 - 10:00 BRT.')
    const result = researchEventSource(source, { url: source.url, html: changed, fetchedAt: '2026-08-22T12:00:00Z' })
    expect(result.proposals.find((proposal) => proposal.eventId === 'global-journey-sale-2027')).toMatchObject({ evidence: { kind: 'RESCHEDULE' } })
  })

  it('ausencia de un evento no crea cancelación', () => {
    const withoutBybit = salesFixture.replace(/<h2>Exclusive Bybit[\s\S]*?<\/p>/, '')
    expect(detectSalesEvents(withoutBybit, salesUrl).find((event) => event.eventId === 'bybit-pre-sale-2027')).toBeUndefined()
  })

  it('solo propone cancelación cuando existe evidencia oficial explícita', () => {
    const fixture = 'Tomorrowland Brasil 2027. Global Journey Travel Packages Sale has been cancelled.'
    const event = detectSalesEvents(fixture, salesUrl)[0]
    expect(event).toMatchObject({ eventId: 'global-journey-sale-2027', status: 'CANCELLED', evidenceKind: 'CANCELLATION' })
    expect(buildEventProposal(event, '2026-08-22T12:00:00Z')).toMatchObject({ changes: { status: 'CANCELLED' }, evidence: { kind: 'CANCELLATION' } })
  })

  it('ignora contenido de otra edición', () => {
    const source = EVENT_RESEARCH_SOURCES[0]
    const result = researchEventSource(source, { url: source.url, html: salesFixture.replaceAll('2027', '2026'), fetchedAt: '2026-08-22T12:00:00Z' })
    expect(result).toMatchObject({ status: 'PARSE_FAILED', proposals: [] })
  })
})

describe('cliente de Important Events Sync API', () => {
  const proposal = buildEventProposal(detectSalesEvents(salesFixture, salesUrl)[2], '2026-08-22T12:00:00Z')

  it('NO_CHANGE termina después del dry-run', async () => {
    const submit = vi.fn().mockResolvedValue(eventResponse('NO_CHANGE', true))
    expect((await processEventProposal({ submit }, proposal, true)).applied).toBeUndefined()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('UPDATED aplica solo tras dry-run aceptado', async () => {
    const submit = vi.fn().mockResolvedValueOnce(eventResponse('UPDATED', true)).mockResolvedValueOnce(eventResponse('UPDATED', false))
    expect((await processEventProposal({ submit }, proposal, true)).applied?.result).toBe('UPDATED')
    expect(submit.mock.calls.map((call) => call[1])).toEqual([true, false])
  })

  it('REJECTED y error de dry-run nunca escriben', async () => {
    const rejected = vi.fn().mockResolvedValue(eventResponse('REJECTED', true))
    await processEventProposal({ submit: rejected }, proposal, true)
    expect(rejected).toHaveBeenCalledTimes(1)
    const failed: EventSyncApiClient = { submit: vi.fn().mockRejectedValue(new Error('unavailable')) }
    await expect(processEventProposal(failed, proposal, true)).rejects.toThrow('unavailable')
    expect(failed.submit).toHaveBeenCalledTimes(1)
  })

  it('modo apply=false nunca escribe aunque el dry-run acepte', async () => {
    const submit = vi.fn().mockResolvedValue(eventResponse('UPDATED', true))
    expect((await processEventProposal({ submit }, proposal, false)).applied).toBeUndefined()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('autenticación queda desacoplada y el token no entra al payload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(eventResponse('NO_CHANGE', true)), { status: 200, headers: { 'content-type': 'application/json' } }))
    await createEventSyncApiClient('private-id-token', fetcher).submit(proposal, true)
    expect(JSON.stringify(proposal)).not.toContain('private-id-token')
    expect(() => createEventSyncApiClient('')).toThrow('ID token')
  })
})
