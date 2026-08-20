import type { PriceType } from '../models/plan'
export function PriceBadge({ type }: { type: PriceType }) { return <span className={`price-badge ${type.toLowerCase()}`}>{type}</span> }
