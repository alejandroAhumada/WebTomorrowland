import { Bus, CircleHelp, Coins, Plane, ReceiptText, Utensils, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TravelBudget, BudgetCategory } from '../models/travelBudget'
import { budgetItemTotalMoney } from '../models/travelBudget'
import { formatDate, formatMoney } from '../utils/format'

const budgetCategoryLabels: Record<BudgetCategory, string> = {
  TOMORROWLAND: 'Tomorrowland',
  FLIGHT: 'Vuelo',
  LOCAL_TRANSPORT: 'Transporte local',
  FOOD: 'Alimentación',
  PERSONAL_EXPENSES: 'Gastos personales',
}

const budgetIcons: Record<BudgetCategory, LucideIcon> = {
  TOMORROWLAND: ReceiptText,
  FLIGHT: Plane,
  LOCAL_TRANSPORT: Bus,
  FOOD: Utensils,
  PERSONAL_EXPENSES: WalletCards,
}

export function TravelBudgetSummary({ budget, loading = false }: { budget: TravelBudget; loading?: boolean }) {
  if (loading) return <div className="budget-summary compact"><span>Presupuesto completo estimado</span><strong>Calculando…</strong></div>
  if (!budget.totalPerPerson) return <div className="budget-summary compact pending"><span>Presupuesto completo estimado</span><strong>{budget.pendingReason === 'PLAN_PRICE' ? 'Disponible al publicarse el precio' : budget.pendingReason === 'CONVERSION' ? 'Conversión CLP no disponible' : 'Falta una estimación'}</strong></div>
  return <div className="budget-summary compact"><span>Presupuesto completo estimado</span><strong>≈ {formatMoney(budget.totalPerPerson)} <small>por persona</small></strong></div>
}

export function TravelBudgetBreakdown({ budget, loading = false }: { budget: TravelBudget; loading?: boolean }) {
  return <section className="budget-breakdown" aria-labelledby={`budget-${budget.planId}`}>
    <div className="budget-title"><div><p className="eyebrow"><Coins aria-hidden="true" />Estimación</p><h3 id={`budget-${budget.planId}`}>Presupuesto completo del viaje</h3></div><span>Valores referenciales en CLP</span></div>
    <ul>{budget.items.map((item) => {
      const Icon = budgetIcons[item.category]
      const total = budgetItemTotalMoney(item)
      return <li key={item.category}><span className="budget-item-icon"><Icon aria-hidden="true" /></span><div><strong>{budgetCategoryLabels[item.category]}</strong><small>{item.description} · {item.scope === 'PER_PERSON' ? 'por persona' : 'por grupo'} · actualizado {formatDate(item.updatedAt)}</small>{item.category === 'TOMORROWLAND' && item.originalPriceType && <em>Precio original {item.originalPriceType === 'OFFICIAL' ? 'oficial' : 'estimado'}; conversión CLP referencial.</em>}</div><b>{total ? formatMoney(total) : 'Pendiente'}</b></li>
    })}</ul>
    {loading ? <div className="budget-pending"><CircleHelp aria-hidden="true" /><p><strong>Calculando presupuesto</strong>Estamos obteniendo la conversión CLP referencial.</p></div> : budget.total && budget.totalPerPerson ? <div className="budget-totals"><div><span>Total aproximado</span><strong>{formatMoney(budget.total)}</strong></div><div><span>Aprox. por persona</span><strong>{formatMoney(budget.totalPerPerson)}</strong></div></div> : <div className="budget-pending"><CircleHelp aria-hidden="true" /><p><strong>Total pendiente</strong>{pendingBudgetMessage(budget)}</p></div>}
    <p className="budget-disclaimer">Este presupuesto es una estimación independiente para planificación. No representa un precio publicado por Tomorrowland.</p>
  </section>
}

function pendingBudgetMessage(budget: TravelBudget): string {
  if (budget.pendingReason === 'PLAN_PRICE') return 'El presupuesto total estará disponible cuando Tomorrowland publique el precio del paquete.'
  if (budget.pendingReason === 'CONVERSION') return 'El precio original está disponible, pero falta la conversión referencial a CLP.'
  return 'El total estará disponible cuando todos los componentes tengan una estimación.'
}
