import { useMemo, useState, type ReactNode } from 'react'
import { MAX_COMPARISON_PLANS, toggleSelection } from './selection'
import { SelectionContext, type SelectionValue } from './useSelection'

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const value = useMemo<SelectionValue>(() => ({
    selectedIds,
    toggle: (id) => setSelectedIds((current) => toggleSelection(current, id)),
    clear: () => setSelectedIds([]),
    isSelected: (id) => selectedIds.includes(id),
    isFull: selectedIds.length >= MAX_COMPARISON_PLANS,
  }), [selectedIds])
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}
