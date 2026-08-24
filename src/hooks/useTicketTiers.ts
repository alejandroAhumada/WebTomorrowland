import { useEffect, useState } from 'react'
import { ticketTierRepository } from '../data'
import type { TicketTier } from '../models/ticketTier'

let cached: TicketTier[] | null = null
let pending: Promise<TicketTier[]> | null = null

export function useTicketTiers() {
  const [tiers, setTiers] = useState<TicketTier[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  useEffect(() => {
    let active = true
    pending ??= ticketTierRepository.getAll().then((value) => (cached = value)).finally(() => { pending = null })
    pending.then((value) => { if (active) setTiers(value) }).catch(() => { if (active) setTiers([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return { tiers, loading }
}
