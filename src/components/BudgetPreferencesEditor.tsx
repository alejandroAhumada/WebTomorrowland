import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { budgetPreferenceLimits, validateBudgetPreference, type BudgetPreferenceKey } from '../models/budgetPreferences'
import { useBudgetPreferences } from '../state/useBudgetPreferences'
import { formatMoney } from '../utils/format'

const fields: Array<{ key: BudgetPreferenceKey; label: string; unit: string; money?: boolean }> = [
  { key: 'days', label: 'Días', unit: 'duración total' },
  { key: 'nights', label: 'Noches', unit: 'duración de alojamiento' },
  { key: 'flightPerPerson', label: 'Vuelo', unit: 'por persona', money: true },
  { key: 'accommodationPerNight', label: 'Alojamiento externo', unit: 'por habitación / noche', money: true },
  { key: 'localTransportPerGroup', label: 'Transporte local', unit: 'por grupo', money: true },
  { key: 'foodPerPersonPerDay', label: 'Alimentación', unit: 'por persona / día', money: true },
  { key: 'personalExpensesPerPerson', label: 'Gastos personales', unit: 'por persona', money: true },
]

export function BudgetPreferencesEditor() {
  const { preferences, customized, updatePreference, resetPreferences } = useBudgetPreferences()
  return <details className="budget-editor">
    <summary><span><SlidersHorizontal aria-hidden="true" /><strong>Ajustar mi presupuesto</strong></span>{customized && <em>Presupuesto personalizado</em>}</summary>
    <div className="budget-editor-content">
      <header><p>Estos ajustes se aplican a todas las alternativas en este dispositivo.</p><small>Tus valores se guardan solo en este navegador. Días y noches pueden configurarse de forma independiente.</small></header>
      <div className="budget-fields">{fields.map((field) => <PreferenceField key={field.key} preferenceKey={field.key} label={field.label} unit={field.unit} money={field.money} value={preferences[field.key]} onUpdate={updatePreference} />)}</div>
      <button className="text-button budget-reset" type="button" onClick={resetPreferences} disabled={!customized}><RotateCcw aria-hidden="true" />Restablecer estimaciones</button>
    </div>
  </details>
}

function PreferenceField({ preferenceKey, label, unit, money = false, value, onUpdate }: { preferenceKey: BudgetPreferenceKey; label: string; unit: string; money?: boolean; value: number; onUpdate: (key: BudgetPreferenceKey, value: number) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorId = `budget-${preferenceKey}-error`

  const changeValue = (next: string) => {
    setDraft(next)
    if (next.trim() === '') { setError('Este valor es obligatorio.'); return }
    const parsed = Number(next)
    const validation = validateBudgetPreference(preferenceKey, parsed)
    setError(validation)
    if (!validation) { onUpdate(preferenceKey, parsed); setDraft(null) }
  }

  return <label className="budget-field"><span><strong>{label}</strong><small>{unit}</small></span><input type="number" inputMode="numeric" min={budgetPreferenceLimits[preferenceKey].min} max={budgetPreferenceLimits[preferenceKey].max} step="1" value={draft ?? String(value)} onChange={(event) => changeValue(event.target.value)} onBlur={() => { if (error) { setDraft(null); setError(null) } }} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{money && !error && <output>{formatMoney({ amount: value, currency: 'CLP' })}</output>}{error && <small className="field-error" id={errorId}>{error}</small>}</label>
}
