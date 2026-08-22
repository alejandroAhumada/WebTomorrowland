import { describe, expect, it } from 'vitest'
import { MAX_COMPARISON_PLANS, normalizeSelection, toggleSelection } from './selection'
describe('selección para comparar', () => {
  it('agrega y quita una alternativa', () => { expect(toggleSelection([], 'a')).toEqual(['a']); expect(toggleSelection(['a'], 'a')).toEqual([]) })
  it('limita la comparación a tres alternativas', () => { const full = ['a', 'b', 'c']; expect(full).toHaveLength(MAX_COMPARISON_PLANS); expect(toggleSelection(full, 'd')).toEqual(full) })
  it('reemplaza selección sin duplicados y respetando el máximo', () => { expect(normalizeSelection(['a', 'b', 'a', 'c', 'd'])).toEqual(['a', 'b', 'c']) })
})
