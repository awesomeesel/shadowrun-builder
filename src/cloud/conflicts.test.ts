import { describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { asMain, copiesOf, differences, isConflictCopy, originalOf } from './conflicts'

describe('conflict copies', () => {
  const main = createCharacter({ name: 'Buck', nuyen: 5000 })
  const marked = createCharacter({ name: 'Buck (other version)', conflictOf: main.id, nuyen: 3000 })
  const legacy = createCharacter({ name: 'Mika (other version)' })
  const mika = createCharacter({ name: 'Mika' })

  it('finds the main character, by id or (for older copies) by name', () => {
    const all = [main, marked, legacy, mika]
    expect(isConflictCopy(main)).toBe(false)
    expect(originalOf(marked, all)?.id).toBe(main.id)
    expect(originalOf(legacy, all)?.id).toBe(mika.id)
    expect(copiesOf(main, all).map((c) => c.id)).toEqual([marked.id])
    // Two characters with that name: don't guess.
    expect(originalOf(legacy, [...all, createCharacter({ name: 'Mika' })])).toBeUndefined()
  })

  it('says how the copy differs', () => {
    expect(differences(marked, main)).toContain('Nuyen: 3,000¥ here, 5,000¥ in the main one')
    expect(differences(main, main)).toEqual([])
  })

  it('keeps the copy’s content under the main character’s id and name', () => {
    const swapped = asMain(marked, main)
    expect(swapped).toMatchObject({ id: main.id, name: 'Buck', nuyen: 3000, createdAt: main.createdAt })
    expect(swapped.conflictOf).toBeUndefined()
  })
})
