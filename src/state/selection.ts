export const MAX_COMPARISON_PLANS = 3

export function normalizeSelection(ids: readonly string[]): string[] {
  return [...new Set(ids)].slice(0, MAX_COMPARISON_PLANS)
}

export function toggleSelection(selectedIds: string[], id: string): string[] {
  if (selectedIds.includes(id)) return selectedIds.filter((selectedId) => selectedId !== id)
  if (selectedIds.length >= MAX_COMPARISON_PLANS) return selectedIds
  return [...selectedIds, id]
}
