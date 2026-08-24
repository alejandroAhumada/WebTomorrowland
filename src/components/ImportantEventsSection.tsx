import { ArrowUpRight, Calculator, CalendarDays, Clock3, Megaphone, ShoppingBag, Sparkles, Ticket, Timer, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useImportantEvents } from '../hooks/useImportantEvents'
import type { ImportantEvent, ImportantEventType } from '../models/importantEvent'
import { formatImportantEventDate, getDaysUntilEvent, getDaysUntilEventEnds, getEventDateParts, getImportantEventState, getNextImportantEvent, type ImportantEventState } from '../utils/importantEventTime'

const eventIcons: Record<ImportantEventType, LucideIcon> = {
  REGISTRATION: Ticket,
  SIMULATOR: Calculator,
  SALE: ShoppingBag,
  PRE_SALE: ShoppingBag,
  FESTIVAL: Sparkles,
  ANNOUNCEMENT: Megaphone,
  DEADLINE: Timer,
}

export function ImportantEventsSection({ compact = false }: { compact?: boolean }) {
  const state = useImportantEvents()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return <ImportantEventsView {...state} now={now} compact={compact} />
}

export function ImportantEventsView({ events, loading, error, now, compact = false }: { events: ImportantEvent[]; loading: boolean; error: string | null; now: Date; compact?: boolean }) {
  if (loading) return <section className="important-events events-loading" aria-label="Cargando novedades y fechas clave"><span /></section>
  if (error) return <section className="important-events events-unavailable"><CalendarDays aria-hidden="true" /><p>{error}</p></section>
  if (events.length === 0) return null

  const nextEvent = getNextImportantEvent(events, now)
  return <section className={`important-events ${compact ? 'compact' : ''}`} aria-labelledby="important-events-title">
    <div className="events-heading"><div><p className="eyebrow">{compact ? 'Fechas oficiales' : 'Próximo hito'}</p><h2 id="important-events-title">{compact ? 'Calendario de Tomorrowland' : 'Lo próximo hacia Brasil 2027'}</h2></div><p>{compact ? 'Consulta el calendario global cuando lo necesites.' : 'El siguiente momento oficial que conviene tener presente.'}</p></div>
    {!compact && nextEvent && <FeaturedEvent event={nextEvent} now={now} />}
    <details className="events-calendar-disclosure"><summary>Ver todas las fechas</summary><ol className="events-timeline">{events.map((event) => <TimelineEvent key={event.id} event={event} now={now} featured={event.id === nextEvent?.id} />)}</ol></details>
  </section>
}

function FeaturedEvent({ event, now }: { event: ImportantEvent; now: Date }) {
  const Icon = eventIcons[event.type]
  const date = getEventDateParts(event)
  const state = getImportantEventState(event, now)
  const countdown = getCountdownLabel(event, state, now)
  return <article className="featured-event"><div className="featured-label"><span><Clock3 aria-hidden="true" />{state === 'TODAY' ? 'Hito en curso' : 'Próximo hito'}</span><strong>{countdown}</strong></div><div className="featured-content"><div className="event-date-block"><strong>{date.day}</strong><span>{date.month}</span><small>{date.year}</small></div><span className="featured-icon"><Icon aria-hidden="true" /></span><div className="featured-copy"><time dateTime={event.startsAt}>{formatImportantEventDate(event)}</time><h3>{event.title}</h3><p>{event.description}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Ver información oficial sobre ${event.title}, abre en una nueva pestaña`}>Ver información oficial <ArrowUpRight aria-hidden="true" /></a></div></div></article>
}

function TimelineEvent({ event, now, featured }: { event: ImportantEvent; now: Date; featured: boolean }) {
  const Icon = eventIcons[event.type]
  const state = getImportantEventState(event, now)
  return <li className={`timeline-event ${state.toLowerCase()} ${featured ? 'featured' : ''}`}><span className="timeline-marker"><Icon aria-hidden="true" /></span><div className="timeline-date"><time dateTime={event.startsAt}>{formatImportantEventDate(event)}</time><TemporalBadge state={state} ranged={Boolean(event.endsAt)} /></div><h3>{event.title}</h3><p>{event.description}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${event.sourceName}: ${event.title}, abre en una nueva pestaña`}>{event.sourceName}<ArrowUpRight aria-hidden="true" /></a></li>
}

function TemporalBadge({ state, ranged }: { state: ImportantEventState; ranged: boolean }) {
  const label = state === 'UPCOMING' ? 'Próximo' : state === 'PAST' ? 'Finalizado' : state === 'CANCELLED' ? 'Cancelado' : ranged ? 'En curso' : 'Hoy'
  return <span className={`temporal-badge ${state.toLowerCase()}`}>{label}</span>
}

function getCountdownLabel(event: ImportantEvent, state: ImportantEventState, now: Date): string {
  if (state === 'TODAY') {
    const days = getDaysUntilEventEnds(event, now)
    if (event.endsAt && days > 0) return `Termina en ${days} ${days === 1 ? 'día' : 'días'}`
    return event.endsAt ? 'Último día' : 'Es hoy'
  }
  const days = getDaysUntilEvent(event, now)
  return `Falta${days === 1 ? '' : 'n'} ${days} ${days === 1 ? 'día' : 'días'}`
}
