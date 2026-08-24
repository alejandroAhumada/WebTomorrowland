import { assertValidExperienceContent, sortExperienceContents, type ExperienceContent } from '../models/experienceContent'

const observedAt = '2026-08-24'
const youtube = (id: string) => `https://www.youtube.com/watch?v=${id}`
const thumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

const curatedContents: ExperienceContent[] = [
  {
    id: 'tomorrowland-brasil-2025-aftermovie', title: 'Tomorrowland Brasil 2025 | Aftermovie',
    summary: 'Aftermovie publicado por Tomorrowland con registros del ambiente, los escenarios y el público en Parque Maeda durante la edición 2025.',
    year: 2025, sourceType: 'OFFICIAL_CONTENT', sourceName: 'Tomorrowland', sourceUrl: youtube('JCf3cx9edOI'), sourcePublisherUrl: 'https://www.youtube.com/@tomorrowland', mediaType: 'VIDEO', categories: ['FESTIVAL'], thumbnailUrl: thumbnail('JCf3cx9edOI'), featured: true, priority: 100, observedAt,
  },
  {
    id: 'primer-dia-tomorrowland-brasil-2025-tiago-lopes', title: 'Mi primer día en Tomorrowland Brasil 2025',
    summary: 'Vlog del primer día del autor, con su recorrido y primeras impresiones dentro de la edición 2025.',
    year: 2025, sourceType: 'PERSONAL_EXPERIENCE', sourceName: 'Tiago Lopes', sourceUrl: youtube('SxnSNH-TEY0'), sourcePublisherUrl: 'https://www.youtube.com/@tialopes', mediaType: 'VIDEO', categories: ['FESTIVAL', 'ARRIVAL'], thumbnailUrl: thumbnail('SxnSNH-TEY0'), featured: false, priority: 85, observedAt,
  },
  {
    id: 'debut-tomorrowland-brasil-2024-viot', title: 'Mi debut en Tomorrowland Brasil 2024',
    summary: 'Registro tras bastidores de la primera presentación del artista en Tomorrowland Brasil 2024.',
    year: 2024, sourceType: 'PERSONAL_EXPERIENCE', sourceName: 'Viot', sourceUrl: youtube('8FLFQfu651Y'), sourcePublisherUrl: 'https://www.youtube.com/@viotmusic', mediaType: 'VIDEO', categories: ['FESTIVAL'], thumbnailUrl: thumbnail('8FLFQfu651Y'), featured: false, priority: 72, observedAt,
  },
  {
    id: 'vlog-tomorrowland-brasil-2024-curol', title: 'Vlog de Tomorrowland Brasil 2024',
    summary: 'Video publicado por la artista durante su participación en la edición 2024, con momentos de su jornada en el festival.',
    year: 2024, sourceType: 'PERSONAL_EXPERIENCE', sourceName: 'Curol', sourceUrl: youtube('j1FLNDpgaz0'), sourcePublisherUrl: 'https://www.youtube.com/@curol', mediaType: 'VIDEO', categories: ['FESTIVAL'], thumbnailUrl: thumbnail('j1FLNDpgaz0'), featured: false, priority: 66, observedAt,
  },
  {
    id: 'tomorrowland-brasil-2023-official-aftermovie', title: 'Tomorrowland Brasil 2023 | Official Aftermovie',
    summary: 'Registro oficial publicado por Tomorrowland con imágenes de los escenarios, el público y el ambiente de la edición 2023.',
    year: 2023, sourceType: 'OFFICIAL_CONTENT', sourceName: 'Tomorrowland', sourceUrl: youtube('j2SXyRpLIkQ'), sourcePublisherUrl: 'https://www.youtube.com/@tomorrowland', mediaType: 'VIDEO', categories: ['FESTIVAL'], thumbnailUrl: thumbnail('j2SXyRpLIkQ'), featured: false, priority: 80, observedAt,
  },
  {
    id: 'festival-dreamville-2023-gabriel-oliveira-leite', title: 'Festival y DreamVille en 2023',
    summary: 'Vlog que recorre la experiencia del autor durante el festival y su estadía en DreamVille en la edición 2023.',
    year: 2023, sourceType: 'PERSONAL_EXPERIENCE', sourceName: 'Gabriel Oliveira Leite', sourceUrl: youtube('mY_veZiHGJ0'), sourcePublisherUrl: 'https://www.youtube.com/@gaboleite', mediaType: 'VIDEO', categories: ['FESTIVAL', 'DREAMVILLE'], thumbnailUrl: thumbnail('mY_veZiHGJ0'), featured: false, priority: 90, observedAt,
  },
  {
    id: 'primer-dia-tomorrowland-brasil-2023-tiago-lopes', title: 'Primer día en Tomorrowland Brasil 2023',
    summary: 'Registro personal del recorrido y la experiencia del autor durante el primer día de la edición 2023.',
    year: 2023, sourceType: 'PERSONAL_EXPERIENCE', sourceName: 'Tiago Lopes', sourceUrl: youtube('cBh_s18Rpd0'), sourcePublisherUrl: 'https://www.youtube.com/@tialopes', mediaType: 'VIDEO', categories: ['FESTIVAL', 'ARRIVAL'], thumbnailUrl: thumbnail('cBh_s18Rpd0'), featured: false, priority: 76, observedAt,
  },
]

export const experienceContents = Object.freeze(sortExperienceContents(curatedContents.map(assertValidExperienceContent)))
