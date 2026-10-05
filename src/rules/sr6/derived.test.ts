import { describe, expect, it } from 'vitest'
import {
  AdeptPowerSchema,
  AugmentationSchema,
  GearSchema,
  MatrixDeviceSchema,
  WeaponSchema,
  createCharacter,
  type Character,
} from '../../model/character'
import { computeDerived, ownedSkillPools, specializationCovers, untrainedSkillPools, weaponPool } from './derived'

function runner(overrides: Partial<Character> = {}): Character {
  return createCharacter({
    attributes: {
      body: 5,
      agility: 6,
      reaction: 4,
      strength: 3,
      willpower: 3,
      logic: 2,
      intuition: 5,
      charisma: 2,
      edge: 3,
      magic: 0,
      resonance: 0,
    },
    ...overrides,
  })
}

describe('computeDerived', () => {
  it('computes core stats from attributes', () => {
    const d = computeDerived(runner())
    expect(d.initiative).toEqual({ score: 9, dice: 1 })
    expect(d.astralInitiative).toEqual({ score: 7, dice: 2 }) // LOG 2 + INT 5
    expect(d.physicalMonitor.boxes).toBe(11) // 8 + ceil(5 / 2)
    expect(d.stunMonitor.boxes).toBe(10) // 8 + ceil(3 / 2)
    expect(d.defenseRating).toBe(5)
    expect(d.pools).toEqual({
      defense: 9,
      damageResistance: 5,
      composure: 5,
      judgeIntentions: 8,
      memory: 7,
      liftCarry: 8,
    })
    expect(d.unarmedAttackRating).toBe(7)
    expect(d.essence).toBe(6)
  })

  it('adds equipped armor to Defense Rating', () => {
    const d = computeDerived(
      runner({
        gear: [
          GearSchema.parse({ name: 'Armor jacket', armor: 4, equipped: true }),
          GearSchema.parse({ name: 'Spare vest', armor: 3, equipped: false }),
        ],
      }),
    )
    expect(d.armor).toBe(4)
    expect(d.defenseRating).toBe(9)
  })

  it('applies -1 per 3 boxes of damage on each track', () => {
    expect(computeDerived(runner({ damage: { physical: 2, stun: 2, overflow: 0 } })).woundModifier).toBe(0)
    expect(computeDerived(runner({ damage: { physical: 3, stun: 0, overflow: 0 } })).woundModifier).toBe(-1)
    expect(computeDerived(runner({ damage: { physical: 7, stun: 4, overflow: 0 } })).woundModifier).toBe(-3)
  })

  it('reports essence from essence loss', () => {
    expect(computeDerived(runner({ essenceLoss: 145 })).essence).toBe(4.55)
  })
})

describe('skill pools', () => {
  it('adds rating, attribute and specialization/expertise bonuses', () => {
    const [firearms] = ownedSkillPools(
      runner({ skills: [{ id: 's', skillId: 'firearms', rating: 4, specialization: 'Pistols', expertise: '' }] }),
    )
    expect(firearms.pool).toBe(10)
    expect(firearms.specializationPool).toBe(12)
    expect(firearms.expertisePool).toBeNull()
  })

  it('rolls untrained skills at attribute - 1 and excludes ones that need training', () => {
    const pools = untrainedSkillPools(runner())
    expect(pools.find((p) => p.skill.id === 'perception')?.pool).toBe(4)
    expect(pools.some((p) => p.skill.id === 'sorcery')).toBe(false)
  })

  it('marks owned rating-0 skills that need training as unusable', () => {
    const [sorcery] = ownedSkillPools(
      runner({ skills: [{ id: 's', skillId: 'sorcery', rating: 0, specialization: '', expertise: '' }] }),
    )
    expect(sorcery.pool).toBeNull()
  })
})

describe('weaponPool', () => {
  const pistol = WeaponSchema.parse({ name: 'Ares Predator VI', skillId: 'firearms', specialization: 'Pistols' })

  it('adds a matching specialization', () => {
    const c = runner({
      skills: [{ id: 's', skillId: 'firearms', rating: 4, specialization: 'pistols', expertise: '' }],
    })
    expect(weaponPool(c, pistol)).toEqual({ pool: 12, bonus: 2 })
  })

  it('prefers a matching expertise', () => {
    const c = runner({
      skills: [{ id: 's', skillId: 'firearms', rating: 4, specialization: 'Rifles', expertise: 'Pistols' }],
    })
    expect(weaponPool(c, pistol)).toEqual({ pool: 13, bonus: 3 })
  })

  it('falls back to an untrained roll', () => {
    expect(weaponPool(runner(), pistol)).toEqual({ pool: 5, bonus: 0 })
    expect(weaponPool(runner(), WeaponSchema.parse({ skillId: 'exotic-weapons' })).pool).toBeNull()
  })
})

describe('augmentations and special attributes', () => {
  const wired = AugmentationSchema.parse({
    name: 'Wired reflexes 2',
    essence: 3,
    grade: 'standard',
    bonuses: { attributes: { reaction: 2 }, initiativeDice: 2 },
  })

  it('applies attribute bonuses and initiative dice', () => {
    const d = computeDerived(runner({ augmentations: [wired] }))
    expect(d.attributes.reaction).toBe(6)
    expect(d.initiative).toEqual({ score: 11, dice: 3 })
    expect(d.pools.defense).toBe(11)
    expect(d.essence).toBe(3)
  })

  it('caps augmented bonuses at +4 and initiative dice at 5', () => {
    const big = AugmentationSchema.parse({ bonuses: { attributes: { agility: 3 }, initiativeDice: 3 } })
    const d = computeDerived(runner({ augmentations: [big, big] }))
    expect(d.attributes.agility).toBe(10) // 6 + min(6, 4)
    expect(d.initiative.dice).toBe(5)
  })

  it('applies grade multipliers to Essence', () => {
    const alpha = AugmentationSchema.parse({ essence: 1, grade: 'alpha' })
    const delta = AugmentationSchema.parse({ essence: 0.5, grade: 'delta' })
    expect(computeDerived(runner({ augmentations: [alpha, delta], essenceLoss: 10 })).essence).toBe(4.85)
  })

  it('reduces Magic by each started point of Essence lost', () => {
    const mage = (essence: number) =>
      computeDerived(
        runner({
          attributes: { ...runner().attributes, magic: 5 },
          augmentations: [AugmentationSchema.parse({ essence })],
        }),
      )
    expect(mage(0).attributes.magic).toBe(5)
    expect(mage(0.2).attributes.magic).toBe(4)
    expect(mage(1).attributes.magic).toBe(4)
    expect(mage(1.1).attributes.magic).toBe(3)
  })

  it('computes spellcasting, drain and power points', () => {
    const c = runner({
      attributes: { ...runner().attributes, magic: 4 },
      tradition: 'shamanic',
      skills: [{ id: 's', skillId: 'sorcery', rating: 3, specialization: '', expertise: '' }],
      adeptPowers: [AdeptPowerSchema.parse({ name: 'Improved Reflexes 1', powerPoints: 1.5 })],
    })
    expect(computeDerived(c).magic).toEqual({
      spellcasting: 7,
      drainResistance: 5, // WIL 3 + CHA 2
      powerPoints: { available: 4, used: 1.5 },
    })
    expect(computeDerived(runner()).magic).toBeNull()
  })

  it('uses the active device for Matrix stats', () => {
    const deck = MatrixDeviceSchema.parse({
      deviceRating: 5,
      attack: 7,
      sleaze: 6,
      dataProcessing: 5,
      firewall: 4,
      active: true,
    })
    const m = computeDerived(runner({ matrixDevices: [deck] })).matrix!
    expect(m.monitor).toBe(11)
    expect(m.coldSimInitiative).toEqual({ score: 10, dice: 2 })
    expect(m.hotSimInitiative.dice).toBe(3)
    expect(computeDerived(runner()).matrix).toBeNull()
  })

  it('gives technomancers a living persona', () => {
    const m = computeDerived(runner({ attributes: { ...runner().attributes, resonance: 6 } })).matrix!
    expect(m.device).toBeUndefined()
    expect([m.deviceRating, m.attack, m.sleaze, m.dataProcessing, m.firewall]).toEqual([6, 2, 5, 2, 3])
  })
})

describe('specializationCovers', () => {
  it.each([
    ['Rifles', 'Assault Rifles', true],
    ['Pistols', 'Heavy Pistols', true],
    ['Heavy pistols', 'Heavy Pistols', true],
    ['Automatics', 'Submachine guns', false],
    ['Rifles', 'Shotguns', false],
    ['', 'Rifles', false],
  ])('%s covers %s: %s', (spec, category, expected) => {
    expect(specializationCovers(spec, category)).toBe(expected)
  })
})
