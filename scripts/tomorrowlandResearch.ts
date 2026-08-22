import { createHash } from 'node:crypto'
import type { PlanSyncProposal, PlanSyncResponse } from '../functions/src/planSync'

export const SYNC_API_URL = 'https://synctomorrowlandplan-roe56dc57a-uc.a.run.app'
export const OFFICIAL_RESEARCH_HOSTS = new Set(['tomorrowland.com', 'www.tomorrowland.com', 'brasil.tomorrowland.com'])
export const KNOWN_PLAN_IDS = new Set([
  'full-madness-1p-2027', 'global-journey-hotel-1p-2027', 'full-madness-2p-2027',
  'vida-nova-2p-2027', 'easy-tent-2p-2027', 'spectacular-easy-tent-2p-2027',
  'global-journey-hotel-2p-2027',
])

export type ResearchSourceKind = 'PRICE' | 'GLOBAL_JOURNEY' | 'INFORMATIONAL'
export interface ResearchSource {
  id: string
  url: string
  kind: ResearchSourceKind
  planIds: string[]
  productTitle?: string
}

export const RESEARCH_SOURCES: ResearchSource[] = [
  {
    id: 'event-2027', kind: 'INFORMATIONAL', planIds: [],
    url: 'https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/',
  },
  {
    id: 'welcome-2027', kind: 'INFORMATIONAL', planIds: [],
    url: 'https://brasil.tomorrowland.com/en/welcome/',
  },
  {
    id: 'festival-tickets', kind: 'PRICE', productTitle: 'Full Madness Pass',
    planIds: ['full-madness-1p-2027', 'full-madness-2p-2027'],
    url: 'https://brasil.tomorrowland.com/en/tickets/festival-tickets/',
  },
  {
    id: 'global-journey-hotels', kind: 'GLOBAL_JOURNEY',
    planIds: ['global-journey-hotel-1p-2027', 'global-journey-hotel-2p-2027'],
    url: 'https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages/',
  },
  {
    id: 'easy-tent-2p', kind: 'PRICE', productTitle: 'Easy Tent 2P', planIds: ['easy-tent-2p-2027'],
    url: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/',
  },
  {
    id: 'spectacular-easy-tent-2p', kind: 'PRICE', productTitle: 'Spectacular Easy Tent 2P', planIds: ['spectacular-easy-tent-2p-2027'],
    url: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/spectacular-easy-tent-package/',
  },
  {
    id: 'vida-nova-2p', kind: 'PRICE', productTitle: 'Vida Nova 2P', planIds: ['vida-nova-2p-2027'],
    url: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/vida-nova-package/',
  },
  {
    id: 'discover-brasil', kind: 'INFORMATIONAL', planIds: [],
    url: 'https://brasil.tomorrowland.com/en/tickets/global-journey/ticket-travel-program/discover-brasil/',
  },
]

export interface ResearchEvidence {
  planId: string
  field: 'price'
  extractedValue: { amount: number; currency: 'BRL'; priceType: 'OFFICIAL' }
  sourceUrl: string
  observedAt: string
  evidence: string
}

export interface SourceResearchResult {
  sourceId: string
  sourceUrl: string
  hash: string
  status: 'NO_SOURCE_CHANGE' | 'SOURCE_CHANGED_NO_PLAN_CHANGE' | 'PROPOSAL_CREATED' | 'FETCH_FAILED' | 'PARSE_FAILED'
  evidence: ResearchEvidence[]
  proposals: PlanSyncProposal[]
  notes: string[]
  error?: string
}

export interface ResearchState { sources: Record<string, { hash: string; observedAt: string; lastProposalResults?: PlanSyncResponse['result'][] }> }
export interface FetchedOfficialPage { url: string; html: string; fetchedAt: string; lastModified?: string }
export interface FetchOptions { timeoutMs?: number; maxBytes?: number; maxRedirects?: number }

const hotelTitles: Record<string, string[]> = {
  'global-journey-hotel-1p-2027': ['Global Journey Hotel Package 1P', 'Hotel Package 1P', 'Hotel Package for 1 person'],
  'global-journey-hotel-2p-2027': ['Global Journey Hotel Package 2P', 'Hotel Package 2P', 'Hotel Package for 2 people'],
}

export async function safeFetchOfficialPage(
  input: string,
  fetchImpl: typeof fetch = fetch,
  options: FetchOptions = {},
): Promise<FetchedOfficialPage> {
  const timeoutMs = options.timeoutMs ?? 20_000
  const maxBytes = options.maxBytes ?? 1_000_000
  const maxRedirects = options.maxRedirects ?? 3
  let url = officialResearchUrl(input)
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    let response: Response
    try {
      response = await fetchImpl(url, {
        redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'WebTomorrowlandResearch/1.0 (+https://web-pack-tomorrowland.web.app)', Accept: 'text/html' },
      })
    } catch (error) {
      throw new Error(`FETCH_FAILED: ${sanitizeResearchError(error)}`, { cause: error })
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('FETCH_FAILED: redirect sin ubicación.')
      if (redirects === maxRedirects) throw new Error('FETCH_FAILED: demasiados redirects.')
      url = officialResearchUrl(new URL(location, url).toString())
      continue
    }
    if (!response.ok) throw new Error(`FETCH_FAILED: HTTP ${response.status}.`)
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.startsWith('text/html')) throw new Error('FETCH_FAILED: tipo de contenido inesperado.')
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > maxBytes) throw new Error('FETCH_FAILED: respuesta demasiado grande.')
    const html = await readLimitedBody(response, maxBytes)
    if (!/<(?:html|!doctype)\b/i.test(html)) throw new Error('PARSE_FAILED: HTML inválido.')
    if (/(?:captcha|cf-chl-|challenge-platform|unusual traffic|access denied)/i.test(html)) throw new Error('FETCH_FAILED: la fuente presentó un desafío o bloqueo.')
    return { url, html, fetchedAt: new Date().toISOString(), lastModified: response.headers.get('last-modified') ?? undefined }
  }
  throw new Error('FETCH_FAILED: redirect no resuelto.')
}

export function officialResearchUrl(input: string): string {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('URL oficial inválida.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !OFFICIAL_RESEARCH_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('URL fuera de la allowlist oficial.')
  }
  return url.toString()
}

export function extractExactProductPrice(html: string, productTitle: string): { amount: number; rawPrice: string; evidence: string } | null {
  const headings = [...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)]
  const prices: Array<{ amount: number; rawPrice: string }> = []
  for (let index = 0; index < headings.length; index += 1) {
    if (normalizeText(headings[index][1]) !== productTitle) continue
    const start = (headings[index].index ?? 0) + headings[index][0].length
    const end = headings[index + 1]?.index ?? Math.min(html.length, start + 600)
    const segment = html.slice(start, Math.min(end, start + 600))
    for (const match of segment.matchAll(/R\$\s*([0-9][0-9.,]*)/gi)) {
      prices.push({ amount: parseBrlAmount(match[1]), rawPrice: `R$ ${match[1]}` })
    }
  }
  const unique = [...new Map(prices.map((price) => [price.amount, price])).values()]
  if (unique.length === 0) return null
  if (unique.length !== 1) throw new Error(`Precio ambiguo para ${productTitle}.`)
  const selected = unique[0]
  return { ...selected, evidence: `${productTitle} · ${selected.rawPrice}`.slice(0, 180) }
}

export function parseBrlAmount(input: string): number {
  const value = input.trim().replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(value)) throw new Error('Precio BRL inválido.')
  const lastDot = value.lastIndexOf('.')
  const lastComma = value.lastIndexOf(',')
  const separator = Math.max(lastDot, lastComma)
  let normalized: string
  if (separator >= 0 && value.length - separator - 1 === 2) {
    normalized = `${value.slice(0, separator).replace(/[.,]/g, '')}.${value.slice(separator + 1)}`
  } else {
    normalized = value.replace(/[.,]/g, '')
  }
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error('Precio BRL fuera de rango.')
  return amount
}

export function researchSource(source: ResearchSource, page: FetchedOfficialPage, previousHash?: string): SourceResearchResult {
  try {
    const observedAt = sourceObservedAt(page)
    const evidence: ResearchEvidence[] = []
    const proposals: PlanSyncProposal[] = []
    const notes: string[] = []

    if (source.kind === 'PRICE') {
      const extracted = extractExactProductPrice(page.html, source.productTitle!)
      if (!extracted) throw new Error(`No existe precio explícito para ${source.productTitle}.`)
      const targetPlan = source.planIds[0]
      const item: ResearchEvidence = {
        planId: targetPlan, field: 'price', extractedValue: { amount: extracted.amount, currency: 'BRL', priceType: 'OFFICIAL' },
        sourceUrl: page.url, observedAt, evidence: extracted.evidence,
      }
      evidence.push(item)
      proposals.push(buildPriceProposal(item))
      if (source.planIds.includes('full-madness-2p-2027')) notes.push('full-madness-2p-2027 conserva ESTIMATED: no existe precio oficial explícito para 2 personas.')
    } else if (source.kind === 'GLOBAL_JOURNEY') {
      for (const planId of source.planIds) {
        const candidates = hotelTitles[planId].flatMap((title) => {
          const value = extractExactProductPrice(page.html, title)
          return value ? [{ title, value }] : []
        })
        if (candidates.length > 1) throw new Error(`Precio Global Journey ambiguo para ${planId}.`)
        if (candidates.length === 1) {
          const selected = candidates[0]
          const item: ResearchEvidence = {
            planId, field: 'price', extractedValue: { amount: selected.value.amount, currency: 'BRL', priceType: 'OFFICIAL' },
            sourceUrl: page.url, observedAt, evidence: selected.value.evidence,
          }
          evidence.push(item)
          proposals.push(buildPriceProposal(item))
        } else notes.push(`${planId}: precio por ocupación no publicado de forma inequívoca.`)
      }
    } else {
      notes.push('Fuente informativa verificada; no modifica campos de planes en esta versión.')
    }

    const hash = relevantSourceHash(source, page.html, evidence)
    const unchanged = previousHash === hash
    return {
      sourceId: source.id, sourceUrl: page.url, hash,
      status: unchanged ? 'NO_SOURCE_CHANGE' : proposals.length ? 'PROPOSAL_CREATED' : 'SOURCE_CHANGED_NO_PLAN_CHANGE',
      evidence, proposals, notes,
    }
  } catch (error) {
    return {
      sourceId: source.id, sourceUrl: page.url, hash: '', status: 'PARSE_FAILED', evidence: [], proposals: [], notes: [],
      error: sanitizeResearchError(error),
    }
  }
}

export function buildPriceProposal(evidence: ResearchEvidence): PlanSyncProposal {
  if (!KNOWN_PLAN_IDS.has(evidence.planId)) throw new Error('No se permite crear o modificar un plan desconocido.')
  const fingerprint = `${evidence.planId}|${evidence.sourceUrl}|${evidence.extractedValue.amount}|BRL|${evidence.observedAt}`
  return {
    proposalId: `research-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`,
    planId: evidence.planId,
    observedAt: evidence.observedAt,
    source: { url: officialResearchUrl(evidence.sourceUrl), type: 'OFFICIAL', publisher: 'Tomorrowland' },
    changes: { price: { totalPrice: { amount: evidence.extractedValue.amount, currency: 'BRL' }, priceType: 'OFFICIAL' } },
  }
}

export function relevantSourceHash(source: ResearchSource, html: string, evidence: ResearchEvidence[]): string {
  const relevantText = evidence.length ? [] : normalizedRelevantText(html, [source.productTitle ?? '', 'Global Journey', 'Hotel Package', 'Tomorrowland Brasil 2027'])
  const stableEvidence = evidence.map((item) => ({
    planId: item.planId, field: item.field, extractedValue: item.extractedValue,
    sourceUrl: item.sourceUrl, evidence: item.evidence,
  }))
  return createHash('sha256').update(JSON.stringify({ sourceId: source.id, relevantText, evidence: stableEvidence })).digest('hex')
}

export interface SyncApiClient { submit(proposal: PlanSyncProposal, dryRun: boolean): Promise<PlanSyncResponse> }

export function createSyncApiClient(token: string, fetchImpl: typeof fetch = fetch, endpoint = SYNC_API_URL): SyncApiClient {
  if (!token.trim()) throw new Error('Falta el ID token para Tomorrowland Sync API.')
  return {
    async submit(proposal, dryRun) {
      const response = await fetchImpl(`${endpoint}${dryRun ? '?dryRun=true' : ''}`, {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal),
      })
      const payload = await response.json().catch(() => null) as PlanSyncResponse | null
      if (!response.ok || !payload?.result) throw new Error(`Sync API falló con HTTP ${response.status}.`)
      return payload
    },
  }
}

export async function processProposal(client: SyncApiClient, proposal: PlanSyncProposal, applyChanges: boolean): Promise<{ dryRun: PlanSyncResponse; applied?: PlanSyncResponse }> {
  const dryRun = await client.submit(proposal, true)
  if (dryRun.result !== 'UPDATED' || !applyChanges) return { dryRun }
  const applied = await client.submit(proposal, false)
  if (applied.result !== 'UPDATED' && applied.result !== 'ALREADY_PROCESSED') throw new Error(`Sync API no aplicó la propuesta: ${applied.result}.`)
  return { dryRun, applied }
}

export function sanitizeResearchError(error: unknown): string {
  return (error instanceof Error ? error.message : 'Error inesperado.')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|private_key|token)["']?\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/[\r\n\t]/g, ' ').slice(0, 300)
}

function sourceObservedAt(page: FetchedOfficialPage): string {
  return `${page.fetchedAt.slice(0, 10)}T00:00:00.000Z`
}

function normalizedRelevantText(html: string, keywords: string[]): string[] {
  const text = normalizeText(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
  const lowered = text.toLowerCase()
  const windows = keywords.filter(Boolean).flatMap((keyword) => {
    const matches: string[] = []
    let index = lowered.indexOf(keyword.toLowerCase())
    while (index >= 0 && matches.length < 10) {
      matches.push(text.slice(Math.max(0, index - 80), index + keyword.length + 180))
      index = lowered.indexOf(keyword.toLowerCase(), index + keyword.length)
    }
    return matches
  })
  return [...new Set(windows)].sort()
}

function normalizeText(value: string): string {
  return value.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel(); throw new Error('FETCH_FAILED: respuesta demasiado grande.') }
    chunks.push(value)
  }
  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(combined)
}
