/**
 * SR6 priority-system character creation data.
 *
 * VERIFY: entered from memory, not yet checked against the Core Rulebook.
 * Everything a reviewer needs to check is in this file.
 */
import type { MetatypeId } from './metatypes'

export const PRIORITY_LEVELS = ['A', 'B', 'C', 'D', 'E'] as const
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number]

export const PRIORITY_CATEGORIES = ['metatype', 'attributes', 'skills', 'magic', 'resources'] as const
export type PriorityCategory = (typeof PRIORITY_CATEGORIES)[number]

export const PRIORITY_CATEGORY_LABELS: Record<PriorityCategory, string> = {
  metatype: 'Metatype',
  attributes: 'Attributes',
  skills: 'Skills',
  magic: 'Magic / Resonance',
  resources: 'Resources',
}

interface PriorityRow {
  metatypes: MetatypeId[]
  adjustmentPoints: number
  attributePoints: number
  skillPoints: number
  /** Starting Magic or Resonance for awakened/emerged characters; 0 = mundane only. */
  magicRating: number
  nuyen: number
}

export const PRIORITY_TABLE: Record<PriorityLevel, PriorityRow> = {
  A: {
    metatypes: ['dwarf', 'ork', 'troll'],
    adjustmentPoints: 13,
    attributePoints: 24,
    skillPoints: 32,
    magicRating: 4,
    nuyen: 450_000,
  },
  B: {
    metatypes: ['dwarf', 'elf', 'ork', 'troll'],
    adjustmentPoints: 11,
    attributePoints: 16,
    skillPoints: 24,
    magicRating: 3,
    nuyen: 275_000,
  },
  C: {
    metatypes: ['human', 'dwarf', 'elf', 'ork', 'troll'],
    adjustmentPoints: 9,
    attributePoints: 12,
    skillPoints: 20,
    magicRating: 2,
    nuyen: 150_000,
  },
  D: {
    metatypes: ['human', 'dwarf', 'elf', 'ork', 'troll'],
    adjustmentPoints: 4,
    attributePoints: 8,
    skillPoints: 16,
    magicRating: 1,
    nuyen: 50_000,
  },
  E: {
    metatypes: ['human', 'dwarf', 'elf', 'ork', 'troll'],
    adjustmentPoints: 1,
    attributePoints: 2,
    skillPoints: 10,
    magicRating: 0,
    nuyen: 8_000,
  },
}

export const MAGIC_TYPES = {
  mundane: { name: 'Mundane', attribute: null },
  magician: { name: 'Full magician', attribute: 'magic' },
  aspected: { name: 'Aspected magician', attribute: 'magic' },
  mysticAdept: { name: 'Mystic adept', attribute: 'magic' },
  adept: { name: 'Adept', attribute: 'magic' },
  technomancer: { name: 'Technomancer', attribute: 'resonance' },
} as const

export type MagicTypeId = keyof typeof MAGIC_TYPES

export const CREATION_RULES = {
  startingKarma: 50,
  /** Karma cost to raise an attribute or active skill to a new rating = new rating × this. */
  karmaPerRating: 5,
  specializationKarma: 5,
  expertiseKarma: 5,
  /** Skill points one specialization costs during creation. */
  specializationSkillPoints: 1,
  maxSkillRating: 6,
  /** How many skills may be at the maximum rating. */
  maxSkillsAtMax: 1,
  /** How many attributes may be at their metatype maximum. */
  maxAttributesAtMax: 1,
  /** Free knowledge/language skills = Logic × this; one native language is always free. */
  freeKnowledgePerLogic: 1,
  knowledgeSkillKarma: 3,
  /** Free contact karma = Charisma × this; a contact costs Connection + Loyalty. */
  contactKarmaPerCharisma: 6,
  nuyenPerKarma: 2_000,
  maxKarmaForNuyen: 10,
} as const
