import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { PlanSyncResponse } from '../functions/src/planSync'
import {
  RESEARCH_SOURCES, createSyncApiClient, processProposal, researchSource, safeFetchOfficialPage,
  sanitizeResearchError, type ResearchState, type SourceResearchResult,
} from './tomorrowlandResearch'

const startedAt = new Date().toISOString()
const statePath = process.env.TOMORROWLAND_RESEARCH_STATE_PATH ?? '.cache/tomorrowland-research-state.json'
const applyChanges = process.env.RESEARCH_APPLY_CHANGES === 'true'
const token = process.env.SYNC_API_ID_TOKEN?.trim()

try {
  if (!token) throw new Error('Falta SYNC_API_ID_TOKEN.')
  const state = await readState(statePath)
  const nextState: ResearchState = structuredClone(state)
  const client = createSyncApiClient(token)
  const results: SourceResearchResult[] = []
  let proposalsAccepted = 0
  let proposalsRejected = 0

  for (const source of RESEARCH_SOURCES) {
    let result: SourceResearchResult
    try {
      const page = await safeFetchOfficialPage(source.url)
      result = researchSource(source, page, state.sources[source.id]?.hash)
      if (result.hash) nextState.sources[source.id] = { ...state.sources[source.id], hash: result.hash, observedAt: page.fetchedAt }
    } catch (error) {
      result = {
        sourceId: source.id, sourceUrl: source.url, hash: '', status: 'FETCH_FAILED', evidence: [], proposals: [], notes: [],
        error: sanitizeResearchError(error),
      }
    }
    results.push(result)
    console.log(`Research source=${result.sourceId} status=${result.status} plans=${source.planIds.join(',') || 'informational'} hash=${result.hash.slice(0, 12) || 'none'}`)
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
        console.error(`Research proposal plan=${proposal.planId} failed=${sanitizeResearchError(error)}`)
        result.status = 'PARSE_FAILED'
        result.error = sanitizeResearchError(error)
      }
    }
    if (result.hash) nextState.sources[source.id].lastProposalResults = shouldProcess ? currentResults : previousResults
  }

  await writeState(statePath, nextState)
  const failed = results.filter((result) => result.status === 'FETCH_FAILED' || result.status === 'PARSE_FAILED')
  console.log(JSON.stringify({
    jobType: 'TOMORROWLAND_OFFICIAL_RESEARCH', startedAt, completedAt: new Date().toISOString(), applyChanges,
    sourcesChecked: results.length, sourcesChanged: results.filter((item) => item.status !== 'NO_SOURCE_CHANGE').length,
    proposalsGenerated: results.reduce((total, item) => total + item.proposals.length, 0), proposalsAccepted, proposalsRejected,
    result: failed.length ? 'FAILED' : 'SUCCESS',
  }))
  if (failed.length) process.exitCode = 1
} catch (error) {
  console.error(`Tomorrowland research: FAILED · ${sanitizeResearchError(error)}`)
  process.exitCode = 1
}

async function readState(path: string): Promise<ResearchState> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as ResearchState
    return parsed && typeof parsed.sources === 'object' ? parsed : { sources: {} }
  } catch { return { sources: {} } }
}

async function writeState(path: string, state: ResearchState): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
}
