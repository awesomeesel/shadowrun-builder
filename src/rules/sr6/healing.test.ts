import { describe, expect, it } from 'vitest'
import { createCharacter, type Character } from '../../model/character'
import { heal, rest, spendHealing, treatmentThreshold } from './healing'

/** Dice values in order, as a random source. */
const dice = (...values: number[]) => {
  let i = 0
  return () => (values[i++ % values.length] - 1) / 6
}

function patient(damage: Partial<Character['damage']>): Character {
  const c = createCharacter({ attributes: { ...createCharacter().attributes, body: 4, willpower: 3 } })
  return { ...c, damage: { ...c.damage, ...damage } }
}

describe('treatment (pp. 119–120)', () => {
  it('sets the threshold at 5 − Essence, with a free hit for natural patients', () => {
    expect(treatmentThreshold(6)).toEqual({ threshold: 0, freeHit: true })
    expect(treatmentThreshold(3)).toEqual({ threshold: 2, freeHit: false })
    expect(treatmentThreshold(3.6)).toEqual({ threshold: 2, freeHit: false })
  })

  it('heals Overflow first, then the preferred track', () => {
    const damage = { overflow: 1, physical: 4, stun: 3 }
    expect(spendHealing(damage, 4, 'medkit')).toEqual({ overflow: 1, physical: 3, stun: 0 })
    expect(spendHealing(damage, 4, 'magic', 'stun')).toEqual({ overflow: 1, physical: 0, stun: 3 })
  })

  it('makes first aid cost 2 hits per Physical box but 1 per Stun box', () => {
    expect(spendHealing({ overflow: 0, physical: 4, stun: 3 }, 5, 'firstAid')).toEqual({
      overflow: 0,
      physical: 2,
      stun: 1,
    })
  })

  it('reduces the damage tracks', () => {
    expect(heal(patient({ physical: 4, stun: 3 }), { physical: 3, stun: 5, overflow: 0 }).damage).toMatchObject({
      physical: 1,
      stun: 0,
    })
  })
})

describe('natural recovery (p. 121)', () => {
  it('rolls Body + Willpower per hour for Stun and stops when healed', () => {
    // 7 dice an hour: first hour 2 hits, second hour 3 hits.
    const result = rest(patient({ stun: 4 }), 'stun', 5, false, dice(5, 6, 1, 1, 1, 1, 1, 5, 5, 6, 1, 1, 1, 1))
    expect(result.periods).toBe(2)
    expect(result.healed.stun).toBe(4)
    expect(result.rolls[0].pool).toBe(7)
  })

  it('rolls Body + Body per day for Physical, Overflow first, +2 with medical care', () => {
    const result = rest(patient({ physical: 3, overflow: 1 }), 'physical', 1, true, dice(5, 5, 5, 1, 1, 1, 1, 1, 1, 1))
    expect(result.healed).toEqual({ overflow: 1, physical: 2, stun: 0 })
  })
})
