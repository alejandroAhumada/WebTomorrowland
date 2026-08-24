import { ArrowUpRight, Bookmark, BookmarkCheck, CircleCheck, CircleX, UserRound, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TravelPlan } from '../models/plan'
import { getPricePerPerson } from '../models/plan'
import { formatMoney } from '../utils/format'
import { useTravelBudget } from '../hooks/useTravelBudget'
import { ClpConversion } from './ClpConversion'
import { PriceBadge } from './PriceBadge'
import { TravelBudgetBreakdown } from './TravelBudgetView'
import { BudgetPreferencesEditor } from './BudgetPreferencesEditor'
import { useMyTrip } from '../state/useMyTrip'
import { useTripPreparation } from '../state/useTripPreparation'
import { calculateExecutedTravelBudget } from '../models/executedTravelBudget'
import { ExecutedBudgetBreakdown } from './ExecutedBudgetView'
import { useTicketTiers } from '../hooks/useTicketTiers'
import { getPlanCatalogEntry, getPlanTierOptions, planForTierBudget, tierDeltaFromRegular, type PlanTierOption } from '../models/planCatalog'

export function PlanDetailDialog({ plan, onClose, openBudgetEditor = false }: { plan: TravelPlan; onClose: () => void; openBudgetEditor?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { consideredTierByPlan, setConsideredTier, isMyPlan, selectPlan, clearPlan } = useMyTrip()
  const perPerson = getPricePerPerson(plan)
  const TravelersIcon = plan.travelerCount === 1 ? UserRound : UsersRound
  const selectedAsMyPlan = isMyPlan(plan.id)
  const { state: preparation } = useTripPreparation()
  const { tiers } = useTicketTiers()
  const planTiers = useMemo(() => getPlanTierOptions(plan, tiers), [tiers, plan])
  const [localTierId, setLocalTierId] = useState('regular')
  const selectedTierId = selectedAsMyPlan ? consideredTierByPlan[plan.id] ?? 'regular' : localTierId
  const selectedTier = planTiers.find((entry) => entry.tier.id === selectedTierId) ?? planTiers.find((entry) => entry.tier.type === 'REGULAR') ?? planTiers[0]
  const planningPlan = useMemo(() => planForTierBudget(plan, selectedTier ?? null), [plan, selectedTier])
  const { budget, loading: budgetLoading } = useTravelBudget(planningPlan)
  const executed = calculateExecutedTravelBudget(budget, preparation.plans[plan.id] ?? {})
  const catalogEntry = getPlanCatalogEntry(plan.id)

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
      <section className="detail-price" aria-label={catalogEntry?.classification === 'DERIVED_SCENARIO' ? 'Cálculo base para dos personas' : 'Precio Tomorrowland'}><div><span>{catalogEntry?.classification === 'DERIVED_SCENARIO' ? 'Cálculo base para 2 personas' : 'Precio Tomorrowland'}</span>{plan.totalPrice ? <><strong>{formatMoney(plan.totalPrice)}</strong><ClpConversion money={plan.totalPrice} />{perPerson && <small>{catalogEntry?.classification === 'DERIVED_SCENARIO' ? `2 × ${formatMoney(perPerson)} por entrada individual` : `${formatMoney(perPerson)} por persona`}</small>}</> : <><strong>Precio pendiente</strong><small>Aún no publicado por Tomorrowland</small></>}</div><PriceBadge type={plan.priceType} /></section>
      {catalogEntry?.classification === 'DERIVED_SCENARIO' && <p className="catalog-disclosure"><strong>Escenario de planificación derivado.</strong> {catalogEntry.explanation}</p>}
      {catalogEntry?.classification === 'PENDING_OFFICIAL_INFORMATION' && <p className="catalog-disclosure"><strong>Información oficial pendiente.</strong> {catalogEntry.explanation}</p>}
      {planTiers.length > 0 && <TierExplorer entries={planTiers} selectedId={selectedTier?.tier.id ?? ''} onSelect={(id) => { setLocalTierId(id); if (selectedAsMyPlan) setConsideredTier(plan.id, id) }} />}
      <section className="my-plan-action" aria-label="Planificación de Mi viaje"><div>{selectedAsMyPlan ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}<p><strong>{selectedAsMyPlan ? 'Este es mi plan' : '¿Quieres planificar con esta alternativa?'}</strong><span>Esta selección sirve para organizar tu viaje y no representa una reserva o compra.</span></p></div>{selectedAsMyPlan ? <button className="text-button" type="button" onClick={clearPlan}>Dejar de usar como mi plan</button> : <button className="button secondary" type="button" onClick={() => { selectPlan(plan.id); if (selectedTier) setConsideredTier(plan.id, selectedTier.tier.id) }}>Elegir como mi plan</button>}</section>
      <TravelBudgetBreakdown budget={budget} loading={budgetLoading} />
      {selectedAsMyPlan && <ExecutedBudgetBreakdown executed={executed} />}
      <BudgetPreferencesEditor defaultOpen={openBudgetEditor} />
      <div className="detail-features"><DetailList title="Incluye" items={plan.inclusions} included /><DetailList title="No incluido" items={plan.notIncluded} /></div>
      {plan.sources.map((source) => source.url ? <a className="detail-source" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.type === 'OFFICIAL' ? 'Fuente oficial' : source.label}<ArrowUpRight aria-hidden="true" /></a> : null)}
    </div>
  </dialog>
}

function TierExplorer({ entries, selectedId, onSelect }: { entries: PlanTierOption[]; selectedId: string; onSelect: (id: string) => void }) {
  const selected = entries.find((entry) => entry.tier.id === selectedId) ?? entries[0]
  const regular = entries.find((entry) => entry.tier.type === 'REGULAR')
  const delta = tierDeltaFromRegular(selected, regular)
  return <section className="tier-explorer" aria-labelledby="tier-explorer-title"><div><p className="eyebrow">Modalidad considerada</p><h3 id="tier-explorer-title">Compara las modalidades oficiales</h3></div>
    <div className="tier-selector" role="group" aria-label="Modalidad de entrada">{entries.map(({ tier }) => <button type="button" key={tier.id} aria-pressed={selected.tier.id === tier.id} onClick={() => onSelect(tier.id)}>{tier.name}</button>)}</div>
    <div className="tier-price"><span>{selected.priceNature === 'DERIVED' ? 'Cálculo para este escenario' : 'Precio oficial de esta modalidad'}</span>{selected.totalPrice ? <><strong>{formatMoney(selected.totalPrice)}</strong>{selected.priceNature === 'DERIVED' && selected.unitPrice && <small>{selected.multiplier} × {formatMoney(selected.unitPrice)} por entradas individuales</small>}<ClpConversion money={selected.totalPrice} />{delta && delta.amount !== 0 && <small>+ {formatMoney(delta)} respecto de Regular{selected.priceNature === 'DERIVED' ? ' (cálculo derivado)' : ''}</small>}</> : <><strong>Precio pendiente</strong><small>Tomorrowland aún no publica un precio inequívoco para esta configuración.</small></>}</div>
    <p>{selected.tier.description}</p><ul>{selected.tier.benefits.map((benefit) => <li key={benefit}><CircleCheck aria-hidden="true" />{benefit}</li>)}</ul>
    {selected.tier.conditions.map((condition) => <small key={condition}>{condition}</small>)}
    <a className="detail-source" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Ver en Tomorrowland <ArrowUpRight aria-hidden="true" /></a>
    <p className="tier-note">Selección utilizada solo para planificación. Las compras se realizan exclusivamente en los canales oficiales de Tomorrowland.</p>
  </section>
}

function DetailList({ title, items, included = false }: { title: string; items: string[]; included?: boolean }) {
  const Icon = included ? CircleCheck : CircleX
  return <section><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}><Icon aria-hidden="true" />{item}</li>)}</ul> : <p>Sin elementos informados.</p>}</section>
}
