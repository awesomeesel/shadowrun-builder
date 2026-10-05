import { describe, expect, it } from 'vitest'
import type { ExtractedEntry } from '../../books/extract'
import { toCharacterItem } from '../../books/toCharacter'
import type { Book, CatalogEntry } from '../../db/db'
import { evaluateBuild } from './build'
import { METATYPE_IDS } from './metatypes'
import { quickBuild, quickMake, randomStreetName } from './quickBuild'
import { ROLES, ROLES_BY_ID } from './roles'

const book: Book = {
  id: 'book',
  code: 'TST',
  title: 'Test book',
  fileName: 'test.pdf',
  size: 1,
  addedAt: '',
  pageCount: 100,
  pageLabels: null,
  pageOffset: 0,
  indexedPages: 100,
}

// Invented entries whose names contain the roles' search words.
const entries: ExtractedEntry[] = [
  {
    kind: 'quality',
    page: 1,
    name: 'Ambidextrous',
    category: 'Positive qualities',
    positive: true,
    karma: 4,
    perLevel: false,
    maxLevel: null,
    costText: '4 Karma',
  },
  {
    kind: 'quality',
    page: 1,
    name: 'Analytical Mind',
    category: 'Positive qualities',
    positive: true,
    karma: 3,
    perLevel: false,
    maxLevel: null,
    costText: '3 Karma',
  },
  {
    kind: 'spell',
    page: 2,
    name: 'Manabolt',
    category: 'Direct Combat',
    spellCategory: 'combat',
    range: 'LOS',
    type: 'M',
    duration: 'I',
    drain: '4',
    damage: 'P',
  },
  {
    kind: 'spell',
    page: 2,
    name: 'Heal',
    category: 'Health',
    spellCategory: 'health',
    range: 'T',
    type: 'M',
    duration: 'P',
    drain: '4',
    damage: '',
  },
  {
    kind: 'spell',
    page: 2,
    name: 'Stunbolt',
    category: 'Direct Combat',
    spellCategory: 'combat',
    range: 'LOS',
    type: 'M',
    duration: 'I',
    drain: '3',
    damage: 'S',
  },
  {
    kind: 'adeptPower',
    page: 3,
    name: 'Improved Reflexes',
    category: 'Adept powers',
    powerPoints: 1.5,
    perLevel: true,
    maxLevel: 4,
    activation: 'Passive',
  },
  {
    kind: 'adeptPower',
    page: 3,
    name: 'Killing Hands',
    category: 'Adept powers',
    powerPoints: 0.5,
    perLevel: false,
    maxLevel: null,
    activation: 'Minor',
  },
  { kind: 'complexForm', page: 4, name: 'Puppeteer', category: 'Complex forms', fading: '4', duration: 'S' },
  { kind: 'complexForm', page: 4, name: 'Cleaner', category: 'Complex forms', fading: '2', duration: 'P' },
  {
    kind: 'weapon',
    page: 5,
    name: 'Ares Predator Test',
    category: 'Heavy pistols',
    damage: '3P',
    modes: 'SA',
    attackRatings: [10, 10, 8, null, null],
    ammo: '15(c)',
    availability: '2',
    cost: { base: 750, perRating: false },
  },
  {
    kind: 'weapon',
    page: 5,
    name: 'Colt America Test',
    category: 'Light pistols',
    damage: '2P',
    modes: 'SA',
    attackRatings: [8, 8, 6, null, null],
    ammo: '11(c)',
    availability: '2',
    cost: { base: 230, perRating: false },
  },
  {
    kind: 'armor',
    page: 6,
    name: 'Armor jacket',
    category: 'Armor',
    rating: null,
    defense: 4,
    capacity: '8',
    availability: '2',
    cost: { base: 1000, perRating: false },
  },
  {
    kind: 'armor',
    page: 6,
    name: 'Armor clothing',
    category: 'Armor',
    rating: null,
    defense: 2,
    capacity: '4',
    availability: '2',
    cost: { base: 500, perRating: false },
  },
  {
    kind: 'augmentation',
    page: 7,
    name: 'Wired Reflexes 2',
    category: 'Bodyware',
    rating: null,
    essence: { base: 2, perRating: false },
    capacity: '',
    availability: '3',
    cost: { base: 150000, perRating: false },
  },
  {
    kind: 'augmentation',
    page: 7,
    name: 'Muscle toner',
    category: 'Bioware',
    rating: { min: 1, max: 4 },
    essence: { base: 0.2, perRating: true },
    capacity: '',
    availability: '4',
    cost: { base: 32000, perRating: true },
  },
  {
    kind: 'augmentation',
    page: 7,
    name: 'Datajack',
    category: 'Headware',
    rating: null,
    essence: { base: 0.1, perRating: false },
    capacity: '',
    availability: '2',
    cost: { base: 1000, perRating: false },
  },
  {
    kind: 'matrixDevice',
    page: 8,
    name: 'Test commlink',
    category: 'Commlinks',
    deviceRating: 3,
    attributes: '2/1',
    attributeNames: 'D/F',
    availability: '2',
    cost: { base: 1000, perRating: false },
  },
  {
    kind: 'matrixDevice',
    page: 8,
    name: 'Test cyberdeck',
    category: 'Cyberdecks',
    deviceRating: 2,
    attributes: '5/4',
    attributeNames: 'A/S',
    availability: '3',
    cost: { base: 60000, perRating: false },
  },
  {
    kind: 'vehicle',
    page: 9,
    name: 'Test van',
    category: 'Trucks and vans',
    drone: false,
    handling: '3/4',
    acceleration: '10',
    speedInterval: '15',
    topSpeed: '140',
    body: 12,
    armor: 6,
    pilot: 1,
    sensor: 1,
    seats: '6',
    availability: '2',
    cost: { base: 30000, perRating: false },
  },
  {
    kind: 'vehicle',
    page: 9,
    name: 'Test drone',
    category: 'Small drones',
    drone: true,
    handling: '3',
    acceleration: '10',
    speedInterval: '10',
    topSpeed: '50',
    body: 2,
    armor: 1,
    pilot: 3,
    sensor: 3,
    seats: '—',
    availability: '3',
    cost: { base: 5000, perRating: false },
  },
]
const catalog: CatalogEntry[] = entries.map((e, i) => ({ ...e, id: `book:${i}`, bookId: 'book' }))
const toItem = (entry: CatalogEntry, options: Parameters<typeof toCharacterItem>[2]) =>
  toCharacterItem(entry, book, options)

const errorsOf = (c: Parameters<typeof evaluateBuild>[0]) =>
  evaluateBuild(c)!
    .issues.filter((i) => i.severity === 'error')
    .map((i) => i.message)

describe('quickBuild', () => {
  for (const role of ROLES) {
    for (const metatype of METATYPE_IDS) {
      it(`makes a legal ${metatype} ${role.name.toLowerCase()} without books`, () => {
        const { character } = quickBuild({ role, metatype, name: 'Test' })
        expect(errorsOf(character)).toEqual([])
        const e = evaluateBuild(character)!
        expect(e.attributePoints.remaining).toBe(0)
        expect(e.skillPoints.remaining).toBe(0)
      })

      it(`makes a legal ${metatype} ${role.name.toLowerCase()} with books`, () => {
        const { character } = quickBuild({ role, metatype, name: 'Test', catalog, toItem })
        expect(errorsOf(character)).toEqual([])
      })
    }
  }

  it('picks role-appropriate items from the catalog', () => {
    const { character } = quickBuild({
      role: ROLES_BY_ID.get('samurai')!,
      metatype: 'ork',
      name: 'Test',
      catalog,
      toItem,
    })
    expect(character.weapons.map((w) => w.name)).toContain('Ares Predator Test')
    expect(character.gear.find((g) => g.armor > 0)?.equipped).toBe(true)
    expect(character.augmentations.length).toBeGreaterThan(0)
    expect(character.contacts.length).toBeGreaterThan(0)
    expect(character.languages[0]).toMatchObject({ name: 'English', level: 'native' })
  })

  it('gives casters spells and adepts powers within their power points', () => {
    const mage = quickBuild({ role: ROLES_BY_ID.get('mage')!, metatype: 'human', name: 'M', catalog, toItem }).character
    expect(mage.spells.length).toBeGreaterThan(0)
    expect(mage.augmentations).toEqual([])
    const adept = quickBuild({
      role: ROLES_BY_ID.get('adept')!,
      metatype: 'human',
      name: 'A',
      catalog,
      toItem,
    }).character
    expect(adept.adeptPowers.length).toBeGreaterThan(0)
  })

  it('notes when no books are available', () => {
    expect(quickBuild({ role: ROLES[0], metatype: 'human', name: 'T' }).notes[0]).toMatch(/No rulebooks/)
  })

  it('finishes into a playable character', () => {
    const { character } = quickMake({ role: ROLES[0], metatype: 'human', name: 'T', catalog, toItem })
    expect(character.mode).toBe('free')
    expect(character.karma.available).toBeGreaterThanOrEqual(0)
    expect(character.nuyen).toBeGreaterThanOrEqual(0)
  })

  it('makes up a street name', () => {
    expect(randomStreetName(() => 0)).toBe('Ash')
  })
})
