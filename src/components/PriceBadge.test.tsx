import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PriceBadge } from './PriceBadge'

describe('PriceBadge', () => {
  it.each([
    ['OFFICIAL', 'Precio oficial'],
    ['ESTIMATED', 'Precio estimado'],
    [null, 'Precio aún no publicado'],
  ] as const)('presenta %s en español con texto accesible', (type, label) => {
    const markup = renderToStaticMarkup(<PriceBadge type={type} />)
    expect(markup).toContain(label)
    expect(markup).toContain('aria-hidden="true"')
  })
})
