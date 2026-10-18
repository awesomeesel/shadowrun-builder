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
})
