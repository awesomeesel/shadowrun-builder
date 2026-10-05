import { describe, expect, it } from 'vitest'
import {
  AdeptPowerSchema,
  AugmentationSchema,
  ContactSchema,
  QualitySchema,
  SpellSchema,
  createCharacter,
  type Build,
  type Character,
} from '../../model/character'
import { applyBuild, evaluateBuild, finishBuild, startBuild } from './build'

/** A fresh build with priorities metatype C, attributes A, skills B, magic E, resources D. */
function fresh(overrides: Partial<Character> = {}): Character {
  return startBuild(createCharacter(overrides))
}

function withBuild(character: Character, change: (build: Build) => void): Character {
  const build = structuredClone(character.build!)
  change(build)
  return applyBuild({ ...character, build })
}

function messages(character: Character) {
  return evaluateBuild(character)!.issues.map((i) => i.message)
}

describe('evaluateBuild', () => {
  it('starts with full budgets', () => {
    const e = evaluateBuild(fresh())!
    expect(e.adjustmentPoints).toEqual({ total: 9, spent: 0, remaining: 9 })
    expect(e.attributePoints).toEqual({ total: 24, spent: 0, remaining: 24 })
    expect(e.skillPoints).toEqual({ total: 24, spent: 0, remaining: 24 })
    expect(e.karma.remaining).toBe(50)
    expect(e.nuyen.total).toBe(50_000)
    expect(e.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('derives attribute values from allocations', () => {
    const c = withBuild(fresh(), (b) => {
      b.attributes.agility.points = 4
      b.attributes.agility.karma = 1
      b.attributes.edge.adjustment = 2
    })
    expect(c.attributes.agility).toBe(6)
    expect(c.attributes.edge).toBe(3)
    const e = evaluateBuild(c)!
    expect(e.attributePoints.spent).toBe(4)
    expect(e.adjustmentPoints.spent).toBe(2)
    expect(e.karma.breakdown.attributes).toBe(30) // raising 5 → 6 costs 6 × 5
  })

  it('charges new rating × 5 for each karma step', () => {
    const c = withBuild(fresh(), (b) => {
      b.attributes.logic.karma = 2 // 1 → 3: 2×5 + 3×5
    })
    expect(evaluateBuild(c)!.karma.breakdown.attributes).toBe(25)
  })

  it('rejects duplicate priorities and unavailable metatypes', () => {
    const c = withBuild(fresh({ metatype: 'human' }), (b) => {
      b.priorities.metatype = 'A'
    })
    const m = messages(c)
    expect(m.some((x) => x.includes('Priority A is used for Metatype and Attributes'))).toBe(true)
    expect(m.some((x) => x.includes("Human isn't available"))).toBe(true)
  })

  it('limits adjustment points to eligible attributes', () => {
    const human = withBuild(fresh({ metatype: 'human' }), (b) => {
      b.attributes.strength.adjustment = 1
    })
    expect(messages(human).some((x) => x.includes("can't be spent on Strength"))).toBe(true)

    const troll = withBuild(fresh({ metatype: 'troll' }), (b) => {
      b.priorities.metatype = 'A'
      b.priorities.attributes = 'C'
      b.attributes.strength.adjustment = 1
    })
    expect(messages(troll).some((x) => x.includes('Strength'))).toBe(false)
  })

  it('allows only one attribute at its maximum', () => {
    const c = withBuild(fresh(), (b) => {
      b.attributes.agility.points = 5
      b.attributes.reaction.points = 5
    })
    expect(messages(c).some((x) => x.includes('2 attributes are at their maximum'))).toBe(true)
  })

  it('gives awakened characters their priority Magic rating', () => {
    const c = withBuild(fresh(), (b) => {
      b.priorities.magic = 'B'
      b.priorities.skills = 'E'
      b.magicType = 'adept'
      b.attributes.magic.adjustment = 1
    })
    expect(c.attributes.magic).toBe(4)
    expect(c.attributes.resonance).toBe(0)
  })

  it('requires a magic priority for awakened types', () => {
    const c = withBuild(fresh(), (b) => {
      b.magicType = 'magician'
    })
    expect(messages(c).some((x) => x.includes('needs Magic/Resonance priority'))).toBe(true)
  })

  it('counts skill points, specializations and karma', () => {
    let c = fresh()
    c = { ...c, skills: [{ id: 'fa', skillId: 'firearms', rating: 0, specialization: 'Pistols', expertise: '' }] }
    c = withBuild(c, (b) => {
      b.skills.fa = { adjustment: 0, points: 5, karma: 1 }
    })
    expect(c.skills[0].rating).toBe(6)
    const e = evaluateBuild(c)!
    expect(e.skillPoints.spent).toBe(6) // 5 + 1 for the specialization
    expect(e.karma.breakdown.skills).toBe(30)
  })

  it('accounts for qualities, contacts, knowledge and nuyen', () => {
    let c = fresh({
      qualities: [
        QualitySchema.parse({ name: 'Ambidextrous', kind: 'positive', karma: 4 }),
        QualitySchema.parse({ name: 'SINner', kind: 'negative', karma: 8 }),
      ],
      // Charisma 1 gives 6 free contact karma; this contact costs 8.
      contacts: [ContactSchema.parse({ name: 'Fixer', connection: 5, loyalty: 3 })],
      // Logic 1 gives one free knowledge skill; the native language is free on top.
      knowledgeSkills: [{ id: 'k1', name: 'Seattle gangs' }, { id: 'k2', name: 'Corporate politics' }],
      languages: [{ id: 'l1', name: 'English', level: 'native' }],
    })
    c = withBuild(c, (b) => {
      b.karmaForNuyen = 5
    })
    const e = evaluateBuild(c)!
    expect(e.karma.breakdown).toMatchObject({ qualities: -4, contacts: 2, knowledge: 3, nuyen: 5 })
    expect(e.karma.remaining).toBe(50 - (-4 + 2 + 3 + 5))
    expect(e.nuyen.total).toBe(60_000)
  })
})

describe('magic and augmentations in builds', () => {
  it('charges karma for spells and nuyen for graded augmentations', () => {
    let c = fresh({
      spells: [SpellSchema.parse({ name: 'Manabolt' }), SpellSchema.parse({ name: 'Heal' })],
      augmentations: [AugmentationSchema.parse({ name: 'Cybereyes', cost: 10_000, grade: 'alpha' })],
    })
    c = withBuild(c, (b) => {
      b.priorities.magic = 'B'
      b.priorities.skills = 'E'
      b.magicType = 'magician'
    })
    const e = evaluateBuild(c)!
    expect(e.karma.breakdown.magic).toBe(10)
    expect(e.nuyen.spent).toBe(12_000)
  })

  it('limits adept powers to available power points', () => {
    let c = fresh({ adeptPowers: [AdeptPowerSchema.parse({ name: 'Killing Hands', powerPoints: 3.5 })] })
    c = withBuild(c, (b) => {
      b.priorities.magic = 'B'
      b.priorities.skills = 'E'
      b.magicType = 'adept'
    })
    expect(messages(c).some((m) => m.includes('use 3.5 power points; only 3 available'))).toBe(true)
  })
})

describe('finishBuild', () => {
  it('turns leftover karma and nuyen into starting resources', () => {
    const done = finishBuild(fresh())
    expect(done.mode).toBe('free')
    expect(done.karma.available).toBe(50)
    expect(done.nuyen).toBe(50_000)
  })
})
