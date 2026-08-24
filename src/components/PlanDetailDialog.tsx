import { ArrowUpRight, Bookmark, BookmarkCheck, Check, CircleCheck, CircleX, UserRound, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useExchangeRate } from '../hooks/useExchangeRate'
import { useTicketTiers } from '../hooks/useTicketTiers'
import { useTravelBudget } from '../hooks/useTravelBudget'
import { calculateExecutedTravelBudget } from '../models/executedTravelBudget'
import { convertMoney } from '../models/exchangeRate'
import type { TravelPlan } from '../models/plan'
import { getPlanCatalogEntry, getPlanTierOptions, planForTierBudget, tierDeltaFromRegular, type PlanTierOption } from '../models/planCatalog'
import { useMyTrip } from '../state/useMyTrip'
import { useTripPreparation } from '../state/useTripPreparation'
import { formatMoney } from '../utils/format'
import { BudgetPreferencesEditor } from './BudgetPreferencesEditor'
import { ExecutedBudgetBreakdown } from './ExecutedBudgetView'
import { PriceBadge } from './PriceBadge'
import { TravelBudgetBreakdown, TravelBudgetSummary } from './TravelBudgetView'

export function PlanDetailDialog({ plan, onClose, openBudgetEditor = false }: { plan: TravelPlan; onClose: () => void; openBudgetEditor?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const { consideredTierByPlan, setConsideredTier, isMyPlan, selectPlan, clearPlan } = useMyTrip()
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
    const previousFocus = previousFocusRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { window.requestAnimationFrame(() => previousFocus?.focus()) }
  }, [])

  return <dialog ref={dialogRef} className="plan-detail-dialog" onCancel={(event) => { event.preventDefault(); onClose() }} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} aria-labelledby="plan-detail-title">
    <div className="plan-detail-panel">
      <button className="detail-close" type="button" onClick={onClose} aria-label="Cerrar detalle"><X aria-hidden="true" /></button>
      <header className="detail-heading"><p className="eyebrow">Plan para explorar</p><h2 id="plan-detail-title">{plan.name}</h2><p><TravelersIcon aria-hidden="true" />{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'} · {catalogEntry?.classification === 'DERIVED_SCENARIO' ? 'cálculo de entradas individuales' : catalogEntry?.classification === 'PENDING_OFFICIAL_INFORMATION' ? 'información oficial pendiente' : catalogEntry?.classification === 'OFFICIAL_PRODUCT' ? 'producto oficial' : 'información parcial sin clasificar'}</p></header>
      {catalogEntry?.classification === 'DERIVED_SCENARIO' && <p className="catalog-disclosure"><strong>Cálculo para 2 personas.</strong> Son dos entradas individuales; no es un pack oficial 2P.</p>}
      {catalogEntry?.classification === 'PENDING_OFFICIAL_INFORMATION' && <p className="catalog-disclosure"><strong>Precio aún no publicado.</strong> {catalogEntry.explanation}</p>}
      {planTiers.length > 0 ? <TierExplorer entries={planTiers} selectedId={selectedTier?.tier.id ?? ''} onSelect={(id) => { setLocalTierId(id); if (selectedAsMyPlan) setConsideredTier(plan.id, id) }} /> : <StandalonePrice plan={plan} />}
      <section className="detail-trip-summary" aria-labelledby="detail-trip-summary-title"><div><p className="eyebrow">Estimación de viaje</p><h3 id="detail-trip-summary-title">Viaje con esta modalidad</h3><p>Precio Tomorrowland más vuelo, alojamiento cuando corresponde y gastos referenciales.</p></div><TravelBudgetSummary budget={budget} loading={budgetLoading} /></section>
      <section className="my-plan-action" aria-label="Planificación de Mi viaje"><div>{selectedAsMyPlan ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}<p><strong>{selectedAsMyPlan ? 'Este es mi plan' : '¿Quieres planificar con esta alternativa?'}</strong><span>Sirve para organizar tu viaje; no representa una reserva ni una compra.</span></p></div>{selectedAsMyPlan ? <button className="text-button" type="button" onClick={clearPlan}>Dejar de usar como mi plan</button> : <button className="button secondary" type="button" onClick={() => { selectPlan(plan.id); if (selectedTier) setConsideredTier(plan.id, selectedTier.tier.id) }}>Elegir como mi plan</button>}</section>
      <DetailDisclosure title="Ver desglose del viaje"><TravelBudgetBreakdown budget={budget} loading={budgetLoading} />{selectedAsMyPlan && <ExecutedBudgetBreakdown executed={executed} />}</DetailDisclosure>
      <BudgetPreferencesEditor defaultOpen={openBudgetEditor} />
      <DetailDisclosure title="Ver inclusiones y exclusiones"><div className="detail-features"><DetailList title="Incluye" items={plan.inclusions} included /><DetailList title="No incluido" items={plan.notIncluded} /></div></DetailDisclosure>
      <DetailDisclosure title="Fuente y actualización"><div className="detail-sources">{plan.sources.map((source) => source.url ? <a className="detail-source" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.type === 'OFFICIAL' ? 'Ver información oficial' : source.label}<ArrowUpRight aria-hidden="true" /></a> : null)}<p>La equivalencia CLP usa la tasa vigente disponible del Banco Central de Chile. Los precios oficiales se conservan en BRL.</p></div></DetailDisclosure>
    </div>
  </dialog>
}

function StandalonePrice({ plan }: { plan: TravelPlan }) {
  return <section className="detail-price"><div><span>Precio Tomorrowland</span>{plan.totalPrice ? <><ClpAmount money={plan.totalPrice} /><strong className="official-brl">{formatMoney(plan.totalPrice)}</strong><small>{plan.priceType === 'OFFICIAL' ? 'Precio oficial Tomorrowland' : 'Precio estimado'}</small></> : <><strong>Precio aún no publicado</strong><small>Tomorrowland todavía no informa el precio.</small></>}</div><PriceBadge type={plan.priceType} /></section>
}

function TierExplorer({ entries, selectedId, onSelect }: { entries: PlanTierOption[]; selectedId: string; onSelect: (id: string) => void }) {
  const selected = entries.find((entry) => entry.tier.id === selectedId) ?? entries[0]
  const regular = entries.find((entry) => entry.tier.type === 'REGULAR')
  const delta = tierDeltaFromRegular(selected, regular)
  return <section className="tier-explorer" aria-labelledby="tier-explorer-title"><div><p className="eyebrow">Modalidad para planificar</p><h3 id="tier-explorer-title">Compara precios y diferencias</h3></div>
    <div className="tier-selector" role="group" aria-label="Modalidad para planificar">{entries.map(({ tier }) => <button type="button" key={tier.id} aria-pressed={selected.tier.id === tier.id} onClick={() => onSelect(tier.id)}>{tier.name}</button>)}</div>
    <div className="tier-price"><span>{selected.priceNature === 'DERIVED' ? 'Cálculo para 2 personas' : 'Precio de esta modalidad'}</span>{selected.totalPrice ? <><ClpAmount money={selected.totalPrice} /><strong className="official-brl">{formatMoney(selected.totalPrice)}</strong><small>{selected.priceNature === 'DERIVED' && selected.unitPrice ? `${selected.multiplier} × ${formatMoney(selected.unitPrice)} por entradas individuales` : 'Precio oficial Tomorrowland'}</small><TierDelta delta={delta} derived={selected.priceNature === 'DERIVED'} /></> : <><strong>Precio aún no publicado</strong><small>Tomorrowland no publica todavía un precio inequívoco para esta configuración.</small></>}</div>
    <TierComparison entries={entries} regular={regular} />
    <div className="tier-key-benefits"><h4>Diferencias de {selected.tier.name}</h4><p>{selected.tier.description}</p><ul>{selected.tier.benefits.slice(0, 4).map((benefit) => <li key={benefit}><CircleCheck aria-hidden="true" />{benefit}</li>)}</ul></div>
    {(selected.tier.benefits.length > 4 || selected.tier.conditions.length > 0) && <DetailDisclosure title="Ver todos los beneficios y condiciones"><ul>{selected.tier.benefits.map((benefit) => <li key={benefit}><CircleCheck aria-hidden="true" />{benefit}</li>)}</ul>{selected.tier.conditions.map((condition) => <small key={condition}>{condition}</small>)}</DetailDisclosure>}
    <a className="detail-source" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Ver en Tomorrowland <ArrowUpRight aria-hidden="true" /></a>
    <p className="tier-note">Esta modalidad se usa solo para planificación. Las compras se realizan exclusivamente en los canales oficiales de Tomorrowland.</p>
  </section>
}

function TierComparison({ entries, regular }: { entries: PlanTierOption[]; regular?: PlanTierOption }) {
  return <section className="tier-comparison" aria-label="Resumen de modalidades">{entries.map((entry) => <article key={entry.tier.id}><h4>{entry.tier.name}</h4>{entry.totalPrice ? <><ClpAmount money={entry.totalPrice} compact /><strong>{formatMoney(entry.totalPrice)}</strong><TierDelta delta={tierDeltaFromRegular(entry, regular)} derived={entry.priceNature === 'DERIVED'} compact /></> : <strong>Precio aún no publicado</strong>}<ul>{entry.tier.benefits.slice(0, 2).map((benefit) => <li key={benefit}><Check aria-hidden="true" />{benefit}</li>)}</ul></article>)}</section>
}

function ClpAmount({ money, compact = false }: { money: NonNullable<TravelPlan['totalPrice']>; compact?: boolean }) {
  const { rate, loading } = useExchangeRate(money.currency, 'CLP')
  const converted = convertMoney(money, 'CLP', rate)
  return <strong className={`tier-clp ${compact ? 'compact' : ''}`}>{loading ? 'Calculando CLP…' : converted ? `≈ ${formatMoney(converted)} CLP` : 'Equivalencia CLP no disponible'}</strong>
}

function TierDelta({ delta, derived, compact = false }: { delta: ReturnType<typeof tierDeltaFromRegular>; derived: boolean; compact?: boolean }) {
  const { rate } = useExchangeRate('BRL', 'CLP')
  if (!delta || delta.amount === 0) return <span className={`tier-delta ${compact ? 'compact' : ''}`}>Base Regular</span>
  const clp = convertMoney(delta, 'CLP', rate)
  return <span className={`tier-delta ${compact ? 'compact' : ''}`}>+ {formatMoney(delta)}{clp ? <> · ≈ + {formatMoney(clp)} CLP</> : null} vs. Regular{derived ? ' · cálculo 2P' : ''}</span>
}

function DetailDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="detail-disclosure"><summary>{title}</summary><div className="detail-disclosure-content">{children}</div></details>
}

function DetailList({ title, items, included = false }: { title: string; items: string[]; included?: boolean }) {
  const Icon = included ? CircleCheck : CircleX
  return <section><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}><Icon aria-hidden="true" />{item}</li>)}</ul> : <p>Sin elementos informados.</p>}</section>
}
