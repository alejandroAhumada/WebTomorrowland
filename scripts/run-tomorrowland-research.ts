import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { PlanSyncResponse } from '../functions/src/planSync'
import {
  EVENT_RESEARCH_SOURCES, createEventSyncApiClient, processEventProposal, researchEventSource,
  type EventSourceResearchResult,
} from './tomorrowlandEventResearch'
import {
  RESEARCH_SOURCES, createSyncApiClient, processProposal, researchSource, safeFetchOfficialPage,
  sanitizeResearchError, type ResearchState, type SourceResearchResult,
} from './tomorrowlandResearch'
import { CONTENT_RESEARCH_SOURCES, createContentSyncApiClient, processContentProposal, researchOfficialContent } from './tomorrowlandContentResearch'

type ResearchScope = 'all' | 'plans' | 'events' | 'information'
const startedAt = new Date().toISOString()
const statePath = process.env.TOMORROWLAND_RESEARCH_STATE_PATH ?? '.cache/tomorrowland-research-state.json'
const applyChanges = process.env.RESEARCH_APPLY_CHANGES === 'true'
const scope = parseScope(process.env.RESEARCH_SCOPE ?? 'all')

try {
  const state = await readState(statePath)
  const nextState: ResearchState = structuredClone(state)
  nextState.eventSources ??= {}
  nextState.contentSources ??= {}
  let proposalsAccepted = 0
  let proposalsRejected = 0
  let proposalsGenerated = 0
  let sourcesChecked = 0
  let sourcesChanged = 0
  let failures = 0

  if (scope === 'all' || scope === 'plans') {
    const token = process.env.PLAN_SYNC_API_ID_TOKEN?.trim() ?? process.env.SYNC_API_ID_TOKEN?.trim()
    if (!token) throw new Error('Falta PLAN_SYNC_API_ID_TOKEN.')
    const client = createSyncApiClient(token)
    for (const source of RESEARCH_SOURCES) {
      let result: SourceResearchResult
      try {
        const page = await safeFetchOfficialPage(source.url)
        result = researchSource(source, page, state.sources[source.id]?.hash)
        if (result.hash) nextState.sources[source.id] = { ...state.sources[source.id], hash: result.hash, observedAt: page.fetchedAt }
      } catch (error) {
        result = { sourceId: source.id, sourceUrl: source.url, hash: '', status: 'FETCH_FAILED', evidence: [], proposals: [], notes: [], error: sanitizeResearchError(error) }
      }
      sourcesChecked += 1
      if (result.status !== 'NO_SOURCE_CHANGE') sourcesChanged += 1
      proposalsGenerated += result.proposals.length
      console.log(`Research source=${result.sourceId} scope=plans status=${result.status} plans=${source.planIds.join(',') || 'informational'} hash=${result.hash.slice(0, 12) || 'none'}`)
      for (const item of result.evidence) console.log(`Research evidence plan=${item.planId} field=${item.field} value=${item.extractedValue.amount} ${item.extractedValue.currency} source=${item.sourceUrl}`)
      for (const note of result.notes) console.log(`Research note source=${result.sourceId}: ${note}`)
      if (result.error) console.error(`Research error source=${result.sourceId}: ${result.error}`)
      const previousResults = state.sources[source.id]?.lastProposalResults ?? []
      const shouldProcess = result.status !== 'NO_SOURCE_CHANGE' || previousResults.includes('UPDATED')
      const currentResults: PlanSyncResponse['result'][] = []
      for (const proposal of shouldProcess ? result.proposals : []) {
        try {
          const outcome = await processProposal(client, proposal, applyChanges)
          console.log(`Research proposal plan=${proposal.planId} id=${proposal.proposalId} dryRun=${outcome.dryRun.result}`)
          if (outcome.dryRun.result === 'REJECTED') proposalsRejected += 1
          else proposalsAccepted += 1
          if (outcome.applied) console.log(`Research apply plan=${proposal.planId} result=${outcome.applied.result}`)
          currentResults.push(outcome.applied?.result === 'UPDATED' ? 'NO_CHANGE' : outcome.dryRun.result)
        } catch (error) {
          proposalsRejected += 1
          failures += 1
          console.error(`Research proposal plan=${proposal.planId} failed=${sanitizeResearchError(error)}`)
        }
      }
      if (result.hash) nextState.sources[source.id].lastProposalResults = shouldProcess ? currentResults : previousResults
      if (result.status === 'FETCH_FAILED' || result.status === 'PARSE_FAILED') failures += 1
    }
  }

  if (scope === 'all' || scope === 'events') {
    const token = process.env.EVENT_SYNC_API_ID_TOKEN?.trim()
    if (!token) throw new Error('Falta EVENT_SYNC_API_ID_TOKEN.')
    const client = createEventSyncApiClient(token)
    for (const source of EVENT_RESEARCH_SOURCES) {
      let result: EventSourceResearchResult
      try {
        const page = await safeFetchOfficialPage(source.url)
        result = researchEventSource(source, page, state.eventSources?.[source.id]?.hash)
        if (result.hash) nextState.eventSources![source.id] = { ...state.eventSources?.[source.id], hash: result.hash, observedAt: page.fetchedAt }
      } catch (error) {
        result = { sourceId: source.id, sourceUrl: source.url, hash: '', status: 'FETCH_FAILED', detected: [], proposals: [], notes: [], error: sanitizeResearchError(error) }
      }
      sourcesChecked += 1
      if (result.status !== 'NO_SOURCE_CHANGE') sourcesChanged += 1
      proposalsGenerated += result.proposals.length
      console.log(`Research source=${result.sourceId} scope=events status=${result.status} events=${result.detected.map((event) => event.eventId).join(',') || 'none'} hash=${result.hash.slice(0, 12) || 'none'}`)
      for (const event of result.detected) console.log(`Research evidence event=${event.eventId} startsAt=${event.startsAt} source=${event.sourceUrl}`)
      for (const note of result.notes) console.log(`Research note source=${result.sourceId}: ${note}`)
      if (result.error) console.error(`Research error source=${result.sourceId}: ${result.error}`)
      const previousResults = state.eventSources?.[source.id]?.lastProposalResults ?? []
      const shouldProcess = result.status !== 'NO_SOURCE_CHANGE' || previousResults.some((value) => value === 'CREATED' || value === 'UPDATED')
      const currentResults: string[] = []
      for (const proposal of shouldProcess ? result.proposals : []) {
        try {
          const outcome = await processEventProposal(client, proposal, applyChanges)
          console.log(`Research proposal event=${proposal.eventId} operation=${proposal.operation} id=${proposal.proposalId} dryRun=${outcome.dryRun.result}`)
          if (outcome.dryRun.result === 'REJECTED') proposalsRejected += 1
          else proposalsAccepted += 1
          if (outcome.applied) console.log(`Research apply event=${proposal.eventId} result=${outcome.applied.result}`)
          currentResults.push(outcome.applied && ['CREATED', 'UPDATED'].includes(outcome.applied.result) ? 'NO_CHANGE' : outcome.dryRun.result)
        } catch (error) {
          proposalsRejected += 1
          failures += 1
          console.error(`Research proposal event=${proposal.eventId} failed=${sanitizeResearchError(error)}`)
        }
      }
      if (result.hash) nextState.eventSources![source.id].lastProposalResults = shouldProcess ? currentResults : previousResults
      if (result.status === 'FETCH_FAILED' || result.status === 'PARSE_FAILED') failures += 1
    }
  }

  if (scope === 'all' || scope === 'information') {
    const token = process.env.CONTENT_SYNC_API_ID_TOKEN?.trim()
    if (!token) throw new Error('Falta CONTENT_SYNC_API_ID_TOKEN.')
    const pages: Record<string, Awaited<ReturnType<typeof safeFetchOfficialPage>>> = {}
    try {
      for (const source of CONTENT_RESEARCH_SOURCES) { pages[source.id] = await safeFetchOfficialPage(source.url); sourcesChecked += 1 }
      const previous = state.contentSources?.officialContent
      const result = researchOfficialContent(pages, previous?.hash)
      if (result.status !== 'NO_SOURCE_CHANGE') sourcesChanged += 1
      proposalsGenerated += result.proposals.length
      console.log(`Research source=official-content scope=information status=${result.status} proposals=${result.proposals.length} hash=${result.hash.slice(0,12) || 'none'}`)
      for (const note of result.notes) console.log(`Research note source=official-content: ${note}`)
      if (result.error) { console.error(`Research error source=official-content: ${sanitizeResearchError(result.error)}`); failures += 1 }
      const client = createContentSyncApiClient(token); const currentResults:string[]=[]
      for (const proposal of result.proposals) {
        try { const outcome=await processContentProposal(client,proposal,applyChanges); console.log(`Research proposal content=${proposal.contentType} document=${proposal.documentId} id=${proposal.proposalId} dryRun=${outcome.dryRun.result}`); if(outcome.dryRun.result==='REJECTED') proposalsRejected += 1; else proposalsAccepted += 1; if(outcome.applied) console.log(`Research apply content=${proposal.documentId} result=${outcome.applied.result}`); currentResults.push(outcome.applied?.result ?? outcome.dryRun.result) }
        catch(error){ proposalsRejected += 1; failures += 1; console.error(`Research proposal content=${proposal.documentId} failed=${sanitizeResearchError(error)}`) }
      }
      if(result.hash) nextState.contentSources!.officialContent={hash:result.hash,observedAt:new Date().toISOString(),lastProposalResults:currentResults}
    } catch(error) { failures += 1; console.error(`Research source=official-content scope=information status=FETCH_FAILED error=${sanitizeResearchError(error)}`) }
  }

  await writeState(statePath, nextState)
  console.log(JSON.stringify({ jobType: 'TOMORROWLAND_OFFICIAL_RESEARCH', startedAt, completedAt: new Date().toISOString(), scope, applyChanges, sourcesChecked, sourcesChanged, proposalsGenerated, proposalsAccepted, proposalsRejected, result: failures ? 'FAILED' : 'SUCCESS' }))
  if (failures) process.exitCode = 1
} catch (error) {
  console.error(`Tomorrowland research: FAILED · ${sanitizeResearchError(error)}`)
  process.exitCode = 1
}

function parseScope(value: string): ResearchScope {
  if (value === 'all' || value === 'plans' || value === 'events' || value === 'information') return value
  throw new Error('RESEARCH_SCOPE debe ser all, plans, events o information.')
}

async function readState(path: string): Promise<ResearchState> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as ResearchState
    return parsed && typeof parsed.sources === 'object' ? parsed : { sources: {}, eventSources: {}, contentSources: {} }
  } catch { return { sources: {}, eventSources: {}, contentSources: {} } }
}

async function writeState(path: string, state: ResearchState): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
}
