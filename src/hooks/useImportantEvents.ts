import { useEffect, useState } from 'react'
import { importantEventRepository } from '../data'
import type { ImportantEvent } from '../models/importantEvent'
import { sortImportantEvents } from '../utils/importantEventTime'

interface ImportantEventsState { events: ImportantEvent[]; loading: boolean; error: string | null }

export function useImportantEvents(): ImportantEventsState {
  const [state, setState] = useState<ImportantEventsState>({ events: [], loading: true, error: null })

  useEffect(() => {
    let active = true
    importantEventRepository.getAll()
      .then((events) => { if (active) setState({ events: sortImportantEvents(events), loading: false, error: null }) })
      .catch(() => { if (active) setState({ events: [], loading: false, error: 'Las fechas clave no están disponibles en este momento.' }) })
    return () => { active = false }
  }, [])

  return state
}
