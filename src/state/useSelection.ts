import { createContext, useContext } from 'react'

export interface SelectionValue {
  selectedIds: string[]
  toggle: (id: string) => void
  clear: () => void
  replace: (ids: string[]) => void
  isSelected: (id: string) => boolean
  isFull: boolean
}

export const SelectionContext = createContext<SelectionValue | null>(null)

export function useSelection(): SelectionValue {
  const value = useContext(SelectionContext)
  if (!value) throw new Error('useSelection debe usarse dentro de SelectionProvider')
  return value
}
