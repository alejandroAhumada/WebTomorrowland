import { useEffect, useState } from 'react'
import { importantInformationRepository } from '../data'
import type { ImportantInformation } from '../models/importantInformation'

export function useImportantInformation() {
  const [items, setItems] = useState<ImportantInformation[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    importantInformationRepository.getAll().then((value) => { if (active) setItems(value) }).catch(() => { if (active) setItems([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return { items, loading }
}
