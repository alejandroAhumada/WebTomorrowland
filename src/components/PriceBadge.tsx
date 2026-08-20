import type { PriceType } from '../models/plan'
export function PriceBadge({ type }: { type: PriceType | null }) { return <span className={`price-badge ${type?.toLowerCase() ?? 'pending'}`}>{type ?? 'PENDING'}</span> }
