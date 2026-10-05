import { z } from 'zod'
import { ATTRIBUTE_IDS, type AttributeId } from '../rules/sr6/attributes'
import { METATYPE_IDS } from '../rules/sr6/metatypes'

/**
 * Bump when the stored/exported shape changes in a way old data can't satisfy
 * through schema defaults alone, and add a step to `migrateCharacter`.
 */
export const CHARACTER_SCHEMA_VERSION = 1

const id = () => z.string().min(1).default(() => crypto.randomUUID())
const text = () => z.string().default('')
const int = (fallback = 0) => z.number().int().default(fallback)

/** Points to a page in one of the user's rulebooks, e.g. { book: 'CRB', page: 245 }. */
export const SourceRefSchema = z.object({
  book: z.string().min(1),
  page: z.number().int().positive(),
})

const attributeShape = Object.fromEntries(
  ATTRIBUTE_IDS.map((a) => [a, int(a === 'magic' || a === 'resonance' ? 0 : 1)]),
) as Record<AttributeId, ReturnType<typeof int>>

export const AttributesSchema = z.object(attributeShape).prefault({})

export const SkillSchema = z.object({
  id: id(),
  /** Id from the SR6 skill list, e.g. 'firearms'. */
  skillId: z.string().min(1),
  rating: int(1),
  specialization: text(),
  expertise: text(),
})

export const KnowledgeSkillSchema = z.object({
  id: id(),
  name: z.string().default(''),
})

export const LanguageSchema = z.object({
  id: id(),
  name: z.string().default(''),
  level: z.enum(['basic', 'specialist', 'expert', 'native']).default('basic'),
})

export const QualitySchema = z.object({
  id: id(),
  name: z.string().default(''),
  kind: z.enum(['positive', 'negative']).default('positive'),
  /** Karma cost (positive qualities) or bonus (negative qualities), as a positive number. */
  karma: int(0),
  rating: int(1),
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const ContactSchema = z.object({
  id: id(),
  name: z.string().default(''),
  role: text(),
  connection: int(1),
  loyalty: int(1),
  notes: text(),
})

export const GearSchema = z.object({
  id: id(),
  name: z.string().default(''),
  category: text(),
  /** 0 = no rating. */
  rating: int(0),
  quantity: int(1),
  cost: int(0),
  /** Armor rating this item adds to Defense Rating while equipped (0 = not armor). */
  armor: int(0),
  equipped: z.boolean().default(false),
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const WeaponSchema = z.object({
  id: id(),
  name: z.string().default(''),
  /** Skill used to attack, e.g. 'firearms' or 'close-combat'. */
  skillId: z.string().default('firearms'),
  /** Specialization this weapon falls under (e.g. 'Pistols'); matching ones add the bonus. */
  specialization: text(),
  /** Damage Value as printed, e.g. '4P'. */
  damage: text(),
  /** Attack Ratings at Close / Near / Medium / Far / Extreme; null = can't be used at that range. */
  attackRatings: z.array(z.number().int().nullable()).length(5).default([null, null, null, null, null]),
  /** Firing modes, e.g. 'SA/BF'. */
  modes: text(),
  /** Ammo capacity and type, e.g. '15(c)'. */
  ammo: text(),
  cost: int(0),
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const CharacterSchema = z.object({
  id: id(),
  schemaVersion: z.literal(CHARACTER_SCHEMA_VERSION).default(CHARACTER_SCHEMA_VERSION),
  edition: z.literal('sr6').default('sr6'),
  /** 'build' follows creation rules; 'free' allows entering an existing character as-is. */
  mode: z.enum(['build', 'free']).default('free'),

  name: z.string().default('Unnamed runner'),
  realName: text(),
  playerName: text(),
  concept: text(),
  metatype: z.enum(METATYPE_IDS).default('human'),
  /** Portrait as a data: URL. */
  portrait: z.string().optional(),

  attributes: AttributesSchema,
  /** Essence lost to augmentations, in hundredths (e.g. 150 = 1.5 Essence) to avoid float drift. */
  essenceLoss: int(0),

  skills: z.array(SkillSchema).default([]),
  knowledgeSkills: z.array(KnowledgeSkillSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  qualities: z.array(QualitySchema).default([]),
  contacts: z.array(ContactSchema).default([]),
  gear: z.array(GearSchema).default([]),
  weapons: z.array(WeaponSchema).default([]),

  nuyen: int(0),
  karma: z
    .object({
      /** Karma left to spend. */
      available: int(0),
      /** Karma earned over the character's career (excluding creation). */
      career: int(0),
    })
    .prefault({}),

  /** Damage boxes currently filled, for tracking during play. */
  damage: z
    .object({
      physical: int(0),
      stun: int(0),
      overflow: int(0),
    })
    .prefault({}),

  notes: text(),

  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
})

export type Character = z.infer<typeof CharacterSchema>
export type SourceRef = z.infer<typeof SourceRefSchema>
export type CharacterSkill = z.infer<typeof SkillSchema>
export type Quality = z.infer<typeof QualitySchema>
export type Contact = z.infer<typeof ContactSchema>
export type GearItem = z.infer<typeof GearSchema>
export type Weapon = z.infer<typeof WeaponSchema>
export type KnowledgeSkill = z.infer<typeof KnowledgeSkillSchema>
export type Language = z.infer<typeof LanguageSchema>

export function createCharacter(overrides: Partial<Character> = {}): Character {
  return CharacterSchema.parse(overrides)
}

/** Upgrade raw data from an older schema version so it can be parsed by `CharacterSchema`. */
export function migrateCharacter(raw: unknown): unknown {
  // Only version 1 exists so far; future migrations go here, keyed on raw.schemaVersion.
  return raw
}
