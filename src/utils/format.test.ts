import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney } from './format'
describe('formatMoney', () => { it('muestra valor y moneda CLP sin decimales', () => { const output = formatMoney({ amount: 2450000, currency: 'CLP' }); expect(output).toContain('2.450.000'); expect(output).toContain('$') }) })
describe('formato BRL', () => { it('usa el símbolo R$ en las superficies visibles', () => { expect(formatMoney({ amount: 7609, currency: 'BRL' })).toBe('R$ 7.609') }) })
describe('formatDate', () => { it('preserva la fecha diaria sin desplazarla por zona horaria', () => { expect(formatDate('2026-08-20')).toBe('20-08-2026') }) })
