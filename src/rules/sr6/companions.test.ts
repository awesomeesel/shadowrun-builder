import { describe, expect, it } from 'vitest'
import { banish, callForth, decompile, spiritForceLimit, spiritStats, spriteStats } from './companions'

/** Dice values in order, as a random source. */
const dice = (...values: number[]) => {
  let i = 0
  return () => (values[i++ % values.length] - 1) / 6
}

describe('spirits', () => {
  it('works out a fire spirit from its Force (p. 148)', () => {
    const s = spiritStats('fire', 4)
    expect(s.attributes).toMatchObject({ body: 5, agility: 6, reaction: 7, strength: 2, intuition: 5 })
    expect(s.initiative).toEqual({ score: 12, dice: 2 })
    expect(s.astralInitiative).toEqual({ score: 8, dice: 3 })
    expect(s.defenseRating).toBe(5)
    expect(s.monitor).toBe(10)
    expect(s.skills.find((k) => k.name === 'Close Combat')?.pool).toBe(10)
  })

  it('keeps attributes at 1 or more for weak spirits', () => {
    expect(spiritStats('air', 1).attributes.strength).toBe(1)
  })

  it('limits total Force to Magic × 3', () => {
    expect(spiritForceLimit(5)).toBe(15)
  })
})

describe('sprites', () => {
  it('works out a fault sprite from its Level (p. 193)', () => {
    const s = spriteStats('fault', 3)
    expect([s.attack, s.sleaze, s.dataProcessing, s.firewall]).toEqual([6, 3, 4, 5])
    expect(s.initiative).toEqual({ score: 7, dice: 4 })
    expect(s.monitor).toBe(10)
    expect(s.skills[0].pool).toBe(6)
  })
})

describe('summoning and compiling', () => {
  it("gives services for net hits and drain equal to the spirit's hits", () => {
    // Summoner rolls 5, 6, 5, 2; the Force 2 spirit rolls 4 dice: 5, 1, 1, 3.
    const result = callForth(4, 2, dice(5, 6, 5, 2, 5, 1, 1, 3))
    expect(result).toMatchObject({ services: 2, drainValue: 1 })
  })

  it('fails without net hits', () => {
    expect(callForth(2, 1, dice(5, 1, 6, 5)).services).toBe(0)
  })
})

describe('banishing and decompiling', () => {
  it('removes services for net hits and makes drain twice the spirit hits', () => {
    // Banisher rolls 5, 6, 5; the Force 1 spirit rolls 2 dice: 5, 2.
    expect(banish(3, 1, dice(5, 6, 5, 5, 2))).toMatchObject({ removed: 2, drainValue: 2 })
  })

  it("decompiles against the sprite's Level plus its compiler's Resonance", () => {
    // 4 dice for the technomancer, then Level 2 + Resonance 3 = 5 dice for the sprite.
    const result = decompile(4, 2, 3, dice(5, 5, 6, 1, 5, 1, 1, 1, 1))
    expect(result.resist.pool).toBe(5)
    expect(result).toMatchObject({ removed: 2, drainValue: 0 })
  })
})
