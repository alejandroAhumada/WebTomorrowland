import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  RESEARCH_SOURCES, buildPriceProposal, createSyncApiClient, extractExactProductPrice, officialResearchUrl,
  parseBrlAmount, processProposal, relevantSourceHash, researchSource, safeFetchOfficialPage,
  sanitizeResearchError, type FetchedOfficialPage, type ResearchEvidence, type SyncApiClient,
} from './tomorrowlandResearch'
import type { PlanSyncResponse } from '../functions/src/planSync'

const source = RESEARCH_SOURCES.find((item) => item.id === 'easy-tent-2p')!
const observedAt = '2026-08-12T13:20:00.000Z'

function html(title = 'Easy Tent 2P', price = '7609.00', extra = ''): string {
  return `<!doctype html><html><body>${extra}<h1>${title} Package</h1><h3>${title}</h3><div><span>R$ ${price}</span></div><script>{"updated_at":"${observedAt}"}</script></body></html>`
}

function page(body = html()): FetchedOfficialPage {
  return { url: source.url, html: body, fetchedAt: '2026-08-21T12:00:00.000Z' }
}

function response(result: PlanSyncResponse['result'], dryRun: boolean): PlanSyncResponse {
  return { proposalId: 'research-proposal-001', planId: 'easy-tent-2p-2027', result, changedFields: result === 'UPDATED' ? ['price'] : [], dryRun }
}

describe('extracción determinista Tomorrowland', () => {
  it('extrae un precio oficial asociado al producto exacto', () => {
    expect(extractExactProductPrice(html(), 'Easy Tent 2P')).toMatchObject({ amount: 7609, evidence: 'Easy Tent 2P · R$ 7609.00' })
  })

  it.each([
    ['7.609,00', 7609], ['7609.00', 7609], ['7,609.00', 7609], ['7609', 7609],
  ])('normaliza precio BRL %s', (raw, expected) => expect(parseBrlAmount(raw)).toBe(expected))

  it('rechaza precio negativo, texto y valores absurdos', () => {
    expect(() => parseBrlAmount('-1')).toThrow('inválido')
    expect(() => parseBrlAmount('texto')).toThrow('inválido')
    expect(() => parseBrlAmount('99999999')).toThrow('rango')
  })

  it('no confunde un producto diferente', () => {
    expect(extractExactProductPrice(html('Easy Tent 4P'), 'Easy Tent 2P')).toBeNull()
  })

  it('rechaza múltiples precios distintos para el mismo título', () => {
    const ambiguous = html().replace('</body>', '<h3>Easy Tent 2P</h3><div>R$ 7999.00</div></body>')
    expect(() => extractExactProductPrice(ambiguous, 'Easy Tent 2P')).toThrow('ambiguo')
  })

  it('marca precio ausente como PARSE_FAILED y no propone', () => {
    const result = researchSource(source, page('<!doctype html><html><h1>Easy Tent 2P</h1></html>'))
    expect(result).toMatchObject({ status: 'PARSE_FAILED', proposals: [] })
  })

  it('crea propuesta oficial con evidencia pequeña', () => {
    const result = researchSource(source, page())
    expect(result.status).toBe('PROPOSAL_CREATED')
    expect(result.evidence[0].evidence.length).toBeLessThanOrEqual(180)
    expect(result.proposals[0].changes.price).toEqual({ totalPrice: { amount: 7609, currency: 'BRL' }, priceType: 'OFFICIAL' })
  })

  it('el hash relevante ignora contenido irrelevante', () => {
    const evidence = researchSource(source, page()).evidence
    expect(relevantSourceHash(source, html(), evidence)).toBe(relevantSourceHash(source, html(undefined, undefined, '<footer>cambio irrelevante</footer>'), evidence))
  })

  it('una página idéntica se marca NO_SOURCE_CHANGE y no reprocesa', () => {
    const first = researchSource(source, page())
    expect(researchSource(source, page(), first.hash)).toMatchObject({ status: 'NO_SOURCE_CHANGE' })
  })

  it('proposalId es determinista para la misma evidencia', () => {
    const evidence = researchSource(source, page()).evidence[0]
    expect(buildPriceProposal(evidence).proposalId).toBe(buildPriceProposal(evidence).proposalId)
  })

  it('impide crear automáticamente un plan desconocido', () => {
    const evidence: ResearchEvidence = { ...researchSource(source, page()).evidence[0], planId: 'nuevo-plan-2027' }
    expect(() => buildPriceProposal(evidence)).toThrow('plan desconocido')
  })

  it('mantiene full-madness-2p como estimado y solo propone el precio unitario oficial', () => {
    const festival = RESEARCH_SOURCES.find((item) => item.id === 'festival-tickets')!
    const result = researchSource(festival, { ...page(html('Full Madness Pass', '3160.00')), url: festival.url })
    expect(result.proposals.map((item) => item.planId)).toEqual(['full-madness-1p-2027'])
    expect(result.notes.join(' ')).toContain('conserva ESTIMATED')
  })

  it('Global Journey PENDING solo pasa a propuesta con ocupación explícita', () => {
    const hotels = RESEARCH_SOURCES.find((item) => item.id === 'global-journey-hotels')!
    const explicit = '<!doctype html><html><h3>Hotel Package for 1 person</h3><div>R$ 9000.00</div><script>{"updated_at":"2026-08-20T12:00:00Z"}</script></html>'
    const result = researchSource(hotels, { ...page(explicit), url: hotels.url })
    expect(result.proposals.map((item) => item.planId)).toEqual(['global-journey-hotel-1p-2027'])
    expect(result.notes.join(' ')).toContain('global-journey-hotel-2p-2027')
  })

  it('Global Journey ambiguo no genera propuestas', () => {
    const hotels = RESEARCH_SOURCES.find((item) => item.id === 'global-journey-hotels')!
    const ambiguous = '<!doctype html><html><h3>Hotel Package 1P</h3><div>R$ 9000.00</div><h3>Hotel Package for 1 person</h3><div>R$ 9100.00</div></html>'
    expect(researchSource(hotels, { ...page(ambiguous), url: hotels.url })).toMatchObject({ status: 'PARSE_FAILED', proposals: [] })
  })
})

describe('fetch seguro de fuentes oficiales', () => {
  it('acepta únicamente HTTPS y host exacto oficial', () => {
    expect(officialResearchUrl(source.url)).toBe(source.url)
    expect(() => officialResearchUrl('https://tomorrowland.com.evil.example/path')).toThrow('allowlist')
    expect(() => officialResearchUrl('http://brasil.tomorrowland.com/path')).toThrow('allowlist')
  })

  it('acepta HTML oficial válido', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(html(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }))
    await expect(safeFetchOfficialPage(source.url, fetcher)).resolves.toMatchObject({ url: source.url })
  })

  it('rechaza redirect fuera de allowlist', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://evil.example/page' } }))
    await expect(safeFetchOfficialPage(source.url, fetcher)).rejects.toThrow('allowlist')
  })

  it.each([404, 500])('rechaza HTTP %s', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('error', { status, headers: { 'content-type': 'text/html' } }))
    await expect(safeFetchOfficialPage(source.url, fetcher)).rejects.toThrow(`HTTP ${status}`)
  })

  it('reporta timeout/fallo de red de forma sanitizada', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'))
    await expect(safeFetchOfficialPage(source.url, fetcher)).rejects.toThrow('timeout')
  })

  it('rechaza HTML inválido y content-type inesperado', async () => {
    const invalidHtml = vi.fn<typeof fetch>().mockResolvedValue(new Response('texto', { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(safeFetchOfficialPage(source.url, invalidHtml)).rejects.toThrow('HTML inválido')
    const json = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    await expect(safeFetchOfficialPage(source.url, json)).rejects.toThrow('tipo de contenido')
  })

  it('rechaza una página de captcha aunque sea HTML válido', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<!doctype html><html><h1>Captcha challenge</h1></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(safeFetchOfficialPage(source.url, fetcher)).rejects.toThrow('desafío o bloqueo')
  })

  it('rechaza respuestas demasiado grandes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(html() + 'x'.repeat(200), { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(safeFetchOfficialPage(source.url, fetcher, { maxBytes: 100 })).rejects.toThrow('demasiado grande')
  })
})

describe('barrera Sync API', () => {
  const proposal = researchSource(source, page()).proposals[0]

  it('NO_CHANGE solo realiza dry-run', async () => {
    const client: SyncApiClient = { submit: vi.fn().mockResolvedValue(response('NO_CHANGE', true)) }
    const result = await processProposal(client, proposal, true)
    expect(result.applied).toBeUndefined()
    expect(client.submit).toHaveBeenCalledTimes(1)
  })

  it('UPDATED realiza escritura solo después del dry-run', async () => {
    const submit = vi.fn().mockResolvedValueOnce(response('UPDATED', true)).mockResolvedValueOnce(response('UPDATED', false))
    const result = await processProposal({ submit }, proposal, true)
    expect(result.applied?.result).toBe('UPDATED')
    expect(submit.mock.calls.map((call) => call[1])).toEqual([true, false])
  })

  it('REJECTED no intenta escritura', async () => {
    const client: SyncApiClient = { submit: vi.fn().mockResolvedValue(response('REJECTED', true)) }
    await processProposal(client, proposal, true)
    expect(client.submit).toHaveBeenCalledTimes(1)
  })

  it('fallo de dry-run no intenta escritura', async () => {
    const client: SyncApiClient = { submit: vi.fn().mockRejectedValue(new Error('API unavailable')) }
    await expect(processProposal(client, proposal, true)).rejects.toThrow('unavailable')
    expect(client.submit).toHaveBeenCalledTimes(1)
  })

  it('modo investigación nunca aplica aunque dry-run indique UPDATED', async () => {
    const client: SyncApiClient = { submit: vi.fn().mockResolvedValue(response('UPDATED', true)) }
    const result = await processProposal(client, proposal, false)
    expect(result.applied).toBeUndefined()
  })

  it('autenticación está desacoplada y no expone el token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response('NO_CHANGE', true)), { status: 200, headers: { 'content-type': 'application/json' } }))
    await createSyncApiClient('secret-id-token', fetcher).submit(proposal, true)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(JSON.stringify(proposal)).not.toContain('secret-id-token')
    expect(() => createSyncApiClient('')).toThrow('ID token')
  })

  it('sanitiza tokens y credenciales en errores', () => {
    const value = sanitizeResearchError(new Error('Bearer abc.def token=secret\nprivate_key=hidden'))
    expect(value).not.toContain('abc.def')
    expect(value).not.toContain('secret')
    expect(value).not.toContain('hidden')
  })

  it('no importa Firebase Admin ni Firestore', async () => {
    const code = await readFile(new URL('./tomorrowlandResearch.ts', import.meta.url), 'utf8')
    expect(code).not.toMatch(/firebase-admin|firestore/i)
  })
})
