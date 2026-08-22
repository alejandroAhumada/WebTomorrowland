import { BedDouble, Bus, Check, CreditCard, FileText, Luggage, Plane, PlaneTakeoff, RotateCcw, ShieldCheck, type LucideIcon } from 'lucide-react'
import { buildPersonalTripTasks, type PersonalTripTaskType } from '../models/personalTripTask'
import type { TravelPlan } from '../models/plan'
import { useTripPreparation } from '../state/useTripPreparation'

const taskIcons: Record<PersonalTripTaskType, LucideIcon> = {
  DOCUMENTATION: FileText,
  FLIGHT: Plane,
  EXTERNAL_ACCOMMODATION: BedDouble,
  TRAVEL_INSURANCE: ShieldCheck,
  LOCAL_TRANSPORT: Bus,
  PAYMENT_METHOD: CreditCard,
  LUGGAGE: Luggage,
  FLIGHT_CHECK_IN: PlaneTakeoff,
}

export function PersonalTripPreparation({ plan }: { plan: TravelPlan }) {
  const tasks = buildPersonalTripTasks(plan)
  const { getProgress, setCompleted, resetPlan } = useTripPreparation()
  const completed = tasks.filter((task) => getProgress(plan.id, task.id)?.completed).length
  const percentage = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)
  const allCompleted = tasks.length > 0 && completed === tasks.length

  return <section className="trip-preparation" aria-labelledby="trip-preparation-title"><header><div><p>Tu organización personal</p><h3 id="trip-preparation-title">Mi preparación</h3></div><div className="preparation-summary"><strong>{allCompleted ? 'Preparación completada' : `${completed} de ${tasks.length} completados`}</strong><span>{percentage}%</span></div></header><div className="preparation-progress" role="progressbar" aria-label="Progreso de preparación del viaje" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={completed} aria-valuetext={`${completed} de ${tasks.length} preparativos completados`}><span style={{ width: `${percentage}%` }} /></div><ul>{tasks.map((task) => {
    const progress = getProgress(plan.id, task.id)
    const Icon = taskIcons[task.type]
    return <li key={task.id} className={progress ? 'completed' : ''}><label><input type="checkbox" checked={Boolean(progress)} onChange={(event) => setCompleted(plan.id, task.id, event.currentTarget.checked)} /><span className="preparation-check"><Check aria-hidden="true" /></span><span className="preparation-icon"><Icon aria-hidden="true" /></span><span className="preparation-copy"><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</span><em>{progress ? 'Completada' : 'Pendiente'}</em></label></li>
  })}</ul>{completed > 0 && <button className="text-button preparation-reset" type="button" onClick={() => resetPlan(plan.id)}><RotateCcw aria-hidden="true" />Restablecer preparación</button>}<p className="preparation-note">Estos preparativos son personales, se guardan solo en este navegador y no forman parte de la información oficial de Tomorrowland.</p></section>
}
