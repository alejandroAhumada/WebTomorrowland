import type { ImportantEvent } from '../models/importantEvent'
import type { TravelPlan } from '../models/plan'
import { getImportantEventState, sortImportantEvents, type ImportantEventState } from './importantEventTime'

export interface TripTimelineEntry {
  event: ImportantEvent
  state: ImportantEventState
  isPrimary: boolean
}

export interface TripTimeline {
  entries: TripTimelineEntry[]
  primaryMilestone: ImportantEvent | null
}

export function isEventRelevantForPlan(event: ImportantEvent, plan: TravelPlan): boolean {
  if (event.appliesTo.scope === 'ALL') return true
  if (event.appliesTo.scope === 'PLAN_CATEGORIES') return event.appliesTo.planCategories.includes(plan.category)
  if (event.appliesTo.scope === 'PLAN_IDS') return event.appliesTo.planIds.includes(plan.id)
  return false
}

export function buildTripTimeline(plan: TravelPlan, events: readonly ImportantEvent[], now = new Date()): TripTimeline {
  const relevant = sortImportantEvents(events.filter((event) => isEventRelevantForPlan(event, plan)))
  const active = relevant
    .filter((event) => getImportantEventState(event, now) === 'TODAY')
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id, 'es'))
  const upcoming = relevant.filter((event) => getImportantEventState(event, now) === 'UPCOMING')
  const primaryMilestone = active[0] ?? upcoming[0] ?? null

  return {
    entries: relevant.map((event) => ({
      event,
      state: getImportantEventState(event, now),
      isPrimary: event.id === primaryMilestone?.id,
    })),
    primaryMilestone,
  }
}
