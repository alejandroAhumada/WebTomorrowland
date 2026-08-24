import { ArrowUpRight, Play, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { experienceContents } from '../data/experienceContents'
import { filterExperienceContents, getAvailableExperienceCategories, type ExperienceCategory, type ExperienceContent } from '../models/experienceContent'

const categoryLabels: Record<ExperienceCategory, string> = {
  FESTIVAL: 'Festival', DREAMVILLE: 'DreamVille', ACCOMMODATION: 'Alojamiento', ARRIVAL: 'Llegada', TRANSPORT: 'Transporte', FOOD: 'Comida', TIPS: 'Consejos',
}

export function ExperiencesPage() {
  const [category, setCategory] = useState<ExperienceCategory | 'ALL'>('ALL')
  const featured = experienceContents.find((content) => content.featured)
  const availableCategories = getAvailableExperienceCategories(experienceContents, 2)
  const visible = filterExperienceContents(experienceContents.filter((content) => !content.featured), category)

  return <div className="experiences-page">
    <section className="experiences-hero">
      <p className="eyebrow">Ediciones anteriores</p>
      <h1>Experiencias</h1>
      <p>Descubre cómo se ha vivido Tomorrowland Brasil a través de registros oficiales y experiencias personales verificables.</p>
      <p className="experience-edition-note">Estos contenidos corresponden a ediciones anteriores y pueden no representar las condiciones de Tomorrowland Brasil 2027.</p>
    </section>

    {featured && <section className="experience-featured" aria-labelledby="featured-experience-title">
      <div className="experience-featured-media"><ExperienceThumbnail content={featured} eager /></div>
      <div className="experience-featured-copy">
        <SourceLabel content={featured} />
        <p className="experience-year">Tomorrowland Brasil · {featured.year}</p>
        <h2 id="featured-experience-title">{featured.title}</h2>
        <p>{featured.summary}</p>
        <CategoryList categories={featured.categories} />
        <ExperienceLink content={featured} />
      </div>
    </section>}

    <section className="experience-library" aria-labelledby="experience-library-title">
      <div className="experience-section-heading"><div><p className="eyebrow">Una mirada desde distintas perspectivas</p><h2 id="experience-library-title">Más registros</h2></div><p>El año y la fuente acompañan cada pieza para que puedas entender su contexto.</p></div>
      {availableCategories.length > 1 && <div className="experience-filters" role="group" aria-label="Filtrar experiencias por tema">
        <button type="button" aria-pressed={category === 'ALL'} onClick={() => setCategory('ALL')}>Todo</button>
        {availableCategories.map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{categoryLabels[value]}</button>)}
      </div>}
      <p className="experience-result-status" aria-live="polite">{visible.length} {visible.length === 1 ? 'experiencia' : 'experiencias'}</p>
      <div className="experience-grid">{visible.map((content) => <ExperienceCard key={content.id} content={content} />)}</div>
    </section>
  </div>
}

function ExperienceCard({ content }: { content: ExperienceContent }) {
  return <article className="experience-card">
    <ExperienceThumbnail content={content} />
    <div className="experience-card-copy">
      <div className="experience-card-meta"><span>{content.year}</span><SourceLabel content={content} /></div>
      <h3>{content.title}</h3>
      <p className="experience-source">Por {content.sourceName}</p>
      <CategoryList categories={content.categories} />
      <p>{content.summary}</p>
      <ExperienceLink content={content} />
    </div>
  </article>
}

function ExperienceThumbnail({ content, eager = false }: { content: ExperienceContent; eager?: boolean }) {
  return <a className="experience-thumbnail" href={content.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver video: ${content.title}`}>
    {content.thumbnailUrl && <img src={content.thumbnailUrl} alt="" width="480" height="360" loading={eager ? 'eager' : 'lazy'} />}
    <span><Play aria-hidden="true" /></span>
  </a>
}

function SourceLabel({ content }: { content: ExperienceContent }) {
  return <span className={`experience-source-type ${content.sourceType === 'OFFICIAL_CONTENT' ? 'official' : ''}`}><Sparkles aria-hidden="true" />{content.sourceType === 'OFFICIAL_CONTENT' ? 'Contenido oficial' : 'Experiencia personal'}</span>
}

function CategoryList({ categories }: { categories: readonly ExperienceCategory[] }) {
  return <ul className="experience-categories" aria-label="Temas">{categories.slice(0, 3).map((category) => <li key={category}>{categoryLabels[category]}</li>)}</ul>
}

function ExperienceLink({ content }: { content: ExperienceContent }) {
  return <a className="experience-link" href={content.sourceUrl} target="_blank" rel="noopener noreferrer">Ver video <ArrowUpRight aria-hidden="true" /></a>
}
