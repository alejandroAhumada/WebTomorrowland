import { BadgeCheck, Calculator, Clock3 } from 'lucide-react'
import type { PriceType } from '../models/plan'

const priceTypeLabels = {
  OFFICIAL: 'Precio oficial',
  ESTIMATED: 'Precio estimado',
  PENDING: 'Precio aún no publicado',
} as const

export function PriceBadge({ type }: { type: PriceType | null }) {
  const resolvedType = type ?? 'PENDING'
  const Icon = resolvedType === 'OFFICIAL' ? BadgeCheck : resolvedType === 'ESTIMATED' ? Calculator : Clock3
  return <span className={`price-badge ${resolvedType.toLowerCase()}`}><Icon aria-hidden="true" />{priceTypeLabels[resolvedType]}</span>
}
