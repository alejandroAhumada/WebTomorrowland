import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { initialTravelBudgetEstimates } from '../data/travelBudgetEstimates'
import { demoPlans } from '../data/demoPlans'
import { productionPlans } from '../../scripts/productionPlans'
import { createTravelBudget } from '../models/travelBudget'
import { BudgetCompareValue } from '../pages/ComparePage'
import { PlanCard } from './PlanCard'
import { PlanDetailDialog } from './PlanDetailDialog'
import { TravelBudgetBreakdown, TravelBudgetSummary } from './TravelBudgetView'

const plan = demoPlans.find((item) => item.travelerCount === 1)!
const budget = createTravelBudget(plan, initialTravelBudgetEstimates)

describe('representación del presupuesto', () => {
  it('la card muestra solo el resumen y mantiene Comparar independiente', () => {
    const markup = renderToStaticMarkup(<PlanCard plan={plan} selected={false} disabled={false} onToggle={() => undefined} onOpenDetails={() => undefined} />)
    expect(markup).toContain('Presupuesto completo estimado')
    expect(markup).toContain('Ver detalles')
    expect(markup).toContain('Comparar')
    expect(markup).not.toContain('Gastos personales</strong>')
  })

  it('el detalle presenta desglose, total, inclusiones y cierre accesible', () => {
    const markup = renderToStaticMarkup(<PlanDetailDialog plan={plan} onClose={() => undefined} />)
    expect(markup).toContain('Presupuesto completo del viaje')
    expect(markup).toContain('Gastos personales')
    expect(markup).toContain('Total aproximado')
    expect(markup).toContain('aria-label="Cerrar detalle"')
  })

  it('el comparador presenta total y por persona', () => {
    expect(renderToStaticMarkup(<BudgetCompareValue plan={plan} field="total" />)).toContain('3.300.000')
    expect(renderToStaticMarkup(<BudgetCompareValue plan={plan} field="perPerson" />)).toContain('3.300.000')
  })

  it('el detalle explica días/noches y el comparador distingue alojamiento incluido', () => {
    const separatePlan = demoPlans.find((item) => item.category === 'SEPARATE_PURCHASE')!
    expect(renderToStaticMarkup(<TravelBudgetBreakdown budget={createTravelBudget(separatePlan, initialTravelBudgetEstimates)} />)).toContain('4 noches')
    expect(renderToStaticMarkup(<TravelBudgetBreakdown budget={createTravelBudget(separatePlan, initialTravelBudgetEstimates)} />)).toContain('5 días')
    expect(renderToStaticMarkup(<BudgetCompareValue plan={plan} category="EXTERNAL_ACCOMMODATION" />)).toContain('Incluido')
    const fullMadness = { ...productionPlans.find((item) => item.id === 'full-madness-2p-2027')!, totalPrice: { amount: 1125023, currency: 'CLP' as const } }
    expect(renderToStaticMarkup(<BudgetCompareValue plan={fullMadness} category="EXTERNAL_ACCOMMODATION" />)).toContain('280.000')
  })

  it('presenta explícitamente PENDING sin total', () => {
    const pendingBudget = createTravelBudget({ ...plan, totalPrice: null, priceType: null }, initialTravelBudgetEstimates)
    expect(renderToStaticMarkup(<TravelBudgetSummary budget={pendingBudget} />)).toContain('Disponible al publicarse')
    expect(renderToStaticMarkup(<TravelBudgetBreakdown budget={pendingBudget} />)).toContain('El presupuesto total estará disponible')
  })

  it('no identifica el total del viaje como precio oficial', () => {
    const markup = renderToStaticMarkup(<TravelBudgetBreakdown budget={budget} />)
    expect(markup).toContain('estimación independiente')
    expect(markup).not.toContain('Total oficial')
  })
})
