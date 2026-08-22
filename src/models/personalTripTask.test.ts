import { describe, expect, it } from 'vitest'
import { productionPlans } from '../../scripts/productionPlans'
import { buildPersonalTripTasks, personalTripTaskDefinitions } from './personalTripTask'

const plan = (id: string) => productionPlans.find((item) => item.id === id)!

describe('tareas personales del viaje', () => {
  it('mantiene IDs y orden lógico estables', () => {
    expect(personalTripTaskDefinitions.map((task) => task.id)).toEqual(['documentation', 'flight', 'external-accommodation', 'travel-insurance', 'local-transport', 'payment-method', 'luggage', 'flight-check-in'])
  })

  it('incluye las tareas globales y vuelo para todos los planes actuales', () => {
    const tasks = buildPersonalTripTasks(plan('global-journey-hotel-1p-2027'))
    expect(tasks.map((task) => task.id)).toEqual(['documentation', 'flight', 'travel-insurance', 'local-transport', 'payment-method', 'luggage', 'flight-check-in'])
  })

  it.each(['full-madness-1p-2027', 'full-madness-2p-2027'])('%s requiere alojamiento externo', (id) => {
    expect(buildPersonalTripTasks(plan(id)).some((task) => task.type === 'EXTERNAL_ACCOMMODATION')).toBe(true)
  })

  it.each(['easy-tent-2p-2027', 'vida-nova-2p-2027', 'spectacular-easy-tent-2p-2027', 'global-journey-hotel-1p-2027', 'global-journey-hotel-2p-2027'])('%s no duplica alojamiento', (id) => {
    expect(buildPersonalTripTasks(plan(id)).some((task) => task.type === 'EXTERNAL_ACCOMMODATION')).toBe(false)
  })

  it('PENDING no modifica aplicabilidad y no muta el plan', () => {
    const pending = plan('global-journey-hotel-1p-2027')
    const snapshot = structuredClone(pending)
    expect(buildPersonalTripTasks(pending).map((task) => task.id)).toContain('flight')
    expect(pending).toEqual(snapshot)
  })
})
