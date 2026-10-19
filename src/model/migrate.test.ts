import { describe, expect, it } from 'vitest'
import { createCharacter, migrateCharacter } from './character'

describe('migrateCharacter', () => {
  it('repairs dermal plating saved with 3 Essence per rating', () => {
    const c = createCharacter()
    const raw = {
      ...c,
      augmentations: [
        { name: 'Dermal Plating', rating: 3, essence: 9 },
        { name: 'Dermal Plating', rating: 2, essence: 0.6 },
        { name: 'Wired Reflexes', rating: 1, essence: 2 },
      ],
    }
    const fixed = migrateCharacter(raw) as typeof raw
    expect(fixed.augmentations.map((a) => a.essence)).toEqual([0.9, 0.6, 2])
  })

  it('leaves characters without the problem untouched', () => {
    const raw = { ...createCharacter(), augmentations: [{ name: 'Dermal Plating', rating: 2, essence: 0.6 }] }
    expect(migrateCharacter(raw)).toBe(raw)
  })

  it('swaps bone lacing’s added unarmed damage for the table’s DV', () => {
    const raw = {
      ...createCharacter(),
      augmentations: [
        { name: 'Bone Lacing (Titanium)', bonuses: { unarmedDamage: 2, unarmedPhysical: true, defenseRating: 2 } },
        { name: 'Bone lacing (plastic)', bonuses: { unarmedDamage: 1 } },
      ],
    }
    type Aug = { bonuses: Record<string, unknown> }
    const fixed = migrateCharacter(raw) as { augmentations: Aug[] }
    expect(fixed.augmentations[0].bonuses).toMatchObject({ unarmedDamage: 0, unarmedDamageSet: 4, defenseRating: 2 })
    expect(fixed.augmentations[1].bonuses).toMatchObject({ unarmedDamageSet: 3, unarmedPhysical: true })
    expect(migrateCharacter(fixed)).toBe(fixed)
  })
})
