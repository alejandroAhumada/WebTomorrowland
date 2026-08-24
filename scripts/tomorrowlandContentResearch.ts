import { createHash } from 'node:crypto'
import type { ContentSyncProposal, ContentSyncResponse } from '../functions/src/contentSync'
import { initialImportantInformation, initialTicketTiers } from '../src/data/officialContent'
import type { TicketTier } from '../src/models/ticketTier'
import type { FetchedOfficialPage } from './tomorrowlandResearch'
import { parseBrlAmount } from './tomorrowlandResearch'

export const CONTENT_SYNC_API_URL = 'https://synctomorrowlandcontent-roe56dc57a-uc.a.run.app'
export const CONTENT_RESEARCH_SOURCES = [
  { id:'festival-tickets', url:'https://brasil.tomorrowland.com/en/tickets/festival-tickets/' },
  { id:'easy-tent-2p', url:'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/' },
  { id:'spectacular-easy-tent-2p', url:'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/spectacular-easy-tent-package/' },
  { id:'vida-nova-2p', url:'https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/vida-nova-package/' },
  { id:'global-journey-hotels', url:'https://brasil.tomorrowland.com/en/tickets/global-journey/hotel-packages/' },
  { id:'how-to-order', url:'https://brasil.tomorrowland.com/en/sales/how-to-order-your-tickets/' },
] as const

const expectedPrices: Record<string, Record<string, number>> = {
  'festival-tickets': { regular:3160, comfort:5535, 'number-one':9715 },
  'easy-tent-2p': { regular:7609, comfort:12359, 'number-one':20719 },
  'spectacular-easy-tent-2p': { regular:8359, comfort:13109, 'number-one':21469 },
  'vida-nova-2p': { regular:7009, comfort:11759, 'number-one':20119 },
}
const planForSource: Record<string,string> = { 'festival-tickets':'full-madness-1p-2027', 'easy-tent-2p':'easy-tent-2p-2027', 'spectacular-easy-tent-2p':'spectacular-easy-tent-2p-2027', 'vida-nova-2p':'vida-nova-2p-2027' }
const tierMarkers:Record<string,Record<string,string>>={
  'festival-tickets':{regular:'Full Madness Pass',comfort:'Full Madness Comfort Pass','number-one':'Full Madness N°1 Pass'},
  'easy-tent-2p':{regular:'Easy Tent 2P',comfort:'Easy Tent 2P Comfort','number-one':'Easy Tent 2P N°1'},
  'spectacular-easy-tent-2p':{regular:'Spectacular Easy Tent 2P',comfort:'Spectacular Easy Tent 2P Comfort','number-one':'Spectacular Easy Tent 2P N°1'},
  'vida-nova-2p':{regular:'Vida Nova 2P',comfort:'Vida Nova 2P Comfort','number-one':'Vida Nova 2P N°1'},
}

export interface ContentResearchResult { hash:string; status:'PROPOSAL_CREATED'|'NO_SOURCE_CHANGE'|'PARSE_FAILED'; proposals:ContentSyncProposal[]; notes:string[]; error?:string }

export function researchOfficialContent(pages: Record<string, FetchedOfficialPage>, previousHash?: string): ContentResearchResult {
  try {
    for (const source of CONTENT_RESEARCH_SOURCES) if (!pages[source.id]) throw new Error(`Falta la fuente ${source.id}.`)
    const festivalText = pageText(pages['festival-tickets'].html)
    requireAll(festivalText, ['Comfort Areas','Welcome Drink','13:00','15:00','N°1','MainStage','São Paulo','Itu','Home Delivery','October 24','Treasure Case','Festival Box Office'])
    requireAll(pageText(pages['how-to-order'].html), ['Subject to availability','one Treasure Case','every two Bracelets','delivery fees'])
    const extracted: Record<string, Record<string,number>> = {}
    for (const [sourceId, tiers] of Object.entries(expectedPrices)) {
      const text = pageText(pages[sourceId].html); extracted[sourceId] = {}
      for (const [tierId, expected] of Object.entries(tiers)) {
        if (!containsTierPrice(text, tierMarkers[sourceId][tierId], expected)) throw new Error(`Precio ${tierId} no encontrado inequívocamente en ${sourceId}.`)
        extracted[sourceId][tierId] = expected
      }
    }
    const stableEvidence = { extractorVersion:2, extracted, comfort: evidenceWindow(festivalText,'Comfort Areas'), numberOne:evidenceWindow(festivalText,'N°1'), treasure:evidenceWindow(festivalText,'Home Delivery'), availability:evidenceWindow(pageText(pages['how-to-order'].html),'Subject to availability') }
    const hash = digest(stableEvidence)
    if (hash === previousHash) return { hash, status:'NO_SOURCE_CHANGE', proposals:[], notes:['La evidencia relevante no cambió.'] }
    const observedAt = `${Object.values(pages).map((page) => page.fetchedAt.slice(0,10)).sort().at(-1)}T00:00:00.000Z`
    const tiers = structuredClone(initialTicketTiers).map((tier) => updateTier(tier, extracted, observedAt))
    const information = structuredClone(initialImportantInformation).map((item) => ({ ...item, sourceObservedAt:observedAt, updatedAt:observedAt.slice(0,10) }))
    const proposals = [...tiers.map((document) => proposal('TICKET_TIER', document, observedAt, `${stableEvidence.comfort} ${stableEvidence.numberOne}`)), ...information.map((document) => proposal('IMPORTANT_INFORMATION', document, observedAt, document.id === 'treasure-case-availability-2027' ? stableEvidence.availability : stableEvidence.treasure))]
    return { hash, status:'PROPOSAL_CREATED', proposals, notes:['Comfort, N°1, precios por producto y condiciones Treasure Case verificados de forma determinista.'] }
  } catch (error) { return { hash:'', status:'PARSE_FAILED', proposals:[], notes:[], error: error instanceof Error ? error.message : 'Extracción fallida.' } }
}

function updateTier(tier: TicketTier, prices: Record<string,Record<string,number>>, observedAt:string): TicketTier {
  const tierId = tier.id
  for (const [sourceId, values] of Object.entries(prices)) { const planId = planForSource[sourceId]; const offering = tier.offerings.find((item) => item.planId === planId); if (offering) { offering.totalPrice = { amount:values[tierId], currency:'BRL' }; offering.priceType='OFFICIAL' } }
  tier.sourceObservedAt=observedAt; tier.updatedAt=observedAt.slice(0,10); return tier
}
function proposal(contentType:ContentSyncProposal['contentType'], document:ContentSyncProposal['document'], observedAt:string, excerpt:string):ContentSyncProposal {
  const sourceHash=digest(document); const identity=digest({contentType,id:document.id,sourceHash,observedAt}).slice(0,32)
  return { proposalId:`content-${identity}`, contentType, documentId:document.id, observedAt, source:{url:document.sourceUrl,type:'OFFICIAL',publisher:'Tomorrowland'}, document, evidence:{excerpt:`Tomorrowland Brasil 2027 · ${excerpt}`.slice(0,700),sourceHash,kind:'CONFIRMATION'} }
}
export interface ContentSyncApiClient { submit(proposal:ContentSyncProposal,dryRun:boolean):Promise<ContentSyncResponse> }
export function createContentSyncApiClient(token:string,fetchImpl:typeof fetch=fetch,endpoint=CONTENT_SYNC_API_URL):ContentSyncApiClient { if(!token.trim()) throw new Error('Falta el ID token para Content Sync API.'); return { async submit(proposal,dryRun){ const response=await fetchImpl(`${endpoint}${dryRun?'?dryRun=true':''}`,{method:'POST',signal:AbortSignal.timeout(20_000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(proposal)}); const payload=await response.json().catch(()=>null) as ContentSyncResponse|null; if(!response.ok||!payload?.result) throw new Error(`Content Sync API falló con HTTP ${response.status}.`); return payload } } }
export async function processContentProposal(client:ContentSyncApiClient,proposal:ContentSyncProposal,apply:boolean){ const dryRun=await client.submit(proposal,true); if(!apply||!['CREATED','UPDATED'].includes(dryRun.result)) return {dryRun}; const applied=await client.submit(proposal,false); if(!['CREATED','UPDATED','ALREADY_PROCESSED'].includes(applied.result)) throw new Error(`Content Sync API no aplicó: ${applied.result}.`); return {dryRun,applied} }
function pageText(html:string){ return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim() }
function requireAll(text:string,markers:string[]){ for(const marker of markers) if(!text.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Evidencia oficial ambigua o ausente: ${marker}.`) }
function containsTierPrice(text:string,marker:string,amount:number){ const lowered=text.toLowerCase(); let index=lowered.indexOf(marker.toLowerCase()); while(index>=0){ const window=text.slice(index,index+Math.max(220,marker.length+80)); for(const match of window.matchAll(/R\$\s*([0-9][0-9.,]*)/gi)) if(parseBrlAmount(match[1])===amount) return true; index=lowered.indexOf(marker.toLowerCase(),index+marker.length) } return false }
function evidenceWindow(text:string,term:string){ const index=text.toLowerCase().indexOf(term.toLowerCase()); return text.slice(Math.max(0,index-60),index+260).trim() }
function digest(value:unknown){ return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
