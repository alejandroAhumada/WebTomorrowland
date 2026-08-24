import { describe, expect, it } from 'vitest'
import { experienceContents } from '../data/experienceContents'
import { filterExperienceContents, getAvailableExperienceCategories, sortExperienceContents, validateExperienceContent, type ExperienceContent } from './experienceContent'

const valid: ExperienceContent = {
  id: 'festival-2025', title: 'Festival 2025', summary: 'Registro verificable de una edición anterior.', year: 2025,
  sourceType: 'PERSONAL_EXPERIENCE', sourceName: 'Canal original', sourceUrl: 'https://www.youtube.com/watch?v=abc', sourcePublisherUrl: 'https://www.youtube.com/@canal',
  mediaType: 'VIDEO', categories: ['FESTIVAL'], thumbnailUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg', featured: false, priority: 50, observedAt: '2026-08-24',
}

describe('ExperienceContent', () => {
  it('acepta contenido personal válido y atribuido', () => { expect(validateExperienceContent(valid)).toEqual([]) })
  it('acepta contenido oficial atribuido a Tomorrowland', () => { expect(validateExperienceContent({ ...valid, sourceType: 'OFFICIAL_CONTENT', sourceName: 'Tomorrowland' })).toEqual([]) })
  it('rechaza oficialidad aplicada a una fuente de terceros', () => { expect(validateExperienceContent({ ...valid, sourceType: 'OFFICIAL_CONTENT' })).toContain('El contenido oficial debe atribuirse a Tomorrowland.') })
  it('rechaza años que no corresponden a ediciones anteriores', () => { expect(validateExperienceContent({ ...valid, year: 2027 })).toContain('El año debe corresponder a una edición anterior.') })
  it('rechaza URLs no HTTPS y subdominios falsos', () => {
    expect(validateExperienceContent({ ...valid, sourceUrl: 'http://youtube.com/watch?v=abc' })).toContain('La URL de origen no es válida.')
    expect(validateExperienceContent({ ...valid, sourceUrl: 'https://youtube.com.example.test/watch?v=abc' })).toContain('La URL de origen no es válida.')
  })
  it('rechaza miniaturas de hosts no autorizados', () => { expect(validateExperienceContent({ ...valid, thumbnailUrl: 'https://example.com/image.jpg' })).toContain('La miniatura no es válida.') })
  it('requiere al menos una categoría explícita', () => { expect(validateExperienceContent({ ...valid, categories: [] })).toContain('Las categorías no son válidas.') })
  it('rechaza categorías duplicadas', () => { expect(validateExperienceContent({ ...valid, categories: ['FESTIVAL', 'FESTIVAL'] })).toContain('Las categorías no son válidas.') })
  it('ordena por destacado, prioridad, año y título sin mutar', () => {
    const input = [{ ...valid, id: 'b', title: 'B', priority: 10 }, { ...valid, id: 'a', title: 'A', priority: 20 }]
    const before = structuredClone(input)
    expect(sortExperienceContents(input).map((item) => item.id)).toEqual(['a', 'b'])
    expect(input).toEqual(before)
  })
  it('filtra por categoría explícita y conserva el input', () => {
    const input = [valid, { ...valid, id: 'dreamville', categories: ['DREAMVILLE'] as const }]
    expect(filterExperienceContents(input, 'DREAMVILLE').map((item) => item.id)).toEqual(['dreamville'])
    expect(input).toHaveLength(2)
  })
  it('solo expone filtros con catálogo suficiente', () => {
    const input = [valid, { ...valid, id: 'festival-2' }, { ...valid, id: 'dreamville', categories: ['DREAMVILLE'] as const }]
    expect(getAvailableExperienceCategories(input, 2)).toEqual(['FESTIVAL'])
  })
  it('mantiene un único contenido destacado en el dataset inicial', () => { expect(experienceContents.filter((item) => item.featured)).toHaveLength(1) })
  it('valida íntegramente las siete fuentes del dataset inicial', () => {
    expect(experienceContents).toHaveLength(7)
    expect(experienceContents.flatMap(validateExperienceContent)).toEqual([])
    expect(new Set(experienceContents.map((item) => item.sourceUrl)).size).toBe(7)
  })
  it('cubre ediciones 2023, 2024 y 2025', () => { expect([...new Set(experienceContents.map((item) => item.year))].sort()).toEqual([2023, 2024, 2025]) })
  it('separa contenido oficial y experiencias personales', () => { expect(new Set(experienceContents.map((item) => item.sourceType))).toEqual(new Set(['OFFICIAL_CONTENT', 'PERSONAL_EXPERIENCE'])) })
})
