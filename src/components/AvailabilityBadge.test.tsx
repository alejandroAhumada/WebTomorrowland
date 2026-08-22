import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AvailabilityBadge } from './AvailabilityBadge'

describe('AvailabilityBadge', () => {
  it.each([
    ['AVAILABLE', 'Disponible'],
    ['COMING_SOON', 'Próximamente'],
    ['UNAVAILABLE', 'No disponible'],
  ] as const)('presenta %s sin depender solamente del color', (status, label) => {
    const markup = renderToStaticMarkup(<AvailabilityBadge status={status} />)
    expect(markup).toContain(label)
    expect(markup).toContain('aria-hidden="true"')
  })
})
