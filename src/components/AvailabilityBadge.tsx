import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import type { PlanStatus } from '../models/plan'
import { statusLabels } from '../utils/format'

export function AvailabilityBadge({ status }: { status: PlanStatus }) {
  const Icon = status === 'AVAILABLE' ? CircleCheck : status === 'COMING_SOON' ? Clock3 : CircleX
  return <span className={`availability ${status.toLowerCase().replace('_', '-')}`}><Icon aria-hidden="true" />{statusLabels[status]}</span>
}
