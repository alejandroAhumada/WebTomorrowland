import type { TravelPlan } from '../models/plan'
import { getPricePerPerson } from '../models/plan'
import { categoryLabels, formatMoney, statusLabels } from '../utils/format'
import { PriceBadge } from './PriceBadge'

interface PlanCardProps { plan: TravelPlan; selected: boolean; disabled: boolean; onToggle: () => void }

export function PlanCard({ plan, selected, disabled, onToggle }: PlanCardProps) {
  return <article className={`plan-card ${selected ? 'selected' : ''}`}>
    <div className="card-topline"><span className="category">{categoryLabels[plan.category]}</span><PriceBadge type={plan.priceType} /></div>
    <h2>{plan.name}</h2>
    <p className="status"><span />{statusLabels[plan.status]}</p>
    <div className="price-block"><strong>{formatMoney(plan.totalPrice)}</strong><span>total · {plan.totalPrice.currency}</span><p>{formatMoney(getPricePerPerson(plan))} por persona</p></div>
    <dl className="plan-details"><div><dt>Alojamiento</dt><dd>{plan.accommodation}</dd></div><div><dt>Transporte</dt><dd>{plan.transport}</dd></div></dl>
    <ul className="inclusions">{plan.inclusions.map((item) => <li key={item}>{item}</li>)}</ul>
    {plan.source && <p className="source">Fuente: {plan.source.url ? <a href={plan.source.url} target="_blank" rel="noreferrer">{plan.source.label}</a> : plan.source.label}<br />Verificada: {plan.source.verifiedAt}</p>}
    <button className={selected ? 'button secondary' : 'button'} type="button" onClick={onToggle} disabled={disabled && !selected}>{selected ? 'Quitar de comparación' : 'Agregar a comparación'}</button>
  </article>
}
