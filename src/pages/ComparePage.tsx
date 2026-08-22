import { ArrowRight, Bus, Check, CircleMinus, Coins, Columns3, Hotel, Plane, TentTree, Ticket, Trash2, Utensils, WalletCards, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AvailabilityBadge } from '../components/AvailabilityBadge'
import { ClpConversion } from '../components/ClpConversion'
import { PriceBadge } from '../components/PriceBadge'
import { usePlans } from '../hooks/usePlans'
import { useTravelBudget } from '../hooks/useTravelBudget'
import { getPricePerPerson, type TravelPlan } from '../models/plan'
import type { BudgetCategory } from '../models/travelBudget'
import { budgetItemTotalMoney } from '../models/travelBudget'
import { useSelection } from '../state/useSelection'
import { formatMoney } from '../utils/format'

export function ComparePage() {
  const { selectedIds, toggle, clear } = useSelection()
  const { plans, loading, error } = usePlans(undefined, selectedIds)

  if (selectedIds.length === 0) return <div className="page-container empty-state"><span className="empty-icon"><Columns3 aria-hidden="true" /></span><p className="eyebrow">Comparador</p><h1>Elige los planes que quieres mirar de cerca</h1><p>Selecciona hasta tres alternativas para contrastar precios, alojamiento e inclusiones.</p><div><Link className="button" to="/planes/1-persona">Ver plan 1 persona <ArrowRight aria-hidden="true" /></Link><Link className="button secondary" to="/planes/2-personas">Ver plan 2 personas</Link></div></div>

  return <div className="page-container compare-page"><div className="page-heading"><div><p className="eyebrow">Comparador de experiencias</p><h1><Columns3 aria-hidden="true" />{selectedIds.length} alternativas, una decisión</h1><p>Contrasta lo esencial sin perder de vista el precio original.</p></div><button className="text-button" type="button" onClick={clear}><Trash2 aria-hidden="true" />Limpiar selección</button></div>
    {loading && <p className="notice">Preparando comparación…</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && <><DesktopComparison plans={plans} onRemove={toggle} /><MobileComparison plans={plans} onRemove={toggle} /></>}
  </div>
}

function DesktopComparison({ plans, onRemove }: { plans: TravelPlan[]; onRemove: (id: string) => void }) {
  return <div className="comparison-scroll compare-desktop"><table className="comparison-table"><thead><tr><th scope="col">Comparar</th>{plans.map((plan) => <th scope="col" key={plan.id}><PlanHeading plan={plan} onRemove={onRemove} /></th>)}</tr></thead><tbody>
    <Row icon={<Ticket />} label="Precio total" plans={plans} render={(plan) => plan.totalPrice ? <div className="compare-price"><strong>{formatMoney(plan.totalPrice)}</strong><ClpConversion money={plan.totalPrice} compact /></div> : 'Pendiente de publicación'} />
    <Row label="Por persona" plans={plans} render={(plan) => { const price = getPricePerPerson(plan); return price ? formatMoney(price) : 'Pendiente' }} />
    <Row icon={<Coins />} label="Presupuesto completo estimado" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} field="total" />} />
    <Row label="Presupuesto por persona" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} field="perPerson" />} />
    <Row icon={<Ticket />} label="Tomorrowland (CLP ref.)" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} category="TOMORROWLAND" />} />
    <Row icon={<Plane />} label="Vuelo" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} category="FLIGHT" />} />
    <Row icon={<Bus />} label="Transporte local" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} category="LOCAL_TRANSPORT" />} />
    <Row icon={<Utensils />} label="Alimentación" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} category="FOOD" />} />
    <Row icon={<WalletCards />} label="Gastos personales" plans={plans} render={(plan) => <BudgetCompareValue plan={plan} category="PERSONAL_EXPENSES" />} />
    <Row icon={<Hotel />} label="Alojamiento" plans={plans} render={(plan) => plan.accommodation} />
    <Row icon={<Plane />} label="Transporte" plans={plans} render={(plan) => plan.transport} />
    <Row icon={<Ticket />} label="Festival / entrada" plans={plans} render={(plan) => plan.festivalPass} />
    <Row icon={<TentTree />} label="DreamVille" plans={plans} render={(plan) => <BooleanValue value={plan.dreamVilleIncluded} trueLabel="Incluido, equipamiento provisto" falseLabel="No incluido" />} />
    <Row label="Inclusiones" plans={plans} render={(plan) => <ItemList items={plan.inclusions} positive />} />
    <Row label="No incluido" plans={plans} render={(plan) => plan.notIncluded.length ? <ItemList items={plan.notIncluded} /> : 'Sin exclusiones informadas'} />
    <Row label="Tipo de precio" plans={plans} render={(plan) => <PriceBadge type={plan.priceType} />} />
    <Row label="Disponibilidad" plans={plans} render={(plan) => <AvailabilityBadge status={plan.status} />} />
  </tbody></table></div>
}

function MobileComparison({ plans, onRemove }: { plans: TravelPlan[]; onRemove: (id: string) => void }) {
  return <div className="compare-mobile" aria-label="Comparación de planes">{plans.map((plan) => {
    const perPerson = getPricePerPerson(plan)
    return <article className="mobile-compare-card" key={plan.id}><PlanHeading plan={plan} onRemove={onRemove} />
      <div className="mobile-price">{plan.totalPrice ? <><strong>{formatMoney(plan.totalPrice)}</strong><ClpConversion money={plan.totalPrice} compact />{perPerson && <span>{formatMoney(perPerson)} por persona</span>}</> : <strong>Precio pendiente</strong>}</div>
      <MobileBudgetComparison plan={plan} />
      <CompareFact icon={<Hotel />} label="Alojamiento" value={plan.accommodation} />
      <CompareFact icon={<Plane />} label="Transporte" value={plan.transport} />
      <CompareFact icon={<Ticket />} label="Festival" value={plan.festivalPass} />
      <CompareFact icon={<TentTree />} label="DreamVille" value={plan.dreamVilleIncluded ? 'Incluido, equipamiento provisto' : 'No incluido'} />
      <section className="mobile-feature"><h3>Incluye</h3><ItemList items={plan.inclusions} positive /></section>
      {plan.notIncluded.length > 0 && <section className="mobile-feature"><h3>No incluido</h3><ItemList items={plan.notIncluded} /></section>}
      <div className="mobile-card-footer"><PriceBadge type={plan.priceType} /><AvailabilityBadge status={plan.status} /></div>
    </article>
  })}</div>
}

export function BudgetCompareValue({ plan, field, category }: { plan: TravelPlan; field?: 'total' | 'perPerson'; category?: BudgetCategory }) {
  const { budget, loading } = useTravelBudget(plan)
  if (loading) return <span className="budget-compare muted">Calculando…</span>
  if (field === 'total') return <span className="budget-compare">{budget.total ? `≈ ${formatMoney(budget.total)}` : 'Pendiente de precio Tomorrowland'}</span>
  if (field === 'perPerson') return <span className="budget-compare emphasis">{budget.totalPerPerson ? `≈ ${formatMoney(budget.totalPerPerson)}` : 'Pendiente'}</span>
  const item = budget.items.find((candidate) => candidate.category === category)
  const money = item ? budgetItemTotalMoney(item) : null
  return <span className="budget-compare">{money ? formatMoney(money) : 'Pendiente'}</span>
}

function MobileBudgetComparison({ plan }: { plan: TravelPlan }) {
  const { budget, loading } = useTravelBudget(plan)
  return <section className="mobile-budget"><h3><Coins aria-hidden="true" />Presupuesto completo estimado</h3>{loading ? <p>Calculando…</p> : <><dl>{budget.items.map((item) => { const money = budgetItemTotalMoney(item); return <div key={item.category}><dt>{mobileBudgetLabels[item.category]}</dt><dd>{money ? formatMoney(money) : 'Pendiente'}</dd></div> })}</dl><div className="mobile-budget-total"><span>Total</span><strong>{budget.total ? `≈ ${formatMoney(budget.total)}` : 'Pendiente'}</strong><span>Por persona</span><strong>{budget.totalPerPerson ? `≈ ${formatMoney(budget.totalPerPerson)}` : 'Pendiente'}</strong></div></>}</section>
}

const mobileBudgetLabels: Record<BudgetCategory, string> = { TOMORROWLAND: 'Tomorrowland', FLIGHT: 'Vuelo', LOCAL_TRANSPORT: 'Transporte', FOOD: 'Alimentación', PERSONAL_EXPENSES: 'Gastos personales' }

function PlanHeading({ plan, onRemove }: { plan: TravelPlan; onRemove: (id: string) => void }) {
  return <div className="compare-plan-heading"><span>{plan.name}</span><small>{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}</small><button type="button" onClick={() => onRemove(plan.id)} aria-label={`Quitar ${plan.name}`}><X aria-hidden="true" />Quitar</button></div>
}

function Row({ icon, label, plans, render }: { icon?: ReactNode; label: string; plans: TravelPlan[]; render: (plan: TravelPlan) => ReactNode }) {
  return <tr><th scope="row">{icon && <span aria-hidden="true">{icon}</span>}{label}</th>{plans.map((plan) => <td key={plan.id}>{render(plan)}</td>)}</tr>
}

function BooleanValue({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return <span className={value ? 'boolean-value positive' : 'boolean-value'}>{value ? <Check aria-hidden="true" /> : <CircleMinus aria-hidden="true" />}{value ? trueLabel : falseLabel}</span>
}

function ItemList({ items, positive = false }: { items: string[]; positive?: boolean }) {
  const Icon = positive ? Check : CircleMinus
  return <ul className="compare-list">{items.map((item) => <li key={item}><Icon aria-hidden="true" />{item}</li>)}</ul>
}

function CompareFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <dl className="compare-fact"><dt><span aria-hidden="true">{icon}</span>{label}</dt><dd>{value}</dd></dl>
}
