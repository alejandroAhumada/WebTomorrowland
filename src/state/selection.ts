export const MAX_COMPARISON_PLANS = 3

export function toggleSelection(selectedIds: string[], id: string): string[] {
  if (selectedIds.includes(id)) return selectedIds.filter((selectedId) => selectedId !== id)
  if (selectedIds.length >= MAX_COMPARISON_PLANS) return selectedIds
  return [...selectedIds, id]
}
