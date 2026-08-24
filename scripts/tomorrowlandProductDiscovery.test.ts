import { describe, expect, it } from 'vitest'
import {
  buildProductDiscoveryProposal, canonicalOfficialProductUrl, discoverOfficialProducts,
  PRODUCT_DISCOVERY_SOURCES, sanitizeEvidenceText,
} from './tomorrowlandProductDiscovery'

const source = PRODUCT_DISCOVERY_SOURCES[1]
const fetchedAt = '2026-08-24T12:00:00.000Z'
function card(href: string, title: string, description = 'Official package description'): string {
  return `<a class="x_cardLink_test" href="${href}"><div><h3>${title}</h3><p>${description}</p></div></a>`
}
function page(html: string) { return { url: source.url, html: `<!doctype html><html><body>${html}</body></html>`, fetchedAt } }

describe('Tomorrowland product discovery', () => {
  it('normaliza tracking, fragmentos y slash final sin perder la allowlist oficial', () => {
    expect(canonicalOfficialProductUrl('/en/tickets/new-package/?utm_source=x#details', source.url))
      .toBe('https://brasil.tomorrowland.com/en/tickets/new-package')
    expect(() => canonicalOfficialProductUrl('https://tomorrowland.com.evil.test/product')).toThrow('allowlist')
  })

  it('no crea candidatos para productos conocidos ni nodos de catálogo', () => {
    const result = discoverOfficialProducts(source, page([
      card('/en/tickets/global-journey/hotel-packages', 'Hotel Packages'),
      card('/en/tickets/global-journey/ticket-travel-program', 'Ticket & Travel Program'),
    ].join('')))
    expect(result.status).toBe('SUCCESS')
    expect(result.knownProducts).toHaveLength(1)
    expect(result.knownProducts[0].matchedKnownPlanId).toBe('global-journey-hotel-1p-2027')
    expect(result.candidates).toEqual([])
  })

  it('detecta un link estructural nuevo sin inferir categoría, precio ni planId', () => {
    const result = discoverOfficialProducts(source, page(card('/en/tickets/global-journey/future-dreamville-package', 'Future DreamVille Package', 'A new official card.')))
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({
      observedTitle: 'Future DreamVille Package', detectionReason: 'OFFICIAL_CATALOG_PRODUCT_LINK',
      officialUrl: 'https://brasil.tomorrowland.com/en/tickets/global-journey/future-dreamville-package',
    })
    expect(result.candidates[0]).not.toHaveProperty('matchedKnownPlanId')
    expect(JSON.stringify(result.candidates[0])).not.toMatch(/category|price|traveler|accommodation/i)
  })

  it('detecta una card explícita todavía sin link usando identidad de fuente y título', () => {
    const result = discoverOfficialProducts(source, page('<a class="x_cardLink_test"><h3>Mística Packages</h3><p>More info soon.</p></a><a class="x_cardLink_test"><h3>Second Future Package</h3><p>More info soon.</p></a>'))
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates).toContainEqual(expect.objectContaining({ observedTitle: 'Mística Packages', officialUrl: 'https://brasil.tomorrowland.com/en/tickets/global-journey', detectionReason: 'OFFICIAL_CATALOG_PRODUCT_CARD' }))
  })

  it('mantiene identidad ante tracking y cambios de descripción, pero actualiza evidencia', () => {
    const first = discoverOfficialProducts(source, page(card('/en/tickets/global-journey/future-package?utm_source=a', 'Future Package', 'First description.'))).candidates[0]
    const second = discoverOfficialProducts(source, page(card('/en/tickets/global-journey/future-package?utm_source=b', 'Future Package', 'Changed description.'))).candidates[0]
    expect(second.candidateId).toBe(first.candidateId)
    expect(second.evidenceHash).not.toBe(first.evidenceHash)
  })

  it('ignora palabras nuevas en texto descriptivo y links fuera del perímetro estructural', () => {
    const result = discoverOfficialProducts(source, page(`${card('/en/practical/new-package', 'Future Package')}<p>Surprise Ultra Package</p>`))
    expect(result.status).toBe('PARSE_FAILED')
    expect(result.candidates).toEqual([])
  })

  it('falla cerrado si no comprende cards y no genera propuesta', () => {
    const result = discoverOfficialProducts(source, page('<h2>Layout completamente nuevo</h2>'))
    expect(result.status).toBe('PARSE_FAILED')
    expect(() => buildProductDiscoveryProposal(result)).toThrow('parseada correctamente')
  })

  it('sanitiza HTML, scripts y limita evidencia', () => {
    expect(sanitizeEvidenceText('<script>alert(1)</script><b>Future</b> Package', 30)).toBe('Future Package')
  })

  it('genera proposalId determinístico para la misma observación', () => {
    const result = discoverOfficialProducts(source, page(card('/en/tickets/global-journey/future-package', 'Future Package')))
    expect(buildProductDiscoveryProposal(result)).toEqual(buildProductDiscoveryProposal(result))
  })
})
