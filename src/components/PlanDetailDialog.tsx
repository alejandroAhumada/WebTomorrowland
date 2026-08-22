import { ArrowUpRight, CircleCheck, CircleX, UserRound, UsersRound, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { TravelPlan } from '../models/plan'
import { getPricePerPerson } from '../models/plan'
import { formatMoney } from '../utils/format'
import { useTravelBudget } from '../hooks/useTravelBudget'
import { ClpConversion } from './ClpConversion'
import { PriceBadge } from './PriceBadge'
import { TravelBudgetBreakdown } from './TravelBudgetView'
import { BudgetPreferencesEditor } from './BudgetPreferencesEditor'

export function PlanDetailDialog({ plan, onClose }: { plan: TravelPlan; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { budget, loading: budgetLoading } = useTravelBudget(plan)
  const perPerson = getPricePerPerson(plan)
  const TravelersIcon = plan.travelerCount === 1 ? UserRound : UsersRound

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) dialog.showModal()
    return () => { previousFocus?.focus() }
  }, [])

  return <dialog ref={dialogRef} className="plan-detail-dialog" onCancel={(event) => { event.preventDefault(); onClose() }} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} aria-labelledby="plan-detail-title">
    <div className="plan-detail-panel">
      <button className="detail-close" type="button" onClick={onClose} aria-label="Cerrar detalle"><X aria-hidden="true" /></button>
      <header className="detail-heading"><p className="eyebrow">Detalle del plan</p><h2 id="plan-detail-title">{plan.name}</h2><p><TravelersIcon aria-hidden="true" />{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}</p></header>
      <section className="detail-price" aria-label="Precio Tomorrowland"><div><span>Precio Tomorrowland</span>{plan.totalPrice ? <><strong>{formatMoney(plan.totalPrice)}</strong><ClpConversion money={plan.totalPrice} />{perPerson && <small>{formatMoney(perPerson)} por persona</small>}</> : <><strong>Precio pendiente</strong><small>Aún no publicado por Tomorrowland</small></>}</div><PriceBadge type={plan.priceType} /></section>
      <TravelBudgetBreakdown budget={budget} loading={budgetLoading} />
      <BudgetPreferencesEditor />
      <div className="detail-features"><DetailList title="Incluye" items={plan.inclusions} included /><DetailList title="No incluido" items={plan.notIncluded} /></div>
      {plan.sources.map((source) => source.url ? <a className="detail-source" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.type === 'OFFICIAL' ? 'Fuente oficial' : source.label}<ArrowUpRight aria-hidden="true" /></a> : null)}
    </div>
  </dialog>
}

function DetailList({ title, items, included = false }: { title: string; items: string[]; included?: boolean }) {
  const Icon = included ? CircleCheck : CircleX
  return <section><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}><Icon aria-hidden="true" />{item}</li>)}</ul> : <p>Sin elementos informados.</p>}</section>
}
