import type { TravelPlan } from '../models/plan'

export function sortPlansByPrice(plans: readonly TravelPlan[]): TravelPlan[] {
  return [...plans].sort((left, right) => {
    const leftHasPrice = left.totalPrice !== null
    const rightHasPrice = right.totalPrice !== null

    if (leftHasPrice !== rightHasPrice) return leftHasPrice ? -1 : 1

    if (left.totalPrice && right.totalPrice) {
      const priceDifference = left.totalPrice.amount - right.totalPrice.amount
      if (priceDifference !== 0) return priceDifference
      return compareNames(left, right)
    }

    const travelerDifference = left.travelerCount - right.travelerCount
    return travelerDifference || compareNames(left, right)
  })
}

function compareNames(left: TravelPlan, right: TravelPlan): number {
  return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }) || left.id.localeCompare(right.id)
}
