import { describe, expect, it } from 'vitest'
import { createCharacter, SkillSchema } from '../../model/character'
import { combinePool, pairFormula, skillFormula } from './combine'
import { ownedSkillPools } from './derived'

const runner = () => {
  const base = createCharacter()
  return {
    ...base,
    attributes: { ...base.attributes, agility: 5, strength: 4, logic: 3, willpower: 2, charisma: 3 },
    skills: [SkillSchema.parse({ skillId: 'athletics', rating: 4, specialization: 'Climbing', expertise: '' })],
  }
}

describe('combined pools', () => {
  it('pairs a skill with another attribute, with its specialization if asked', () => {
    expect(combinePool(runner(), { kind: 'skill', id: 'athletics' }, 'strength')).toEqual({
      pool: 8,
      formula: 'Athletics 4 + Strength 4',
    })
    expect(combinePool(runner(), { kind: 'skill', id: 'athletics' }, null, { specialization: true })).toEqual({
      pool: 11,
      formula: 'Athletics 4 + Agility 5 + 2 (Climbing)',
    })
  })

  it('adds two attributes', () => {
    expect(combinePool(runner(), { kind: 'attribute', id: 'logic' }, 'willpower')).toEqual({
      pool: 5,
      formula: 'Logic 3 + Willpower 2',
    })
  })

  it('handles untrained skills: attribute − 1, or not at all', () => {
    expect(combinePool(runner(), { kind: 'skill', id: 'con' }, null)).toMatchObject({ pool: 2 })
    expect(combinePool(runner(), { kind: 'skill', id: 'biotech' }, null)).toMatchObject({ pool: null })
  })

  it('explains the usual pools', () => {
    const r = runner()
    expect(skillFormula(ownedSkillPools(r)[0])).toBe('Athletics 4 + Agility 5')
    expect(pairFormula(r, 'willpower', 'charisma')).toBe('Willpower 2 + Charisma 3')
  })
})
