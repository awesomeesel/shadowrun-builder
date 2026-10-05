import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../db/db'
import { AugmentationSchema, createCharacter, QualitySchema, WeaponSchema } from '../model/character'
import { enrichFromCatalog } from './enrich'

const cost = (base: number, perRating = false) => ({ base, perRating })
const catalog = [
  {
    kind: 'quality',
    name: 'Toughness',
    positive: true,
    karma: 12,
    perLevel: false,
    maxLevel: null,
    costText: '12 Karma',
  },
  {
    kind: 'quality',
    name: 'Built Tough',
    positive: true,
    karma: 4,
    perLevel: true,
    maxLevel: 4,
    costText: '4 Karma per level',
  },
  { kind: 'weapon', name: 'Testco Rifle', cost: cost(3400) },
  { kind: 'augmentation', name: 'Wired Reflexes 1', cost: cost(40000) },
  { kind: 'augmentation', name: 'Wired Reflexes 2', cost: cost(150000) },
  { kind: 'augmentation', name: 'Muscle toner', cost: cost(32000, true) },
].map((e, i) => ({ ...e, id: String(i), bookId: 'b', page: 1, category: '' })) as unknown as CatalogEntry[]

describe('enrichFromCatalog', () => {
  it('fills quality karma and prices by name, respecting ratings', () => {
    const { character, filled } = enrichFromCatalog(
      createCharacter({
        qualities: [
          QualitySchema.parse({ name: 'toughness' }),
          QualitySchema.parse({ name: 'Built Tough', rating: 2 }),
        ],
        weapons: [WeaponSchema.parse({ name: 'Testco Rifle' })],
        augmentations: [
          AugmentationSchema.parse({ name: 'Wired reflexes', rating: 2 }),
          AugmentationSchema.parse({ name: 'Muscle toner', rating: 3 }),
        ],
      }),
      catalog,
    )
    expect(filled).toBe(5)
    expect(character.qualities.map((q) => q.karma)).toEqual([12, 8])
    expect(character.weapons[0].cost).toBe(3400)
    expect(character.augmentations.map((a) => a.cost)).toEqual([150000, 96000])
  })

  it('leaves values that are already set and unknown items alone', () => {
    const { character, filled } = enrichFromCatalog(
      createCharacter({
        qualities: [QualitySchema.parse({ name: 'Toughness', karma: 5 }), QualitySchema.parse({ name: 'Mystery' })],
      }),
      catalog,
    )
    expect(filled).toBe(0)
    expect(character.qualities.map((q) => q.karma)).toEqual([5, 0])
  })
})
