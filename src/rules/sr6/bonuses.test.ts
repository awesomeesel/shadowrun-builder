import { describe, expect, it } from 'vitest'
import { formatBonuses, knownBonuses, noBonuses, parseBonuses } from './bonuses'

const none = noBonuses()

describe('bonus text', () => {
  it.each([
    ['REA +2, +2D6', { ...none, attributes: { reaction: 2 }, initiativeDice: 2 }],
    ['Reaction +2, agility +1', { ...none, attributes: { reaction: 2, agility: 1 }, initiativeDice: 0 }],
    ['agi+1; str +2', { ...none, attributes: { agility: 1, strength: 2 }, initiativeDice: 0 }],
    ['ID +1', { ...none, initiativeDice: 1 }],
    ['+1d6 init', { ...none, initiativeDice: 1 }],
    ['CHA -1', { ...none, attributes: { charisma: -1 }, initiativeDice: 0 }],
    ['', { ...none }],
    [
      'Defense Rating +1, soak +2, Unarmed AR +2, unarmed damage +1, Unarmed physical',
      {
        ...none,
        defenseRating: 1,
        physicalResistance: 2,
        unarmedAttackRating: 2,
        unarmedDamage: 1,
        unarmedPhysical: true,
      },
    ],
  ])('parses %j', (text, expected) => {
    expect(parseBonuses(text)).toEqual(expected)
  })

  it.each(['XYZ +1', 'REA', 'lots of speed'])('rejects %j', (text) => {
    expect(parseBonuses(text)).toBeUndefined()
  })

  it('formats back to text', () => {
    expect(formatBonuses({ ...none, attributes: { strength: 2, reaction: 1 }, initiativeDice: 1 })).toBe(
      'Reaction +1, Strength +2, +1D6',
    )
  })

  it('formats other bonuses with full names', () => {
    expect(formatBonuses({ ...none, defenseRating: 1, physicalResistance: 2, unarmedPhysical: true })).toBe(
      'Defense Rating +1, Physical damage resistance +2, Unarmed physical',
    )
  })
})

describe('known implants', () => {
  it('fills in bone lacing from the Bone Lacing table', () => {
    expect(knownBonuses('Bone lacing (Aluminium)', 0)).toEqual({
      ...none,
      physicalResistance: 2,
      defenseRating: 1,
      unarmedDamage: 1,
      unarmedAttackRating: 2,
      unarmedPhysical: true,
    })
    expect(knownBonuses('Bone Lacing (Titanium)', 0)).toMatchObject({ defenseRating: 2, unarmedAttackRating: 3 })
  })

  it('gives dermal plating Defense Rating equal to its rating', () => {
    expect(knownBonuses('Dermal Plating', 3)).toEqual({ ...none, defenseRating: 3 })
  })
})
