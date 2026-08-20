import type { TravelPlan } from '../models/plan'
import { getPricePerPerson } from '../models/plan'
import { categoryLabels, formatMoney, statusLabels } from '../utils/format'
import { PriceBadge } from './PriceBadge'

interface PlanCardProps { plan: TravelPlan; selected: boolean; disabled: boolean; onToggle: () => void }

export function PlanCard({ plan, selected, disabled, onToggle }: PlanCardProps) {
  const pricePerPerson = getPricePerPerson(plan)
  return <article className={`plan-card ${selected ? 'selected' : ''}`}>
    <div className="card-topline"><span className="category">{categoryLabels[plan.category]}</span><PriceBadge type={plan.priceType} /></div>
    <h2>{plan.name}</h2>
    <p className="status"><span />{statusLabels[plan.status]}</p>
    <div className="price-block">{plan.totalPrice && pricePerPerson ? <><strong>{formatMoney(plan.totalPrice)}</strong><span>total · {plan.totalPrice.currency}</span><p>{formatMoney(pricePerPerson)} por persona</p></> : <><strong>Precio pendiente</strong><span>Aún no publicado</span><p>Se actualizará desde la fuente oficial</p></>}</div>
    <dl className="plan-details"><div><dt>Alojamiento</dt><dd>{plan.accommodation}</dd></div><div><dt>Transporte</dt><dd>{plan.transport}</dd></div></dl>
    <ul className="inclusions">{plan.inclusions.map((item) => <li key={item}>{item}</li>)}</ul>
    {plan.notIncluded.length > 0 && <div className="not-included"><strong>No incluido</strong><ul>{plan.notIncluded.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {plan.sources.length > 0 && <p className="source">Fuentes: {plan.sources.map((source, index) => <span key={`${source.label}-${source.url ?? index}`}>{index > 0 && ' · '}{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</span>)}<br />Verificadas: {plan.sources[0].verifiedAt}</p>}
    <button className={selected ? 'button secondary' : 'button'} type="button" onClick={onToggle} disabled={disabled && !selected}>{selected ? 'Quitar de comparación' : 'Agregar a comparación'}</button>
  </article>
}
