import { describe, expect, it } from 'vitest'
import { formatMoney } from './format'
describe('formatMoney', () => { it('muestra valor y moneda CLP sin decimales', () => { const output = formatMoney({ amount: 2450000, currency: 'CLP' }); expect(output).toContain('2.450.000'); expect(output).toContain('$') }) })
