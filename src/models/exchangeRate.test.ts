import { describe, expect, it } from 'vitest'
import { convertMoney, type ExchangeRate } from './exchangeRate'

const brlClp: ExchangeRate = {
  id: 'BRL_CLP', fromCurrency: 'BRL', toCurrency: 'CLP', rate: 178.01,
  sourceUrl: 'https://si3.bcentral.cl/', sourceName: 'Banco Central de Chile', sourceSeries: 'F072.CLP.BRL.N.O.D',
  observedAt: '2026-08-20', fetchedAt: '2026-08-20T15:17:34-04:00', updatedAt: '2026-08-20T15:17:34-04:00',
}

describe('conversión monetaria', () => {
  it('convierte BRL a CLP y redondea al peso completo', () => {
    expect(convertMoney({ amount: 7609, currency: 'BRL' }, 'CLP', brlClp)).toEqual({ amount: 1354478, currency: 'CLP' })
  })

  it('devuelve null cuando la tasa no existe o no corresponde', () => {
    expect(convertMoney({ amount: 7609, currency: 'BRL' }, 'CLP', null)).toBeNull()
    expect(convertMoney({ amount: 10, currency: 'USD' }, 'CLP', brlClp)).toBeNull()
  })

  it('no convierte un precio pendiente', () => {
    expect(convertMoney(null, 'CLP', brlClp)).toBeNull()
  })

  it('preserva el precio original', () => {
    const original = { amount: 3160, currency: 'BRL' as const }
    convertMoney(original, 'CLP', brlClp)
    expect(original).toEqual({ amount: 3160, currency: 'BRL' })
  })

  it('usa directamente la serie CLP por BRL del Banco Central de Chile', () => {
    expect(brlClp).toMatchObject({ rate: 178.01, sourceName: 'Banco Central de Chile', sourceSeries: 'F072.CLP.BRL.N.O.D' })
    expect(brlClp.sourceName).not.toContain('PTAX')
  })
})
