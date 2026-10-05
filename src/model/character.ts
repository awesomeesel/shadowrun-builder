import { z } from 'zod'
import { ATTRIBUTE_IDS, type AttributeId } from '../rules/sr6/attributes'
import { MAGIC_TYPES, PRIORITY_LEVELS, type MagicTypeId } from '../rules/sr6/creation'
import { METATYPE_IDS } from '../rules/sr6/metatypes'
import {
  AUGMENTATION_GRADES,
  AUGMENTATION_KINDS,
  SPELL_CATEGORIES,
  TRADITIONS,
  type GradeId,
  type TraditionId,
} from '../rules/sr6/special'

/**
 * Bump when the stored/exported shape changes in a way old data can't satisfy
 * through schema defaults alone, and add a step to `migrateCharacter`.
 */
export const CHARACTER_SCHEMA_VERSION = 1

const id = () =>
  z
    .string()
    .min(1)
    .default(() => crypto.randomUUID())
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

/** Modifiers an augmentation or adept power gives, e.g. +2 Reaction and +1 initiative die. */
export const BonusesSchema = z
  .object({
    attributes: z.partialRecord(z.enum(ATTRIBUTE_IDS), z.number().int()).default({}),
    initiativeDice: int(0),
  })
  .prefault({})

export const AugmentationSchema = z.object({
  id: id(),
  name: z.string().default(''),
  kind: z.enum(AUGMENTATION_KINDS).default('cyberware'),
  grade: z.enum(Object.keys(AUGMENTATION_GRADES) as [GradeId, ...GradeId[]]).default('standard'),
  rating: int(0),
  /** Essence cost as printed, before the grade multiplier. */
  essence: z.number().min(0).default(0),
  /** Price as printed, before the grade multiplier. */
  cost: int(0),
  bonuses: BonusesSchema,
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const SpellSchema = z.object({
  id: id(),
  name: z.string().default(''),
  category: z.enum(SPELL_CATEGORIES).default('combat'),
  type: z.enum(['physical', 'mana']).default('mana'),
  range: text(),
  duration: text(),
  drain: text(),
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const AdeptPowerSchema = z.object({
  id: id(),
  name: z.string().default(''),
  level: int(0),
  /** Total power point cost for this power at its level. */
  powerPoints: z.number().min(0).default(0),
  bonuses: BonusesSchema,
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const ComplexFormSchema = z.object({
  id: id(),
  name: z.string().default(''),
  duration: text(),
  fading: text(),
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const MatrixDeviceSchema = z.object({
  id: id(),
  name: z.string().default(''),
  kind: z.enum(['commlink', 'cyberdeck', 'rcc', 'other']).default('commlink'),
  deviceRating: int(1),
  attack: int(0),
  sleaze: int(0),
  dataProcessing: int(0),
  firewall: int(0),
  /** The device used for Matrix stats on the sheet. */
  active: z.boolean().default(false),
  cost: int(0),
  notes: text(),
  source: SourceRefSchema.optional(),
})

export const VehicleSchema = z.object({
  id: id(),
  name: z.string().default(''),
  kind: z.enum(['vehicle', 'drone']).default('vehicle'),
  /** Handling as printed, e.g. '4/3' (on-road/off-road). */
  handling: text(),
  acceleration: text(),
  speedInterval: text(),
  topSpeed: text(),
  body: int(0),
  armor: int(0),
  pilot: int(0),
  sensor: int(0),
  seats: text(),
  cost: int(0),
  notes: text(),
  source: SourceRefSchema.optional(),
})

const allocation = () =>
  z
    .object({
      /** Metatype adjustment points (Edge, Magic/Resonance and metatype-boosted attributes only). */
      adjustment: int(0),
      /** Attribute or skill points from the priority table. */
      points: int(0),
      /** Ratings bought with karma, on top of the points. */
      karma: int(0),
    })
    .prefault({})

/** Priority-build allocations. Attribute values and skill ratings are derived from these while building. */
export const BuildSchema = z.object({
  priorities: z
    .object({
      metatype: z.enum(PRIORITY_LEVELS).default('C'),
      attributes: z.enum(PRIORITY_LEVELS).default('A'),
      skills: z.enum(PRIORITY_LEVELS).default('B'),
      magic: z.enum(PRIORITY_LEVELS).default('E'),
      resources: z.enum(PRIORITY_LEVELS).default('D'),
    })
    .prefault({}),
  magicType: z.enum(Object.keys(MAGIC_TYPES) as [MagicTypeId, ...MagicTypeId[]]).default('mundane'),
  attributes: z
    .object(
      Object.fromEntries(ATTRIBUTE_IDS.map((a) => [a, allocation()])) as Record<
        AttributeId,
        ReturnType<typeof allocation>
      >,
    )
    .prefault({}),
  /** Keyed by the character skill's id. */
  skills: z.record(z.string(), allocation()).default({}),
  karmaForNuyen: int(0),
  /** Role picked in the wizard, e.g. 'samurai'; drives suggestions only. */
  role: text(),
})

/** One change to nuyen or karma, e.g. a run's payment or karma awarded. */
export const LedgerEntrySchema = z.object({
  id: id(),
  date: z.string().default(() => new Date().toISOString()),
  nuyen: int(0),
  karma: int(0),
  note: text(),
})

/** A dice roll made during a session, kept for the session summary. */
export const RollRecordSchema = z.object({
  label: text(),
  pool: int(0),
  hits: int(0),
  glitch: z.boolean().default(false),
  criticalGlitch: z.boolean().default(false),
  /** Total for initiative rolls (score + dice); null for normal tests. */
  total: z.number().int().nullable().default(null),
})

/** A finished play session, kept as a log on the character. */
export const SessionRecordSchema = z.object({
  id: id(),
  title: text(),
  startedAt: z.string(),
  endedAt: z.string(),
  nuyen: int(0),
  karma: int(0),
  notes: text(),
  /** Money and karma changes made during the session. */
  entries: z.array(z.object({ note: text(), nuyen: int(0), karma: int(0) })).default([]),
  /** Damage on the monitors when the session ended, before any healing. */
  damage: z.object({ physical: int(0), stun: int(0) }).prefault({}),
  /** Edge at the start and end; null for sessions logged before this was tracked. */
  edgeStart: z.number().int().nullable().default(null),
  edgeEnd: z.number().int().nullable().default(null),
  rolls: z.array(RollRecordSchema).default([]),
})

/** State that only matters at the table: current Edge, loaded ammo and the running session. */
export const PlaySchema = z
  .object({
    /** Edge points available right now; null until the first session starts. */
    edge: z.number().int().nullable().default(null),
    /** Rounds loaded per weapon id. */
    ammo: z.record(z.string(), z.number().int()).default({}),
    session: z
      .object({
        title: text(),
        startedAt: z.string(),
        notes: text(),
        edgeStart: z.number().int().nullable().default(null),
        rolls: z.array(RollRecordSchema).default([]),
      })
      .nullable()
      .default(null),
  })
  .prefault({})

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
  /** Essence lost to things not listed as augmentations, in hundredths (150 = 1.5) to avoid float drift. */
  essenceLoss: int(0),

  skills: z.array(SkillSchema).default([]),
  knowledgeSkills: z.array(KnowledgeSkillSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  qualities: z.array(QualitySchema).default([]),
  contacts: z.array(ContactSchema).default([]),
  gear: z.array(GearSchema).default([]),
  weapons: z.array(WeaponSchema).default([]),
  augmentations: z.array(AugmentationSchema).default([]),
  tradition: z.enum(Object.keys(TRADITIONS) as [TraditionId, ...TraditionId[]]).default('hermetic'),
  spells: z.array(SpellSchema).default([]),
  adeptPowers: z.array(AdeptPowerSchema).default([]),
  /** Power points a mystic adept has bought with karma. */
  powerPointsBought: int(0),
  complexForms: z.array(ComplexFormSchema).default([]),
  matrixDevices: z.array(MatrixDeviceSchema).default([]),
  vehicles: z.array(VehicleSchema).default([]),

  nuyen: int(0),
  karma: z
    .object({
      /** Karma left to spend. */
      available: int(0),
      /** Karma earned over the character's career (excluding creation). */
      career: int(0),
    })
    .prefault({}),

  /** Present while the character is being built with the priority system. */
  build: BuildSchema.optional(),

  play: PlaySchema,
  ledger: z.array(LedgerEntrySchema).default([]),
  sessions: z.array(SessionRecordSchema).default([]),

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
export type Build = z.infer<typeof BuildSchema>
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>
export type SessionRecord = z.infer<typeof SessionRecordSchema>
export type RollRecord = z.infer<typeof RollRecordSchema>
export type Bonuses = z.infer<typeof BonusesSchema>
export type Augmentation = z.infer<typeof AugmentationSchema>
export type Spell = z.infer<typeof SpellSchema>
export type AdeptPower = z.infer<typeof AdeptPowerSchema>
export type ComplexForm = z.infer<typeof ComplexFormSchema>
export type MatrixDevice = z.infer<typeof MatrixDeviceSchema>
export type Vehicle = z.infer<typeof VehicleSchema>
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
