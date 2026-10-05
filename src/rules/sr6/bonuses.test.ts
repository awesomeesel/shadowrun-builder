import { describe, expect, it } from 'vitest'
import { formatBonuses, parseBonuses } from './bonuses'

describe('bonus text', () => {
  it.each([
    ['REA +2, +2D6', { attributes: { reaction: 2 }, initiativeDice: 2 }],
    ['agi+1; str +2', { attributes: { agility: 1, strength: 2 }, initiativeDice: 0 }],
    ['ID +1', { attributes: {}, initiativeDice: 1 }],
    ['+1d6 init', { attributes: {}, initiativeDice: 1 }],
    ['CHA -1', { attributes: { charisma: -1 }, initiativeDice: 0 }],
    ['', { attributes: {}, initiativeDice: 0 }],
  ])('parses %j', (text, expected) => {
    expect(parseBonuses(text)).toEqual(expected)
  })

  it.each(['XYZ +1', 'REA', 'lots of speed'])('rejects %j', (text) => {
    expect(parseBonuses(text)).toBeUndefined()
  })

  it('formats back to text', () => {
    expect(formatBonuses({ attributes: { strength: 2, reaction: 1 }, initiativeDice: 1 })).toBe('REA +1, STR +2, +1D6')
  })
})
