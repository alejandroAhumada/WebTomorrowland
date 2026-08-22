import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ImportantEventsView } from './ImportantEventsSection'

describe('ImportantEventsView', () => {
  it('un error de Firestore no rompe la Home ni inventa acontecimientos', () => {
    const markup = renderToStaticMarkup(<ImportantEventsView events={[]} loading={false} error="Las fechas clave no están disponibles en este momento." now={new Date('2026-08-22T12:00:00Z')} />)
    expect(markup).toContain('Las fechas clave no están disponibles')
    expect(markup).not.toContain('Simulador Global Journey')
  })

  it('oculta la sección cuando la colección está vacía', () => {
    expect(renderToStaticMarkup(<ImportantEventsView events={[]} loading={false} error={null} now={new Date()} />)).toBe('')
  })
})
