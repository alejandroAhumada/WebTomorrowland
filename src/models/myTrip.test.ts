import { describe, expect, it } from 'vitest'
import { demoPlans } from '../data/demoPlans'
import { clearMyTrip, legacyMyTripStorageKey, myTripFromStorageChange, myTripStorageKey, parseMyTrip, persistMyTrip, readMyTrip, resolveSelectedPlan, selectMyTrip, serializeMyTrip, setConsideredTier } from './myTrip'

describe('estado local de Mi viaje', () => {
  it('parte sin selección, permite seleccionar, reemplazar y quitar', () => {
    const empty = clearMyTrip()
    const selected = selectMyTrip(empty, 'easy-tent-2p-2027')
    expect(empty.selectedPlanId).toBeNull()
    expect(selected.selectedPlanId).toBe('easy-tent-2p-2027')
    expect(selectMyTrip(selected, 'vida-nova-2p-2027').selectedPlanId).toBe('vida-nova-2p-2027')
    expect(clearMyTrip().selectedPlanId).toBeNull()
  })

  it('persiste solo versión e ID, nunca un snapshot del plan', () => {
    const serialized = serializeMyTrip('easy-tent-2p-2027')
    expect(JSON.parse(serialized)).toEqual({ version: 2, selectedPlanId: 'easy-tent-2p-2027', consideredTierByPlan: {} })
    expect(serialized).not.toContain('totalPrice')
  })

  it('ignora JSON corrupto, versión desconocida e IDs inválidos', () => {
    expect(parseMyTrip('{oops').selectedPlanId).toBeNull()
    expect(parseMyTrip(JSON.stringify({ version: 3, selectedPlanId: 'valid-id' })).selectedPlanId).toBeNull()
    expect(parseMyTrip(JSON.stringify({ version: 2, selectedPlanId: '../invalid' })).selectedPlanId).toBeNull()
    expect(parseMyTrip(JSON.stringify({ version: 2, selectedPlanId: 'a'.repeat(101) })).selectedPlanId).toBeNull()
  })

  it('migra v1 sin perder el plan y persiste una modalidad mínima por plan', () => {
    const storage = { getItem: (key: string) => key === legacyMyTripStorageKey ? JSON.stringify({ version: 1, selectedPlanId: 'easy-tent-2p-2027' }) : null }
    const migrated = readMyTrip(storage)
    const withTier = setConsideredTier(migrated, migrated.selectedPlanId!, 'comfort')
    expect(migrated).toEqual({ selectedPlanId: 'easy-tent-2p-2027', consideredTierByPlan: {} })
    expect(withTier.consideredTierByPlan).toEqual({ 'easy-tent-2p-2027': 'comfort' })
    expect(JSON.parse(serializeMyTrip(withTier))).not.toHaveProperty('price')
  })

  it('sobrevive reload leyendo el mismo ID versionado', () => {
    const storage = { getItem: () => serializeMyTrip('easy-tent-2p-2027') }
    expect(readMyTrip(storage).selectedPlanId).toBe('easy-tent-2p-2027')
  })

  it('funciona en memoria si localStorage está bloqueado', () => {
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    expect(readMyTrip(blocked).selectedPlanId).toBeNull()
    expect(persistMyTrip(blocked, 'easy-tent-2p-2027')).toBe(false)
    expect(selectMyTrip(clearMyTrip(), 'easy-tent-2p-2027').selectedPlanId).toBe('easy-tent-2p-2027')
  })

  it('sincroniza otras pestañas y solo escucha su key', () => {
    expect(myTripFromStorageChange(myTripStorageKey, serializeMyTrip('vida-nova-2p-2027'))?.selectedPlanId).toBe('vida-nova-2p-2027')
    expect(myTripFromStorageChange(myTripStorageKey, null)?.selectedPlanId).toBeNull()
    expect(myTripFromStorageChange(legacyMyTripStorageKey, null)).toBeNull()
    expect(myTripFromStorageChange('otra:key', null)).toBeNull()
  })

  it('resuelve siempre contra planes actuales y descarta uno inexistente', () => {
    const current = demoPlans[0]
    expect(resolveSelectedPlan(current.id, demoPlans)).toBe(current)
    expect(resolveSelectedPlan('removed-plan', demoPlans)).toBeNull()
  })

  it('refleja cambios remotos sin cambiar la selección persistida', () => {
    const original = demoPlans[0]
    const updated = { ...original, totalPrice: { amount: 999999, currency: 'CLP' as const } }
    expect(resolveSelectedPlan(original.id, [updated])?.totalPrice?.amount).toBe(999999)
    expect(parseMyTrip(serializeMyTrip(original.id)).selectedPlanId).toBe(original.id)
  })
})
