import { ArrowRight, Check, CircleMinus, Columns3, Trash2, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PriceBadge } from '../components/PriceBadge'
import { usePlans } from '../hooks/usePlans'
import { useTicketTiers } from '../hooks/useTicketTiers'
import { useTravelBudget } from '../hooks/useTravelBudget'
import type { TravelPlan } from '../models/plan'
import { getPlanCatalogEntry, getPlanTierOptions } from '../models/planCatalog'
import { budgetItemTotalMoney, type BudgetCategory } from '../models/travelBudget'
import { useSelection } from '../state/useSelection'
import { formatMoney } from '../utils/format'

interface ComparisonRow { label: string; essential?: boolean; fullOnly?: boolean; differenceKey: (plan: TravelPlan) => string; render: (plan: TravelPlan) => ReactNode }

export function ComparePage() {
  const { selectedIds, toggle, clear } = useSelection()
  const { plans, loading, error } = usePlans(undefined, selectedIds)
  const { tiers } = useTicketTiers()
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(() => buildRows(tiers), [tiers])
  const visibleRows = rows.filter((row) => showAll || (!row.fullOnly && (row.essential || hasDifferences(plans, row))))

  if (selectedIds.length === 0) return <div className="page-container empty-state"><span className="empty-icon"><Columns3 aria-hidden="true" /></span><p className="eyebrow">Comparador</p><h1>Elige los planes que quieres mirar de cerca</h1><p>Selecciona hasta tres alternativas para contrastar precio, viaje estimado y diferencias importantes.</p><div><Link className="button" to="/planes/1-persona">Ver plan 1 persona <ArrowRight aria-hidden="true" /></Link><Link className="button secondary" to="/planes/2-personas">Ver plan 2 personas</Link></div></div>

  return <div className="page-container compare-page"><div className="page-heading"><div><p className="eyebrow">Comparador</p><h1><Columns3 aria-hidden="true" />{selectedIds.length} alternativas</h1><p>Primero mostramos lo que ayuda a decidir. Puedes abrir la comparación completa cuando lo necesites.</p></div><button className="text-button" type="button" onClick={clear}><Trash2 aria-hidden="true" />Limpiar selección</button></div>
    <div className="compare-view-toggle" role="group" aria-label="Contenido de la comparación"><button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>Solo diferencias</button><button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>Ver todo</button></div>
    {loading && <p className="notice">Preparando comparación…</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && <Comparison plans={plans} rows={visibleRows} onRemove={toggle} />}
  </div>
}

function Comparison({ plans, rows, onRemove }: { plans: TravelPlan[]; rows: ComparisonRow[]; onRemove: (id: string) => void }) {
  return <div className="comparison-shell">
    <div className="comparison-plan-headings" style={{ '--compare-count': plans.length } as CSSProperties}>{plans.map((plan) => <PlanHeading key={plan.id} plan={plan} onRemove={onRemove} />)}</div>
    <div className="comparison-attributes">{rows.map((row) => <section className="comparison-attribute" key={row.label}><h2>{row.label}</h2><div className="comparison-values" style={{ '--compare-count': plans.length } as CSSProperties}>{plans.map((plan) => <article key={plan.id}><h3>{plan.name}</h3><div>{row.render(plan)}</div></article>)}</div></section>)}</div>
  </div>
}

function buildRows(tiers: ReturnType<typeof useTicketTiers>['tiers']): ComparisonRow[] {
  return [
    { label: 'Viaje estimado por persona', essential: true, differenceKey: (plan) => plan.id, render: (plan) => <BudgetCompareValue plan={plan} field="perPerson" /> },
    { label: 'Precio Tomorrowland', essential: true, differenceKey: (plan) => plan.totalPrice ? `${plan.totalPrice.amount}` : 'pending', render: (plan) => <TomorrowlandComparePrice plan={plan} /> },
    { label: 'Alojamiento', essential: true, differenceKey: (plan) => `${plan.dreamVilleIncluded}:${plan.accommodation}`, render: (plan) => <><strong>{plan.dreamVilleIncluded ? 'Incluido' : 'No incluido'}</strong><small>{plan.accommodation}</small></> },
    { label: 'Modalidades disponibles', essential: true, differenceKey: (plan) => getPlanTierOptions(plan, tiers).map(({ tier }) => tier.id).join('|'), render: (plan) => getPlanTierOptions(plan, tiers).map(({ tier }) => tier.name).join(' · ') || 'Sin modalidades publicadas' },
    { label: 'Naturaleza del precio', essential: true, differenceKey: (plan) => `${getPlanCatalogEntry(plan.id)?.classification}:${plan.priceType}`, render: (plan) => <><PriceBadge type={plan.priceType} />{getPlanCatalogEntry(plan.id)?.classification === 'DERIVED_SCENARIO' && <small>Cálculo para 2 personas · no es un pack oficial 2P</small>}</> },
    { label: 'DreamVille', differenceKey: (plan) => String(plan.dreamVilleIncluded), render: (plan) => <BooleanValue value={plan.dreamVilleIncluded} trueLabel="Incluido" falseLabel="No incluido" /> },
    { label: 'Carpa o equipamiento', differenceKey: (plan) => plan.accommodation, render: (plan) => plan.accommodation },
    { label: 'Transporte incluido en el producto', differenceKey: (plan) => plan.transport, render: (plan) => plan.transport },
    { label: 'Festival / entrada', differenceKey: (plan) => plan.festivalPass, render: (plan) => plan.festivalPass },
    { label: 'Viaje estimado total', differenceKey: (plan) => plan.id, render: (plan) => <BudgetCompareValue plan={plan} field="total" /> },
    { label: 'Vuelo estimado', fullOnly: true, differenceKey: (plan) => String(plan.travelerCount), render: (plan) => <BudgetCompareValue plan={plan} category="FLIGHT" /> },
    { label: 'Alojamiento externo estimado', differenceKey: (plan) => String(plan.dreamVilleIncluded), render: (plan) => <BudgetCompareValue plan={plan} category="EXTERNAL_ACCOMMODATION" /> },
    { label: 'Transporte local estimado', fullOnly: true, differenceKey: () => 'same', render: (plan) => <BudgetCompareValue plan={plan} category="LOCAL_TRANSPORT" /> },
    { label: 'Alimentación estimada', fullOnly: true, differenceKey: (plan) => String(plan.travelerCount), render: (plan) => <BudgetCompareValue plan={plan} category="FOOD" /> },
    { label: 'Gastos personales estimados', fullOnly: true, differenceKey: (plan) => String(plan.travelerCount), render: (plan) => <BudgetCompareValue plan={plan} category="PERSONAL_EXPENSES" /> },
    { label: 'Incluye', fullOnly: true, differenceKey: (plan) => plan.inclusions.join('|'), render: (plan) => <ItemList items={plan.inclusions} positive /> },
    { label: 'No incluye', fullOnly: true, differenceKey: (plan) => plan.notIncluded.join('|'), render: (plan) => plan.notIncluded.length ? <ItemList items={plan.notIncluded} /> : 'Sin exclusiones informadas' },
  ]
}

function hasDifferences(plans: TravelPlan[], row: ComparisonRow) { return new Set(plans.map(row.differenceKey)).size > 1 }

function TomorrowlandComparePrice({ plan }: { plan: TravelPlan }) {
  const { budget, loading } = useTravelBudget(plan)
  const item = budget.items.find((candidate) => candidate.category === 'TOMORROWLAND')
  const clp = item ? budgetItemTotalMoney(item) : null
  if (!plan.totalPrice) return <strong>Precio aún no publicado</strong>
  return <div className="compare-decision-price"><strong>{loading ? 'Calculando CLP…' : clp ? `≈ ${formatMoney(clp)} CLP` : 'Equivalencia CLP no disponible'}</strong><span>{formatMoney(plan.totalPrice)} · {getPlanCatalogEntry(plan.id)?.classification === 'DERIVED_SCENARIO' ? 'cálculo para 2 personas' : 'precio oficial Tomorrowland'}</span></div>
}

export function BudgetCompareValue({ plan, field, category }: { plan: TravelPlan; field?: 'total' | 'perPerson'; category?: BudgetCategory }) {
  const { budget, loading } = useTravelBudget(plan)
  if (loading) return <span className="budget-compare muted">Calculando…</span>
  if (field === 'total') return <span className="budget-compare">{budget.total ? `≈ ${formatMoney(budget.total)}` : 'Pendiente del precio Tomorrowland'}</span>
  if (field === 'perPerson') return <span className="budget-compare emphasis">{budget.totalPerPerson ? `≈ ${formatMoney(budget.totalPerPerson)}` : 'Pendiente'}</span>
  const item = budget.items.find((candidate) => candidate.category === category)
  if (category === 'EXTERNAL_ACCOMMODATION' && budget.accommodationIncluded) return <span className="budget-compare positive">Incluido</span>
  const money = item ? budgetItemTotalMoney(item) : null
  return <span className="budget-compare">{money ? formatMoney(money) : 'Pendiente'}</span>
}

function PlanHeading({ plan, onRemove }: { plan: TravelPlan; onRemove: (id: string) => void }) {
  return <article className="compare-plan-heading"><span>{plan.name}</span><small>{plan.travelerCount} {plan.travelerCount === 1 ? 'persona' : 'personas'}</small><button type="button" onClick={() => onRemove(plan.id)} aria-label={`Quitar ${plan.name}`}><X aria-hidden="true" />Quitar</button></article>
}

function BooleanValue({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return <span className={value ? 'boolean-value positive' : 'boolean-value'}>{value ? <Check aria-hidden="true" /> : <CircleMinus aria-hidden="true" />}{value ? trueLabel : falseLabel}</span>
}

function ItemList({ items, positive = false }: { items: string[]; positive?: boolean }) {
  const Icon = positive ? Check : CircleMinus
  return <ul className="compare-list">{items.map((item) => <li key={item}><Icon aria-hidden="true" />{item}</li>)}</ul>
}
