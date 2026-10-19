import { describe, expect, it } from 'vitest'
import { createCharacter, WeaponSchema } from '../../model/character'
import { addSpares, AMMO_BY_ID, ammoPrice, damageWith, loadedType, pricePer10, reload, stopCounting } from './ammo'

const predator = WeaponSchema.parse({
  id: 'w1',
  name: 'Ares Predator VI',
  specialization: 'Heavy Pistols',
  ammo: '15(c)',
})
const withLoaded = (rounds: number) => {
  const c = createCharacter()
  return { ...c, weapons: [predator], play: { ...c.play, ammo: { w1: rounds } } }
}

describe('ammo', () => {
  it('prices rounds by gun class and type (p. 262)', () => {
    expect(pricePer10(predator)).toBe(10)
    expect(pricePer10({ name: 'Fichetti Tiffani', specialization: 'Light Pistols' })).toBe(5)
    expect(pricePer10({ name: 'Barret Model 122', specialization: 'Sniper Rifles' })).toBe(20)
    expect(ammoPrice(predator, AMMO_BY_ID.get('apds')!, 30)).toBe(90)
    expect(ammoPrice(predator, AMMO_BY_ID.get('gel')!, 10)).toBe(15)
  })

  it('changes damage by type', () => {
    expect(damageWith({ value: 3, type: 'P' }, AMMO_BY_ID.get('explosive')!)).toEqual({ value: 4, type: 'P' })
    expect(damageWith({ value: 3, type: 'P' }, AMMO_BY_ID.get('gel')!)).toEqual({ value: 3, type: 'S' })
  })

  it('reloads for free when spare rounds are not counted', () => {
    const c = reload(withLoaded(2), predator, 15)
    expect(c.play.ammo.w1).toBe(15)
    expect(c.play.spareAmmo.w1).toBeUndefined()
  })

  it('tops up from spare rounds of the same type', () => {
    const c = reload(addSpares(withLoaded(5), 'w1', 'regular', 4), predator, 15)
    expect(c.play.ammo.w1).toBe(9)
    expect(c.play.spareAmmo.w1).toEqual({})
  })

  it('switching type puts the old rounds back in the box', () => {
    let c = addSpares(withLoaded(5), 'w1', 'apds', 20)
    c = reload(c, predator, 15, 'apds')
    expect(c.play.ammo.w1).toBe(15)
    expect(loadedType(c, predator).id).toBe('apds')
    expect(c.play.spareAmmo.w1).toEqual({ regular: 5, apds: 5 })
    expect(stopCounting(c, 'w1').play.spareAmmo.w1).toBeUndefined()
  })
})
