import { createHash } from 'node:crypto'
import { KNOWN_PLAN_IDS, officialResearchUrl, type FetchedOfficialPage } from './tomorrowlandResearch'

export const DISCOVERY_EXTRACTOR_VERSION = 1
export const DISCOVERY_SYNC_API_URL = 'https://synctomorrowlanddiscovery-roe56dc57a-uc.a.run.app'

export interface ProductDiscoverySource {
  id: string
  url: string
  allowedPathPrefix: string
}

export const PRODUCT_DISCOVERY_SOURCES: readonly ProductDiscoverySource[] = [
  { id: 'ticket-catalog', url: 'https://brasil.tomorrowland.com/en/tickets/', allowedPathPrefix: '/en/tickets/' },
  { id: 'global-journey-catalog', url: 'https://brasil.tomorrowland.com/en/tickets/global-journey/', allowedPathPrefix: '/en/tickets/global-journey/' },
  { id: 'dreamville-catalog', url: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/', allowedPathPrefix: '/en/tickets/ticket-accommodation/dreamville-packages/' },
  { id: 'magnificent-greens-catalog', url: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/', allowedPathPrefix: '/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/' },
  { id: 'easy-tent-catalog', url: 'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/', allowedPathPrefix: '/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/' },
]

const knownProductUrls = new Map<string, string>([
  ['https://brasil.tomorrowland.com/en/tickets/festival-tickets', 'full-madness-1p-2027'],
  ['https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages', 'global-journey-hotel-1p-2027'],
  ['https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/vida-nova-package', 'vida-nova-2p-2027'],
  ['https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package', 'easy-tent-2p-2027'],
  ['https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/spectacular-easy-tent-package', 'spectacular-easy-tent-2p-2027'],
])

const knownCatalogUrls = new Set([
  'https://brasil.tomorrowland.com/en/tickets',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages',
  'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages',
  'https://brasil.tomorrowland.com/en/tickets/global-journey',
  'https://brasil.tomorrowland.com/en/tickets/global-journey/ticket-accommodation-transport',
  'https://brasil.tomorrowland.com/en/tickets/global-journey/ticket-travel-program',
])

export type ProductDetectionReason = 'OFFICIAL_CATALOG_PRODUCT_LINK' | 'OFFICIAL_CATALOG_PRODUCT_CARD'

export interface DetectedProductEvidence {
  candidateId: string
  officialUrl: string
  sourceIndexUrl: string
  observedTitle: string
  excerpt: string
  evidenceHash: string
  matchedKnownPlanId?: string
  detectionReason: ProductDetectionReason
}

export interface ProductDiscoveryResult {
  sourceId: string
  sourceIndexUrl: string
  observedAt: string
  sourceHash: string
  status: 'SUCCESS' | 'PARSE_FAILED'
  knownProducts: DetectedProductEvidence[]
  candidates: DetectedProductEvidence[]
  error?: string
}

export interface ProductDiscoveryProposal {
  schemaVersion: 1
  proposalId: string
  sourceId: string
  sourceIndexUrl: string
  observedAt: string
  sourceHash: string
  extractorVersion: number
  candidates: DetectedProductEvidence[]
}

export function canonicalOfficialProductUrl(input: string, base?: string): string {
  const value = officialResearchUrl(base ? new URL(decodeHtml(input), base).toString() : decodeHtml(input))
  const url = new URL(value)
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  return url.toString().replace(/\/$/, '')
}

export function discoverOfficialProducts(source: ProductDiscoverySource, page: FetchedOfficialPage): ProductDiscoveryResult {
  const observedAt = page.fetchedAt
  try {
    const entries = extractStructuredCatalogLinks(source, page)
    if (entries.length === 0) throw new Error('La fuente no contiene cards de producto reconocibles.')
    const knownProducts: DetectedProductEvidence[] = []
    const candidates: DetectedProductEvidence[] = []
    for (const entry of entries) {
      const knownPlanId = knownProductUrls.get(entry.officialUrl)
      if (knownPlanId && KNOWN_PLAN_IDS.has(knownPlanId)) knownProducts.push({ ...entry, matchedKnownPlanId: knownPlanId })
      else if (entry.detectionReason === 'OFFICIAL_CATALOG_PRODUCT_CARD' || !knownCatalogUrls.has(entry.officialUrl)) candidates.push(entry)
    }
    const stable = entries.map(({ officialUrl, observedTitle, evidenceHash }) => ({ officialUrl, observedTitle, evidenceHash }))
      .sort((left, right) => left.officialUrl.localeCompare(right.officialUrl))
    const sourceHash = hash(JSON.stringify({ sourceId: source.id, extractorVersion: DISCOVERY_EXTRACTOR_VERSION, entries: stable }))
    return { sourceId: source.id, sourceIndexUrl: canonicalOfficialProductUrl(page.url), observedAt, sourceHash, status: 'SUCCESS', knownProducts, candidates }
  } catch (error) {
    return {
      sourceId: source.id, sourceIndexUrl: canonicalOfficialProductUrl(page.url), observedAt, sourceHash: '', status: 'PARSE_FAILED',
      knownProducts: [], candidates: [], error: sanitizeEvidenceText(error instanceof Error ? error.message : 'Error de parsing.', 240),
    }
  }
}

export function buildProductDiscoveryProposal(result: ProductDiscoveryResult): ProductDiscoveryProposal {
  if (result.status !== 'SUCCESS' || !result.sourceHash) throw new Error('Solo una observación parseada correctamente puede generar propuesta.')
  const payload = {
    schemaVersion: 1 as const,
    sourceId: result.sourceId, sourceIndexUrl: result.sourceIndexUrl, observedAt: result.observedAt,
    sourceHash: result.sourceHash, extractorVersion: DISCOVERY_EXTRACTOR_VERSION, candidates: result.candidates,
  }
  return { proposalId: `discovery-${hash(JSON.stringify(payload)).slice(0, 32)}`, ...payload }
}

export function sanitizeEvidenceText(input: unknown, maxLength = 500): string {
  return decodeHtml(String(input ?? '')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .split('').map((character) => isControlCharacter(character) ? ' ' : character).join('')
    .replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function extractStructuredCatalogLinks(source: ProductDiscoverySource, page: FetchedOfficialPage): DetectedProductEvidence[] {
  const byIdentity = new Map<string, DetectedProductEvidence>()
  const anchorPattern = /<a\b([^>]*\bclass=(?:"[^"]*cardLink[^"]*"|'[^']*cardLink[^']*')[^>]*)>([\s\S]*?)<\/a>/gi
  for (const match of page.html.matchAll(anchorPattern)) {
    const href = attribute(match[1], 'href')
    const officialUrl = href ? canonicalOfficialProductUrl(href, page.url) : canonicalOfficialProductUrl(page.url)
    const url = new URL(officialUrl)
    if (href && (!url.pathname.startsWith(source.allowedPathPrefix) || officialUrl === canonicalOfficialProductUrl(page.url))) continue
    const heading = match[2].match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1]
    const observedTitle = sanitizeEvidenceText(heading ?? '', 140)
    if (!observedTitle) continue
    const excerpt = sanitizeEvidenceText(match[2], 500)
    if (!excerpt) continue
    const candidateId = `product-${hash(href ? officialUrl : `${officialUrl}|${normalizeIdentity(observedTitle)}`).slice(0, 40)}`
    const evidenceHash = hash(JSON.stringify({ officialUrl, observedTitle, excerpt }))
    byIdentity.set(candidateId, {
      candidateId, officialUrl, sourceIndexUrl: canonicalOfficialProductUrl(page.url), observedTitle, excerpt,
      evidenceHash, detectionReason: href ? 'OFFICIAL_CATALOG_PRODUCT_LINK' : 'OFFICIAL_CATALOG_PRODUCT_CARD',
    })
  }
  return [...byIdentity.values()].sort((left, right) => left.officialUrl.localeCompare(right.officialUrl) || left.candidateId.localeCompare(right.candidateId))
}

function attribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))
  return match?.[1] ?? match?.[2] ?? null
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/gi, '&').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
}

function normalizeIdentity(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hash(value: string): string { return createHash('sha256').update(value).digest('hex') }
function isControlCharacter(value: string): boolean { const code = value.charCodeAt(0); return code <= 31 || code === 127 }

export interface DiscoverySyncResponse {
  proposalId: string
  result: 'UPDATED' | 'NO_CHANGE' | 'REJECTED' | 'ALREADY_PROCESSED'
  dryRun: boolean
  newCandidates: string[]
  existingCandidates: string[]
  noLongerObserved: string[]
  rejectionCode?: string
}

export interface DiscoverySyncApiClient { submit(proposal: ProductDiscoveryProposal, dryRun: boolean): Promise<DiscoverySyncResponse> }

export function createDiscoverySyncApiClient(token: string, fetchImpl: typeof fetch = fetch, endpoint = DISCOVERY_SYNC_API_URL): DiscoverySyncApiClient {
  if (!token.trim()) throw new Error('Falta el ID token para Discovery Sync API.')
  return {
    async submit(proposal, dryRun) {
      const response = await fetchImpl(`${endpoint}${dryRun ? '?dryRun=true' : ''}`, {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(proposal),
      })
      const payload = await response.json().catch(() => null) as DiscoverySyncResponse | null
      if (!response.ok || !payload?.result) throw new Error(`Discovery Sync API falló con HTTP ${response.status}.`)
      return payload
    },
  }
}

export async function processDiscoveryProposal(client: DiscoverySyncApiClient, proposal: ProductDiscoveryProposal, applyChanges: boolean): Promise<{ dryRun: DiscoverySyncResponse; applied?: DiscoverySyncResponse }> {
  const dryRun = await client.submit(proposal, true)
  if (dryRun.result !== 'UPDATED' || !applyChanges) return { dryRun }
  const applied = await client.submit(proposal, false)
  if (applied.result !== 'UPDATED' && applied.result !== 'ALREADY_PROCESSED') throw new Error(`Discovery Sync API no aplicó la propuesta: ${applied.result}.`)
  return { dryRun, applied }
}
