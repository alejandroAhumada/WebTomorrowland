import { ArrowRight, CalendarDays, Columns3, Compass, MapPin, Sparkles, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { ImportantEventsSection } from '../components/ImportantEventsSection'
import { PlanRecommendationsSection } from '../components/PlanRecommendationsSection'
import { MyTripSection } from '../components/MyTripSection'
import { ImportantInformationSection } from '../components/ImportantInformationSection'

export function HomePage() {
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><Sparkles aria-hidden="true" /> Brasil · 2027</p><h1>Tomorrowland<br /><em>Consciencia</em></h1><p className="hero-lead">Explora, entiende y compara las alternativas para vivir Tomorrowland Brasil 2027 con información clara y trazable.</p><div className="event-facts"><span><CalendarDays aria-hidden="true" /><strong>30 ABR — 02 MAY</strong> 2027</span><span><MapPin aria-hidden="true" />Parque Maeda · Itu · São Paulo</span></div><a className="hero-scroll" href="#elige"><Compass aria-hidden="true" /> Descubre tu plan</a></div>
      <div className="hero-art" aria-hidden="true"><div className="constellation constellation-one" /><div className="constellation constellation-two" /><div className="portal"><div className="portal-inner"><BrandMark /></div></div><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="land land-one" /><div className="land land-two" /></div>
    </section>
    <ImportantEventsSection />
    <MyTripSection />
    <ImportantInformationSection />
    <PlanRecommendationsSection />
    <section className="journey-selector" id="elige"><div className="section-intro"><p className="eyebrow">Elige tu experiencia</p><h2>¿Cómo quieres vivir Tomorrowland?</h2><p>Dos caminos, una misma forma clara de descubrir qué incluye cada alternativa.</p></div><div className="journey-paths"><JourneyPath to="/planes/1-persona" label="Plan 1 persona" description="Explora alternativas individuales y calcula tu experiencia completa." icon={UserRound} number="01" /><JourneyPath to="/planes/2-personas" label="Plan 2 personas" description="Compara paquetes y alojamientos diseñados para compartir." icon={UsersRound} number="02" /></div></section>
    <section className="how-it-works"><div><p className="eyebrow">Tu decisión, más simple</p><h2>Todo lo importante, en un solo lugar.</h2></div><div className="steps"><article><span>01</span><Compass aria-hidden="true" /><h3>Explora</h3><p>Descubre alternativas oficiales y estimadas sin perder contexto.</p></article><article><span>02</span><Columns3 aria-hidden="true" /><h3>Compara</h3><p>Contrasta precio, alojamiento, transporte e inclusiones.</p></article><article><span>03</span><Sparkles aria-hidden="true" /><h3>Decide</h3><p>Elige la experiencia que mejor encaja contigo.</p></article></div></section>
  </>
}

function JourneyPath({ to, label, description, icon: Icon, number }: { to: string; label: string; description: string; icon: typeof UserRound; number: string }) {
  return <Link className="journey-card" to={to}><span className="journey-number">{number}</span><span className="journey-icon"><Icon aria-hidden="true" /></span><span className="journey-copy"><small>Modalidad</small><strong>{label}</strong><span>{description}</span></span><span className="journey-cta">Ver planes <ArrowRight aria-hidden="true" /></span></Link>
}
