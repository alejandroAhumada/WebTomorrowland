import { createRoot } from 'react-dom/client'
import { PlanCard } from '../components/PlanCard'
import { PlanDetailDialog } from '../components/PlanDetailDialog'
import { defaultBudgetPreferences } from '../data/travelBudgetEstimates'
import { parseTravelPlan } from '../models/plan'
import { BudgetPreferencesProvider } from '../state/BudgetPreferencesContext'
import { MyTripProvider } from '../state/MyTripContext'
import { TripPreparationProvider } from '../state/TripPreparationContext'
import '../styles.css'
import { futurePlanFixtures } from './futurePlans'

const plan = parseTravelPlan('fixture-future-official-package-2027', futurePlanFixtures.NEW_PRODUCT_UNKNOWN_ACCOMMODATION)
const detail = new URLSearchParams(window.location.search).get('view') === 'detail'

createRoot(document.getElementById('root')!).render(
  <BudgetPreferencesProvider initialPreferences={defaultBudgetPreferences}>
    <TripPreparationProvider initialState={{ plans: {} }}>
      <MyTripProvider initialPlanId={null}>
        <main className="page-container">
          {detail
            ? <PlanDetailDialog plan={plan} onClose={() => undefined} />
            : <div className="plans-grid"><PlanCard plan={plan} selected={false} disabled={false} onToggle={() => undefined} onOpenDetails={() => undefined} /></div>}
        </main>
      </MyTripProvider>
    </TripPreparationProvider>
  </BudgetPreferencesProvider>,
)
