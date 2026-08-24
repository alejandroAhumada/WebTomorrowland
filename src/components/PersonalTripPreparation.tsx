import { BedDouble, Bus, Check, CreditCard, FileText, Luggage, Pencil, Plane, PlaneTakeoff, ReceiptText, RotateCcw, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getTaskEstimatedExpense } from '../models/executedTravelBudget'
import { buildPersonalTripTasks, type PersonalTripTaskDefinition, type PersonalTripTaskType } from '../models/personalTripTask'
import type { TravelPlan } from '../models/plan'
import { isValidExpenseAmount, isValidPurchasedAt, maximumActualExpenseClp, type PersonalTripTaskProgress } from '../models/tripPreparation'
import type { TravelBudget } from '../models/travelBudget'
import { useTripPreparation } from '../state/useTripPreparation'
import { formatDate, formatMoney } from '../utils/format'

const taskIcons: Record<PersonalTripTaskType, LucideIcon> = { DOCUMENTATION: FileText, FLIGHT: Plane, EXTERNAL_ACCOMMODATION: BedDouble, TRAVEL_INSURANCE: ShieldCheck, LOCAL_TRANSPORT: Bus, PAYMENT_METHOD: CreditCard, LUGGAGE: Luggage, FLIGHT_CHECK_IN: PlaneTakeoff }

export function PersonalTripPreparation({ plan, budget }: { plan: TravelPlan; budget: TravelBudget }) {
  const tasks = buildPersonalTripTasks(plan)
  const preparation = useTripPreparation()
  const completed = tasks.filter((task) => preparation.getProgress(plan.id, task.id)?.completed).length
  const percentage = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)
  const allCompleted = tasks.length > 0 && completed === tasks.length
  const hasProgress = Object.keys(preparation.state.plans[plan.id] ?? {}).length > 0

  return <section className="trip-preparation" aria-labelledby="trip-preparation-title"><details><summary><span><small>Tu organización personal</small><h3 id="trip-preparation-title">Mi preparación</h3></span><span className="preparation-summary"><strong>{allCompleted ? 'Preparación completada' : `${completed} de ${tasks.length} completados`}</strong><em>{percentage}%</em></span></summary><div className="preparation-content"><div className="preparation-progress" role="progressbar" aria-label="Progreso de preparación del viaje" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={completed} aria-valuetext={`${completed} de ${tasks.length} preparativos completados`}><span style={{ width: `${percentage}%` }} /></div><ul>{tasks.map((task) => <PreparationTask key={task.id} task={task} plan={plan} budget={budget} progress={preparation.getProgress(plan.id, task.id)} onCompleted={(value) => preparation.setCompleted(plan.id, task.id, value)} onExpense={(amount, date) => preparation.setExpense(plan.id, task.id, amount, date)} onRemoveExpense={() => preparation.removeExpense(plan.id, task.id)} />)}</ul>{hasProgress && <button className="text-button preparation-reset" type="button" onClick={() => preparation.resetPlan(plan.id)}><RotateCcw aria-hidden="true" />Restablecer preparación</button>}<p className="preparation-note">Estos preparativos y gastos son personales, se guardan solo en este navegador y no forman parte de la información oficial de Tomorrowland.</p></div></details></section>
}

function PreparationTask({ task, plan, budget, progress, onCompleted, onExpense, onRemoveExpense }: { task: PersonalTripTaskDefinition; plan: TravelPlan; budget: TravelBudget; progress: PersonalTripTaskProgress | null; onCompleted: (value: boolean) => void; onExpense: (amount: number, date?: string) => void; onRemoveExpense: () => void }) {
  const [editing, setEditing] = useState(false)
  const Icon = taskIcons[task.type]
  const estimate = getTaskEstimatedExpense(task.id, budget)
  const expense = progress?.actualExpense
  const actualGroup = expense ? expense.amount * (expense.scope === 'PER_PERSON' ? plan.travelerCount : 1) : null
  const delta = actualGroup !== null && estimate !== null ? actualGroup - estimate : null
  return <li className={progress?.completed ? 'completed' : ''}><div className="preparation-task-row"><label><input type="checkbox" checked={Boolean(progress?.completed)} onChange={(event) => onCompleted(event.currentTarget.checked)} /><span className="preparation-check"><Check aria-hidden="true" /></span><span className="preparation-icon"><Icon aria-hidden="true" /></span><span className="preparation-copy"><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</span><em>{progress?.completed ? 'Completada' : 'Pendiente'}</em></label>{task.expenseTracking !== 'NONE' && <div className="task-expense"><div>{estimate !== null ? <small>Estimación: {formatMoney({ amount: task.expenseTracking === 'PER_PERSON' ? estimate / plan.travelerCount : estimate, currency: 'CLP' })} {scopeLabel(task.expenseTracking)}</small> : <small>Estimación: no incluida en el presupuesto referencial</small>}{expense ? <><strong>Pagado: {formatMoney({ amount: expense.amount, currency: 'CLP' })} {scopeLabel(expense.scope)}</strong>{progress?.purchasedAt && <small>{formatDate(progress.purchasedAt)}</small>}{delta !== null && <small>{deltaLabel(delta)}</small>}</> : <small>Gasto no registrado</small>}</div><button className="text-button" type="button" onClick={() => setEditing((value) => !value)}><Pencil aria-hidden="true" />{expense ? 'Editar gasto' : 'Registrar gasto'}</button>{expense && <button className="text-button danger" type="button" onClick={onRemoveExpense}><Trash2 aria-hidden="true" />Eliminar gasto</button>}</div>}</div>{editing && <ExpenseForm task={task} progress={progress} onCancel={() => setEditing(false)} onSave={(amount, date) => { onExpense(amount, date); setEditing(false) }} />}</li>
}

function ExpenseForm({ task, progress, onSave, onCancel }: { task: PersonalTripTaskDefinition; progress: PersonalTripTaskProgress | null; onSave: (amount: number, date?: string) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState(progress?.actualExpense?.amount.toString() ?? '')
  const [date, setDate] = useState(progress?.purchasedAt ?? '')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = Number(amount)
    if (amount.trim() === '' || !isValidExpenseAmount(parsed)) return setError(`Ingresa un monto entero entre $0 y $${maximumActualExpenseClp.toLocaleString('es-CL')}.`)
    if (date && !isValidPurchasedAt(date)) return setError('Ingresa una fecha válida que no sea futura.')
    onSave(parsed, date || undefined)
  }
  return <form className="expense-form" onSubmit={submit}><div><label htmlFor={`expense-${task.id}`}>Monto pagado en CLP</label><input id={`expense-${task.id}`} type="number" inputMode="numeric" min="0" max={maximumActualExpenseClp} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><div><label htmlFor={`date-${task.id}`}>Fecha de pago <small>(opcional)</small></label><input id={`date-${task.id}`} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><p>Se considera {scopeLabel(task.expenseTracking)}.</p>{error && <p className="field-error" role="alert">{error}</p>}<div><button className="button" type="submit"><ReceiptText aria-hidden="true" />{progress?.actualExpense ? 'Guardar cambios' : 'Guardar gasto'}</button><button className="text-button" type="button" onClick={onCancel}>Cancelar</button></div></form>
}

function scopeLabel(scope: string): string { return scope === 'PER_PERSON' ? 'por persona' : 'para el grupo' }
function deltaLabel(delta: number): string { return delta === 0 ? 'Coincide con la estimación' : `${formatMoney({ amount: Math.abs(delta), currency: 'CLP' })} ${delta < 0 ? 'bajo' : 'sobre'} la estimación` }
