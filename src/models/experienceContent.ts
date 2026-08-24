export const EXPERIENCE_CATEGORIES = ['FESTIVAL', 'DREAMVILLE', 'ACCOMMODATION', 'ARRIVAL', 'TRANSPORT', 'FOOD', 'TIPS'] as const

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number]
export type ExperienceSourceType = 'PERSONAL_EXPERIENCE' | 'OFFICIAL_CONTENT'
export type ExperienceMediaType = 'VIDEO' | 'ARTICLE'

export interface ExperienceContent {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly year: number
  readonly sourceType: ExperienceSourceType
  readonly sourceName: string
  readonly sourceUrl: string
  readonly sourcePublisherUrl?: string
  readonly mediaType: ExperienceMediaType
  readonly categories: readonly ExperienceCategory[]
  readonly thumbnailUrl?: string
  readonly featured: boolean
  readonly priority: number
  readonly observedAt: string
}

export function validateExperienceContent(content: ExperienceContent): string[] {
  const errors: string[] = []
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(content.id)) errors.push('El ID no es válido.')
  if (!isText(content.title, 140) || !isText(content.summary, 320) || !isText(content.sourceName, 100)) errors.push('El contenido editorial no es válido.')
  if (!Number.isInteger(content.year) || content.year < 2015 || content.year > 2026) errors.push('El año debe corresponder a una edición anterior.')
  if (!['PERSONAL_EXPERIENCE', 'OFFICIAL_CONTENT'].includes(content.sourceType)) errors.push('El tipo de fuente no es válido.')
  if (!['VIDEO', 'ARTICLE'].includes(content.mediaType)) errors.push('El tipo de contenido no es válido.')
  if (!isSafeSourceUrl(content.sourceUrl)) errors.push('La URL de origen no es válida.')
  if (content.sourcePublisherUrl && !isSafeSourceUrl(content.sourcePublisherUrl)) errors.push('La URL del autor no es válida.')
  if (content.thumbnailUrl && !isSafeThumbnailUrl(content.thumbnailUrl)) errors.push('La miniatura no es válida.')
  if (!Array.isArray(content.categories) || content.categories.length === 0 || content.categories.some((category) => !EXPERIENCE_CATEGORIES.includes(category)) || new Set(content.categories).size !== content.categories.length) errors.push('Las categorías no son válidas.')
  if (typeof content.featured !== 'boolean' || !Number.isInteger(content.priority) || content.priority < 0 || content.priority > 100) errors.push('La prioridad no es válida.')
  if (!isCivilDate(content.observedAt)) errors.push('La fecha de observación no es válida.')
  if (content.sourceType === 'OFFICIAL_CONTENT' && content.sourceName !== 'Tomorrowland') errors.push('El contenido oficial debe atribuirse a Tomorrowland.')
  return errors
}

export function assertValidExperienceContent(content: ExperienceContent): ExperienceContent {
  const errors = validateExperienceContent(content)
  if (errors.length) throw new Error(`Experiencia inválida (${content.id}): ${errors.join(' ')}`)
  return content
}

export function sortExperienceContents(contents: readonly ExperienceContent[]): ExperienceContent[] {
  return [...contents].sort((a, b) => Number(b.featured) - Number(a.featured) || b.priority - a.priority || b.year - a.year || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

export function filterExperienceContents(contents: readonly ExperienceContent[], category: ExperienceCategory | 'ALL'): ExperienceContent[] {
  return sortExperienceContents(category === 'ALL' ? contents : contents.filter((content) => content.categories.includes(category)))
}

export function getAvailableExperienceCategories(contents: readonly ExperienceContent[], minimumItems = 1): ExperienceCategory[] {
  return EXPERIENCE_CATEGORIES.filter((category) => contents.filter((content) => content.categories.includes(category)).length >= minimumItems)
}

function isText(value: string, maxLength: number): boolean { return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength }
function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function isSafeSourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname) }
  catch { return false }
}
function isSafeThumbnailUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'i.ytimg.com' }
  catch { return false }
}
