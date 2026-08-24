import { describe, expect, it } from 'vitest'
import { initialImportantInformation, initialTicketTiers } from '../data/officialContent'
import { getTierOffering, validateTicketTier } from './ticketTier'
import { validateImportantInformation } from './importantInformation'

describe('ticket tiers oficiales', () => {
  it('valida múltiples tiers, beneficios y precios oficiales por producto', () => { expect(initialTicketTiers.map(validateTicketTier)).toEqual([[],[],[]]); expect(getTierOffering(initialTicketTiers[1], 'easy-tent-2p-2027')?.totalPrice?.amount).toBe(12359) })
  it('mantiene pendientes las configuraciones sin precio publicado', () => { expect(getTierOffering(initialTicketTiers[2], 'global-journey-hotel-2p-2027')).toMatchObject({ totalPrice:null, priceType:null }) })
  it('rechaza fuentes falsas y precios no oficiales', () => { const tier=structuredClone(initialTicketTiers[0]); tier.sourceUrl='https://tomorrowland.com.evil.example/'; tier.offerings[0].priceType='ESTIMATED'; expect(validateTicketTier(tier).length).toBeGreaterThan(0) })
  it('no crea una oferta para un tier inexistente', () => expect(getTierOffering(initialTicketTiers[0], 'unknown-plan')).toBeNull())
})
describe('información importante', () => {
  it('valida Treasure Case, Home Delivery y retiro', () => { expect(initialImportantInformation.map(validateImportantInformation)).toEqual([[],[],[],[],[]]); expect(initialImportantInformation[0]).toMatchObject({ effectiveUntil:'2026-10-24', relatedEventId:'treasure-case-home-delivery-deadline-2027' }); expect(initialImportantInformation[2].details.join(' ')).toContain('no incluye Treasure Case'); expect(initialImportantInformation[1].sourceUrl).toContain('/sales/how-to-order-your-tickets/') })
  it('requiere fuente oficial y aplicabilidad', () => { const item=structuredClone(initialImportantInformation[0]); item.sourceUrl='https://tomorrowland.com.evil.example/'; expect(validateImportantInformation(item)).toContain('La información requiere una fuente oficial.') })
})
