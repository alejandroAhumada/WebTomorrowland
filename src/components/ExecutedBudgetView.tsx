import { CircleHelp, ReceiptText } from 'lucide-react'
import type { ExecutedTravelBudget } from '../models/executedTravelBudget'
import { formatMoney } from '../utils/format'

export function ExecutedBudgetSummary({ executed }: { executed: ExecutedTravelBudget }) {
  if (!executed.actualPaid) return <div className="executed-budget empty"><p>Presupuesto ejecutado</p><strong>Sin gastos registrados</strong><small>La estimación original se mantiene como referencia.</small></div>
  return <div className="executed-budget">
    <p>Presupuesto del viaje</p>
    <div className="executed-budget-grid">
      {executed.estimatedTotal && <Metric label="Estimado" value={formatMoney(executed.estimatedTotal)} />}
      <Metric label="Pagado" value={formatMoney(executed.actualPaid)} />
      {executed.actualPaidPerPerson && executed.actualPaidPerPerson.amount !== executed.actualPaid.amount && <Metric label="Pagado por persona" value={formatMoney(executed.actualPaidPerPerson)} />}
      {executed.projectedTotal && <>
        <Metric label="Proyección actual" value={formatMoney(executed.projectedTotal)} />
        <Metric label="Pendiente proyectado" value={formatMoney(executed.remainingProjected!)} />
        <Metric label="Proyección por persona" value={formatMoney(executed.projectedTotalPerPerson!)} />
      </>}
    </div>
    {executed.projectedDelta && <small>{globalDeltaLabel(executed.projectedDelta.amount)}</small>}
    {!executed.projectedTotal && <small>Presupuesto total pendiente del precio oficial o de la conversión CLP.</small>}
  </div>
}

export function ExecutedBudgetBreakdown({ executed }: { executed: ExecutedTravelBudget }) {
  if (!executed.actualPaid) return null
  return <section className="executed-breakdown" aria-labelledby="executed-budget-title">
    <header><ReceiptText aria-hidden="true" /><div><p className="eyebrow">Gastos declarados</p><h3 id="executed-budget-title">Ejecución del presupuesto</h3></div></header>
    <div className="executed-budget-grid">
      {executed.estimatedTotal && <Metric label="Estimación original" value={formatMoney(executed.estimatedTotal)} />}
      <Metric label="Pagado registrado" value={formatMoney(executed.actualPaid)} />
      {executed.actualPaidPerPerson && executed.actualPaidPerPerson.amount !== executed.actualPaid.amount && <Metric label="Pagado por persona" value={formatMoney(executed.actualPaidPerPerson)} />}
      {executed.projectedTotal ? <>
        <Metric label="Proyección actual" value={formatMoney(executed.projectedTotal)} />
        <Metric label="Pendiente proyectado" value={formatMoney(executed.remainingProjected!)} />
      </> : <div className="executed-pending"><CircleHelp aria-hidden="true" />La proyección completa estará disponible cuando exista presupuesto total.</div>}
    </div>
    <p>Los gastos reales fueron registrados localmente por ti y no reemplazan precios oficiales ni estimaciones.</p>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }

function globalDeltaLabel(amount: number): string {
  if (amount === 0) return 'Sin variación respecto de la estimación inicial.'
  return `Proyección ${formatMoney({ amount: Math.abs(amount), currency: 'CLP' })} ${amount < 0 ? 'bajo' : 'sobre'} la estimación inicial.`
}
