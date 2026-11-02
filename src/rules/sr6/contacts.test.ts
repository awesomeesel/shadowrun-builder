import { describe, expect, it } from 'vitest'
import { createCharacter, SkillSchema } from '../../model/character'
import { addContactNote, contactPool, favorsText } from './contacts'

describe('contacts in play', () => {
  it('rolls Influence + Charisma with Loyalty added (p. 52)', () => {
    const base = createCharacter()
    const face = {
      ...base,
      attributes: { ...base.attributes, charisma: 5 },
      skills: [SkillSchema.parse({ skillId: 'influence', rating: 4 })],
    }
    expect(contactPool(face, { loyalty: 3 })).toBe(12)
    // Untrained: Charisma − 1.
    const plain = { ...base, attributes: { ...base.attributes, charisma: 3 } }
    expect(contactPool(plain, { loyalty: 2 })).toBe(4)
  })

  it('describes favors and adds dated notes', () => {
    expect([favorsText(2), favorsText(-1), favorsText(0)]).toEqual([
      'They owe you 2 favors',
      'You owe them a favor',
      'Even',
    ])
    expect(addContactNote('Knows the docks', 'Got the guard roster', new Date('2026-11-02T10:00:00Z'))).toBe(
      'Knows the docks\n[2026-11-02] Got the guard roster',
    )
  })
})
