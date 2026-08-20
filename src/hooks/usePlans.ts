import { useEffect, useState } from 'react'
import { planRepository } from '../data'
import type { TravelPlan } from '../models/plan'

interface RequestState { key: string; plans: TravelPlan[]; error: string | null }
interface PlansState { plans: TravelPlan[]; loading: boolean; error: string | null }

export function usePlans(travelerCount?: 1 | 2, ids?: string[]): PlansState {
  const idsKey = ids?.join(',') ?? ''
  const hasIds = ids !== undefined
  const requestKey = hasIds ? `ids:${idsKey}` : `travelers:${travelerCount ?? 'all'}`
  const [state, setState] = useState<RequestState>({ key: '', plans: [], error: null })

  useEffect(() => {
    let active = true
    const requestedIds = idsKey ? idsKey.split(',') : []
    const request = hasIds ? planRepository.getByIds(requestedIds) : travelerCount ? planRepository.getByTravelerCount(travelerCount) : planRepository.getAll()
    request.then((plans) => { if (active) setState({ key: requestKey, plans, error: null }) })
      .catch(() => { if (active) setState({ key: requestKey, plans: [], error: 'No pudimos cargar las alternativas. Intenta nuevamente.' }) })
    return () => { active = false }
  }, [travelerCount, idsKey, requestKey, hasIds])

  return state.key === requestKey ? { ...state, loading: false } : { plans: [], loading: true, error: null }
}
