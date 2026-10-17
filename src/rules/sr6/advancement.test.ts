import { describe, expect, it } from 'vitest'
import { QualitySchema, SkillSchema, createCharacter, type Character } from '../../model/character'
import {
  addExpertise,
  addSpecialization,
  buy,
  buyQuality,
  learnKnowledge,
  learnSpell,
  raiseAttribute,
  raiseSkill,
  removeNegativeQuality,
  whyNot,
} from './advancement'

function runner(overrides: Partial<Character> = {}): Character {
  return createCharacter({
    attributes: { ...createCharacter().attributes, agility: 4, edge: 3 },
    skills: [SkillSchema.parse({ id: 'fa', skillId: 'firearms', rating: 4 })],
    karma: { available: 100, career: 120 },
    ...overrides,
  })
}

describe('karma shop prices (pp. 67–68)', () => {
  it('raises an attribute for 5 × the new rank', () => {
    const p = raiseAttribute(runner(), 'agility')
    expect(p).toMatchObject({ label: 'Agility 4 → 5', cost: 25, training: '10 months' })
    const after = buy(runner(), p, new Date('2026-10-20T12:00:00Z'))
    expect(after.attributes.agility).toBe(5)
    expect(after.karma).toEqual({ available: 75, career: 120 })
    expect(after.ledger[0]).toMatchObject({ karma: -25, note: 'Agility 4 → 5', purchase: true })
  })

  it('stops at the metatype maximum', () => {
    const maxed = runner({ attributes: { ...runner().attributes, agility: 6 } })
    expect(whyNot(maxed, raiseAttribute(maxed, 'agility'))).toMatch(/maximum \(6\)/)
  })

  it('raises or learns active skills for 5 × the new rank, up to 9', () => {
    expect(raiseSkill(runner(), 'firearms')).toMatchObject({ cost: 25, training: '5 months' })
    const learned = buy(runner(), raiseSkill(runner(), 'stealth'))
    expect(learned.skills.find((s) => s.skillId === 'stealth')?.rating).toBe(1)
    expect(learned.karma.available).toBe(95)
    const top = runner({ skills: [SkillSchema.parse({ skillId: 'firearms', rating: 9 })] })
    expect(whyNot(top, raiseSkill(top, 'firearms'))).toMatch(/maximum rank of 9/)
  })

  it('sells specializations and expertise for 5, with the expertise rules', () => {
    let c = buy(runner(), addSpecialization(runner(), 'fa', 'Pistols'))
    expect(c.skills[0].specialization).toBe('Pistols')
    expect(whyNot(c, addSpecialization(c, 'fa', 'Rifles'))).toMatch(/already has a specialization/)
    expect(whyNot(c, addExpertise(c, 'fa'))).toMatch(/needs rank 5/)
    c = buy(c, raiseSkill(c, 'firearms'))
    c = buy(c, addExpertise(c, 'fa'))
    expect(c.skills[0]).toMatchObject({ rating: 5, expertise: 'Pistols', specialization: '' })
    expect(c.karma.available).toBe(100 - 5 - 25 - 5)
  })

  it('charges 3 for knowledge, 5 for spells, and double for qualities', () => {
    expect(learnKnowledge('Seattle gangs').cost).toBe(3)
    const mage = runner({ attributes: { ...runner().attributes, magic: 4 } })
    expect(learnSpell(mage, { name: 'Fireball' }).cost).toBe(5)
    expect(whyNot(runner(), learnSpell(runner(), { name: 'Fireball' }))).toMatch(/awakened/)
    expect(buyQuality(QualitySchema.parse({ name: 'Toughness', karma: 12 })).cost).toBe(24)
    const flaw = QualitySchema.parse({ id: 'f', name: 'Bad Luck', kind: 'negative', karma: 12 })
    const unlucky = runner({ qualities: [flaw] })
    const free = buy(unlucky, removeNegativeQuality(unlucky, 'f'))
    expect(free.qualities).toEqual([])
    expect(free.karma.available).toBe(76)
  })

  it("won't spend karma the character doesn't have", () => {
    const poor = runner({ karma: { available: 10, career: 10 } })
    const p = raiseAttribute(poor, 'agility')
    expect(whyNot(poor, p)).toMatch(/Needs 25 karma/)
    expect(buy(poor, p)).toBe(poor)
  })
})
