// An invented character in the shape of a Commlink 6 "Roll20 compatible" export.
import { describe, expect, it } from 'vitest'
import { computeDerived, weaponPool } from '../../rules/sr6/derived'
import { parseImportFile } from '../fileFormat'
import { fromCommlink, isCommlinkExport } from './commlink'

const attr = (id: string, points: number, modifiedValue = points) => ({ name: id, id, points, modifiedValue })

const sample = {
  system: 'SHADOWRUN6',
  version: '3.2.0',
  name: 'Testa Person',
  streetName: 'Testy',
  metaType: 'Human',
  size: 170,
  weight: 65,
  age: '29',
  gender: 'FEMALE',
  heat: 2,
  reputation: 1,
  karma: 3,
  nuyen: 1200,
  initiation: 0,
  attributes: [
    attr('BODY', 4),
    attr('AGILITY', 5, 7),
    attr('REACTION', 4, 6),
    attr('STRENGTH', 3),
    attr('WILLPOWER', 3),
    attr('LOGIC', 2),
    attr('INTUITION', 4),
    attr('CHARISMA', 2),
    attr('EDGE', 3),
    { name: 'Magic', id: 'MAGIC', points: -2, modifiedValue: -4 },
    { name: 'Defense Pool', id: 'DEFENSE_POOL_PHYSICAL', points: 0, modifiedValue: 10 },
    { name: 'Composure', id: 'COMPOSURE', points: 0, modifiedValue: 5 },
  ],
  initiatives: [{ name: 'Initiative', id: 'INITIATIVE_PHYSICAL', value: 10, dice: '+3D6' }],
  qualities: [
    { name: 'Test Quality', id: 'test_quality', choice: '', positive: true, rating: 0, page: 'Core Rulebook 70' },
    { name: 'Test Flaw', id: 'test_flaw', choice: 'Spiders', positive: false, rating: 0, page: 'Core Rulebook 76' },
  ],
  skills: [
    {
      name: 'Firearms',
      id: 'firearms',
      rating: 5,
      specializations: [{ name: 'Rifles', id: 'rifles', expertise: false }],
    },
    { name: 'Close Combat', id: 'close_combat', rating: 2, specializations: [] },
    { name: 'Native Language', id: 'language', rating: 4, specializations: [] },
    { name: 'Test Lore', id: 'knowledge', rating: 1, specializations: [] },
  ],
  longRangeWeapons: [
    {
      name: 'Testco Carbine',
      type: 'Firearms',
      subtype: 'Assault Rifles',
      pool: 14,
      damage: '4P',
      attackRating: '4/10/9/7/2',
      mode: 'SA,BF,FA',
      ammunition: '30(c)',
      accessories: [{ name: 'Smartgun system' }],
      page: 'Core Rulebook 256',
    },
  ],
  closeCombatWeapons: [
    {
      name: 'Unarmed',
      type: 'Close Combat Weapons',
      subtype: 'Unarmed',
      pool: 9,
      damage: '2S',
      attackRating: '6/-/-/-/-',
    },
  ],
  armors: [
    { name: 'Test vest', rating: 3, socialrating: -1, isIgnored: false, page: 'Core Rulebook 265' },
    { name: 'Spare coat', rating: 2, socialrating: 0, isIgnored: true },
  ],
  items: [
    { name: 'Rounds (10x)', count: 10, rating: 0, type: 'Ammunition', subType: 'Ammunition' },
    { name: 'Rounds (10x)', count: 10, rating: 0, type: 'Ammunition', subType: 'Ammunition' },
  ],
  augmentations: [
    { name: 'Wired reflexes', level: null, essence: 0.002, page: 'Core Rulebook 287' },
    { name: 'Muscle toner', level: null, essence: 4.0000001e-4, page: 'Core Rulebook 292' },
  ],
  spells: [],
  adeptPowers: [],
  complexForms: [],
  vehicles: [],
  drones: [],
  lifestyles: [{ customName: 'Coffin motel', name: 'Squatter', cost: 0, paidMonths: 2 }],
  sins: [{ name: 'Jane Fake', quality: 3 }],
  contacts: [{ name: 'Fixy', type: 'Fixer', loyalty: 2, influence: 4, favors: 1 }],
  licenses: [{ name: 'Firearms', sin: 'Jane Fake', rating: 'ANYONE' }],
  matrixItems: [],
  martialArts: [],
  signatureManeuvers: [],
  notes: 'Likes dogs.',
}

describe('Commlink import', () => {
  const { character: c, report } = fromCommlink(structuredClone(sample))

  it('recognises Commlink exports and not our own files', () => {
    expect(isCommlinkExport(sample)).toBe(true)
    expect(isCommlinkExport({ format: 'shadowrun-builder/character' })).toBe(false)
    expect(parseImportFile(JSON.stringify(sample)).report?.source).toBe('Commlink 6')
  })

  it('maps identity, resources and attributes', () => {
    expect(c).toMatchObject({
      name: 'Testy',
      realName: 'Testa Person',
      metatype: 'human',
      gender: 'Female',
      age: '29',
      height: 170,
      weight: 65,
      heat: 2,
      reputation: 1,
      nuyen: 1200,
      karma: { available: 3, career: 0 },
      notes: 'Likes dogs.',
    })
    expect(c.attributes).toMatchObject({ body: 4, agility: 5, reaction: 4, magic: 0, resonance: 0 })
  })

  it('maps skills, knowledge, languages and qualities with page references', () => {
    expect(c.skills.map((s) => [s.skillId, s.rating, s.specialization])).toEqual([
      ['firearms', 5, 'Rifles'],
      ['close-combat', 2, ''],
    ])
    expect(c.languages).toMatchObject([{ name: 'Native Language', level: 'native' }])
    expect(c.knowledgeSkills.map((k) => k.name)).toEqual(['Test Lore'])
    expect(c.qualities).toMatchObject([
      { name: 'Test Quality', kind: 'positive', rating: 1, source: { book: 'CRB', page: 70 } },
      { name: 'Test Flaw', kind: 'negative', notes: 'Spiders' },
    ])
  })

  it('maps weapons, skipping unarmed', () => {
    expect(c.weapons).toHaveLength(1)
    expect(c.weapons[0]).toMatchObject({
      name: 'Testco Carbine',
      skillId: 'firearms',
      specialization: 'Assault Rifles',
      attackRatings: [4, 10, 9, 7, 2],
      modes: 'SA/BF/FA',
      ammo: '30(c)',
      notes: 'Smartgun system',
    })
    // AGI 5 + 2 (muscle toner) + Firearms 5 + 2 (Rifles covers Assault Rifles) = 14, as in Commlink.
    expect(weaponPool(c, c.weapons[0]).pool).toBe(14)
  })

  it('maps armor and merges repeated items', () => {
    expect(c.gear.map((g) => [g.name, g.armor, g.equipped, g.quantity])).toEqual([
      ['Test vest', 3, true, 1],
      ['Spare coat', 2, false, 1],
      ['Rounds (10x)', 0, false, 20],
    ])
  })

  it('fixes the Essence scale and works out augmentation ratings and bonuses', () => {
    expect(c.augmentations.map((a) => [a.name, a.rating, a.essence])).toEqual([
      ['Wired reflexes', 2, 2],
      ['Muscle toner', 2, 0.4],
    ])
    const d = computeDerived(c)
    expect(d.attributes.reaction).toBe(6)
    expect(d.attributes.agility).toBe(7)
    expect(d.initiative).toEqual({ score: 10, dice: 3 })
    expect(d.essence).toBe(3.6)
  })

  it('maps contacts, SINs, licenses and lifestyles', () => {
    expect(c.contacts).toMatchObject([{ name: 'Fixy', role: 'Fixer', connection: 4, loyalty: 2, notes: 'Favors: 1' }])
    expect(c.sins).toMatchObject([{ name: 'Jane Fake', rating: 3 }])
    expect(c.licenses).toMatchObject([{ name: 'Firearms', sin: 'Jane Fake', rating: 0 }])
    expect(c.lifestyles).toMatchObject([{ name: 'Coffin motel', level: 'Squatter', monthsPaid: 2 }])
  })

  it('reports what it guessed and compares with Commlink', () => {
    expect(report.notes.some((n) => n.includes('1,000×'))).toBe(true)
    expect(report.notes.some((n) => n.startsWith('Wired reflexes: rating 2'))).toBe(true)
    expect(report.notes.some((n) => n.includes('more initiative dice'))).toBe(false)
    expect(report.checks).toEqual(
      expect.arrayContaining([
        { label: 'Defense pool', commlink: '10', ours: '10' },
        { label: 'Composure', commlink: '5', ours: '5' },
        { label: 'Initiative', commlink: '10 +3D6', ours: '10 +3D6' },
        { label: 'Testco Carbine pool', commlink: '14', ours: '14' },
      ]),
    )
  })

  it('maps metavariants to their base metatype', () => {
    const { character, report: r } = fromCommlink({ ...structuredClone(sample), metaType: 'Hobgoblin' })
    expect(character.metatype).toBe('ork')
    expect(r.notes[0]).toMatch(/metavariant/)
  })
})
