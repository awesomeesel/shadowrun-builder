import {
  BonusesSchema,
  type Bonuses,
  type Character,
  type CharacterSkill,
  type MatrixDevice,
  type Program,
  type Weapon,
} from '../../model/character'
import { ATTRIBUTE_IDS, type AttributeId } from './attributes'
import { gradeEffects } from './initiation'
import { METATYPES } from './metatypes'
import { SKILLS, SKILLS_BY_ID, type SkillDef } from './skills'
import {
  TOOLBOX_DATA_PROCESSING,
  VIRTUAL_MACHINE_SLOTS,
  cyberjackStats,
  isCyberjackName,
  ratingFromName,
} from './matrix'
import { AUGMENTATION_GRADES, SPECIAL_RULES, TRADITIONS } from './special'

/** Damage boxes per wound modifier step (-1 for every 3 boxes filled). */
const BOXES_PER_WOUND_STEP = 3
const SPECIALIZATION_BONUS = 2
const EXPERTISE_BONUS = 3

export type Attributes = Record<AttributeId, number>

export interface Initiative {
  score: number
  dice: number
}

export interface ConditionMonitor {
  boxes: number
  filled: number
}

export interface SkillPool {
  skill: SkillDef
  /** The character's entry, or undefined when rolled untrained. */
  owned: CharacterSkill | undefined
  rating: number
  attribute: number
  /** Dice before wound modifiers; null when the skill can't be used untrained. */
  pool: number | null
  specializationPool: number | null
  expertisePool: number | null
}

/** One piece of hardware that makes up the persona, and what it contributes. */
export interface PersonaPart {
  name: string
  /** e.g. "Attack/Sleaze", "Data Processing/Firewall". */
  provides: string
}

export interface MatrixStats {
  /** The device whose Device Rating and program slots the persona uses; undefined for a living persona. */
  device: MatrixDevice | undefined
  /** Everything combined into the persona: deck, cyberjack, commlink. Empty for a living persona. */
  parts: PersonaPart[]
  deviceRating: number
  attack: number
  sleaze: number
  dataProcessing: number
  firewall: number
  monitor: number
  arInitiative: Initiative
  coldSimInitiative: Initiative
  hotSimInitiative: Initiative
  /** Matrix initiative bonus printed for the cyberjack (0 without one). */
  cyberjackInitiativeBonus: number
  programSlots: number
  runningPrograms: Program[]
  /** Advice when the hardware doesn't add up, e.g. a deck with nothing giving Data Processing. */
  warnings: string[]
}

export interface DerivedStats {
  /** Attributes after augmentation bonuses and Essence loss. */
  attributes: Attributes
  essence: number
  /** Magic/Resonance points lost to Essence loss. */
  magicLoss: number
  initiative: Initiative
  astralInitiative: Initiative
  physicalMonitor: ConditionMonitor
  stunMonitor: ConditionMonitor
  overflow: ConditionMonitor
  /** Total wound modifier from physical and stun damage (zero or negative). */
  woundModifier: number
  armor: number
  defenseRating: number
  /** Dice pools for common tests, before wound modifiers. */
  pools: {
    defense: number
    damageResistance: number
    /** Damage resistance against Physical damage, with bonuses like bone lacing. */
    physicalDamageResistance: number
    composure: number
    judgeIntentions: number
    memory: number
    liftCarry: number
  }
  unarmedAttackRating: number
  unarmedDamage: { value: number; type: 'P' | 'S' }
  /** Present for awakened characters. */
  magic: {
    spellcasting: number | null
    /** Conjuring + Magic, for summoning and banishing spirits. */
    summoning: number | null
    drainResistance: number | null
    /** Extra drain resistance dice while using the Centering metamagic (0 without it). */
    centeringDice: number
    powerPoints: { available: number; used: number }
  } | null
  /** Present for technomancers. */
  resonance: { tasking: number | null; fadingResistance: number; compileFadingResistance: number } | null
  /** Present when the character has an active device or a living persona. */
  matrix: MatrixStats | null
}

/** Essence in hundredths, from augmentations (with grade multipliers) and other losses. */
function essenceHundredths(character: Character): number {
  const augmentationLoss = character.augmentations.reduce(
    (sum, aug) => sum + Math.round(aug.essence * 100 * AUGMENTATION_GRADES[aug.grade].essence),
    0,
  )
  return 600 - character.essenceLoss - augmentationLoss
}

/** Qualities the character has: bought ones plus the metatype's free racial qualities. */
function allQualities(character: Character): { name: string; rating: number; racial: boolean }[] {
  const racial = METATYPES[character.metatype].qualities.map((q) => ({
    name: q.name,
    rating: q.rating ?? 1,
    racial: true,
  }))
  const bought = character.qualities.map((q) => ({ name: q.name, rating: q.rating, racial: false }))
  // A bought copy of a racial quality (Commlink lists them) replaces the free one.
  const key = (name: string) => name.trim().toLowerCase()
  return [...racial.filter((r) => !bought.some((b) => key(b.name) === key(r.name))), ...bought]
}

const hasQuality = (character: Character, pattern: RegExp) => allQualities(character).some((q) => pattern.test(q.name))

function allBonuses(character: Character): Bonuses[] {
  const fromQualities: Bonuses[] = hasQuality(character, /^dermal deposits/i)
    ? // Dermal Deposits (p. 71): 1 point of natural armor and Physical unarmed damage of (STR/2) + 1.
      [BonusesSchema.parse({ defenseRating: 1, unarmedDamage: 1, unarmedPhysical: true })]
    : []
  return [
    ...character.augmentations.map((a) => a.bonuses),
    ...character.adeptPowers.map((p) => p.bonuses),
    ...fromQualities,
    character.adjustments,
  ]
}

/** Each bonus with where it came from, for showing how a number is made up. */
function namedBonuses(character: Character): { name: string; bonuses: Bonuses }[] {
  return [
    ...character.augmentations.map((a) => ({ name: a.name || 'Augmentation', bonuses: a.bonuses })),
    ...character.adeptPowers.map((p) => ({ name: p.name || 'Adept power', bonuses: p.bonuses })),
    ...(hasQuality(character, /^dermal deposits/i)
      ? [{ name: 'Dermal Deposits', bonuses: BonusesSchema.parse({ defenseRating: 1, unarmedDamage: 1 }) }]
      : []),
    { name: 'Adjustments', bonuses: character.adjustments },
  ]
}

export interface Part {
  label: string
  value: number
}

/**
 * How the numbers players ask about are made up, e.g. Defense Rating =
 * Body 5 + Armor jacket 4 + Dermal Plating 2.
 */
export function explainDerived(character: Character): {
  defenseRating: Part[]
  unarmedAttackRating: Part[]
  physicalBoxes: Part[]
  stunBoxes: Part[]
} {
  const a = effectiveAttributes(character)
  const named = namedBonuses(character)
  const from = (key: 'defenseRating' | 'unarmedAttackRating' | 'physicalBoxes' | 'stunBoxes') =>
    named.filter((n) => n.bonuses[key]).map((n) => ({ label: n.name, value: n.bonuses[key] }))
  const builtTough = builtToughBoxes(character)
  return {
    defenseRating: [
      { label: 'Body', value: a.body },
      ...character.gear.filter((g) => g.equipped && g.armor).map((g) => ({ label: g.name || 'Armor', value: g.armor })),
      ...from('defenseRating'),
    ],
    unarmedAttackRating: [
      { label: 'Reaction', value: a.reaction },
      { label: 'Strength', value: a.strength },
      ...from('unarmedAttackRating'),
    ],
    physicalBoxes: [
      { label: 'Base', value: 8 },
      { label: 'half Body', value: Math.ceil(a.body / 2) },
      ...(builtTough ? [{ label: 'Built Tough', value: builtTough }] : []),
      ...from('physicalBoxes'),
    ],
    stunBoxes: [
      { label: 'Base', value: 8 },
      { label: 'half Willpower', value: Math.ceil(a.willpower / 2) },
      ...from('stunBoxes'),
    ],
  }
}

/** "Body 5 + Armor jacket 4 + Dermal Plating 2" */
export function formatParts(parts: Part[]): string {
  return parts.map((p, i) => `${i && p.value < 0 ? '− ' : i ? '+ ' : ''}${p.label} ${Math.abs(p.value)}`).join(' ')
}

/** Built Tough (p. 70) adds its rank in Physical boxes. */
function builtToughBoxes(character: Character): number {
  return Math.max(
    0,
    ...allQualities(character)
      .filter((q) => /^built tough/i.test(q.name))
      .map((q) => q.rating),
  )
}

/** Attributes with augmentation/adept bonuses (capped) and Magic/Resonance reduced by Essence loss. */
export function effectiveAttributes(character: Character): Attributes {
  const natural = character.attributes
  const bonus = Object.fromEntries(ATTRIBUTE_IDS.map((a) => [a, 0])) as Attributes
  for (const b of allBonuses(character)) {
    for (const [attribute, value] of Object.entries(b.attributes) as [AttributeId, number][]) bonus[attribute] += value
  }
  const loss = magicLoss(character)
  const result = {} as Attributes
  for (const attribute of ATTRIBUTE_IDS) {
    if (attribute === 'magic' || attribute === 'resonance') {
      result[attribute] = natural[attribute] > 0 ? Math.max(0, natural[attribute] - loss) : 0
    } else {
      result[attribute] = natural[attribute] + Math.min(bonus[attribute], SPECIAL_RULES.maxAugmentedBonus)
    }
  }
  return result
}

function magicLoss(character: Character): number {
  const lost = (600 - essenceHundredths(character)) / 100
  if (lost <= 0) return 0
  return SPECIAL_RULES.magicLossRoundsUp ? Math.ceil(lost - 1e-9) : Math.floor(lost)
}

export function computeDerived(character: Character): DerivedStats {
  const a = effectiveAttributes(character)
  const bonuses = allBonuses(character)
  const physicalMonitor = {
    boxes:
      8 + Math.ceil(a.body / 2) + builtToughBoxes(character) + bonuses.reduce((sum, b) => sum + b.physicalBoxes, 0),
    filled: character.damage.physical,
  }
  const stunMonitor = {
    boxes: 8 + Math.ceil(a.willpower / 2) + bonuses.reduce((sum, b) => sum + b.stunBoxes, 0),
    filled: character.damage.stun,
  }
  const armor = character.gear.filter((item) => item.equipped).reduce((sum, item) => sum + item.armor, 0)
  const total = (
    key: 'initiativeDice' | 'defenseRating' | 'physicalResistance' | 'unarmedAttackRating' | 'unarmedDamage',
  ) => bonuses.reduce((sum, b) => sum + b[key], 0)
  const extraDice = total('initiativeDice')

  return {
    attributes: a,
    essence: essenceHundredths(character) / 100,
    magicLoss: magicLoss(character),
    initiative: {
      score: a.reaction + a.intuition,
      dice: Math.min(SPECIAL_RULES.maxInitiativeDice, 1 + extraDice),
    },
    // Astral Combat table (p. 161): Logic + Intuition + 2D6.
    astralInitiative: { score: a.logic + a.intuition, dice: 2 },
    physicalMonitor,
    stunMonitor,
    overflow: { boxes: a.body * 2, filled: character.damage.overflow },
    woundModifier: woundModifier(physicalMonitor.filled) + woundModifier(stunMonitor.filled),
    armor,
    defenseRating: a.body + armor + total('defenseRating'),
    pools: {
      defense: a.reaction + a.intuition,
      damageResistance: a.body,
      physicalDamageResistance: a.body + total('physicalResistance'),
      composure: a.willpower + a.charisma,
      judgeIntentions: a.willpower + a.intuition,
      memory: a.logic + a.intuition,
      liftCarry: a.body + a.willpower,
    },
    unarmedAttackRating: a.reaction + a.strength + total('unarmedAttackRating'),
    // Strength / 2 rounded up, Stun unless something (like bone lacing) makes it Physical.
    unarmedDamage: {
      // Bone lacing's table sets the DV (p. 288); otherwise Strength ÷ 2 rounded up (p. 110), plus bonuses.
      value:
        Math.max(0, ...bonuses.map((b) => b.unarmedDamageSet)) || Math.ceil(a.strength / 2) + total('unarmedDamage'),
      type: bonuses.some((b) => b.unarmedPhysical) ? 'P' : 'S',
    },
    magic: character.attributes.magic > 0 ? magicStats(character, a) : null,
    resonance:
      character.attributes.resonance > 0
        ? {
            tasking: ownedPool(character, a, 'tasking'),
            fadingResistance: a.willpower + a[SPECIAL_RULES.fadingAttribute],
            // Fading from compiling or registering a sprite is resisted with Willpower + Charisma (p. 191).
            compileFadingResistance: a.willpower + a.charisma,
          }
        : null,
    matrix: matrixStats(character, a),
  }
}

function magicStats(character: Character, a: Attributes): NonNullable<DerivedStats['magic']> {
  const drainAttribute = TRADITIONS[character.tradition].drainAttribute
  const isMysticAdept = character.build ? character.build.magicType === 'mysticAdept' : character.powerPointsBought > 0
  return {
    spellcasting: ownedPool(character, a, 'sorcery'),
    summoning: ownedPool(character, a, 'conjuring'),
    drainResistance: drainAttribute ? a.willpower + a[drainAttribute] : null,
    centeringDice: gradeEffects(character).centeringDice,
    powerPoints: {
      // The Power Point metamagic adds one each time it's taken (p. 168).
      available: (isMysticAdept ? character.powerPointsBought : a.magic) + gradeEffects(character).extraPowerPoints,
      used: Math.round(character.adeptPowers.reduce((sum, p) => sum + p.powerPoints, 0) * 100) / 100,
    },
  }
}

const MATRIX_KEYS = ['attack', 'sleaze', 'dataProcessing', 'firewall'] as const

/**
 * The persona is built from every active device: a cyberdeck brings Attack and
 * Sleaze, a cyberjack (or commlink) Data Processing and Firewall. Each attribute
 * comes from whichever piece has the highest. Device Rating and program slots
 * are the deck's, or the main device's without one.
 */
function matrixStats(character: Character, a: Attributes): MatrixStats | null {
  const active = character.matrixDevices.filter((d) => d.active)
  const jacks = [
    ...active
      .filter((d) => d.kind === 'cyberjack')
      .map((d) => ({ ...d, initiativeBonus: cyberjackStats(d.dataProcessing - 3).initiativeBonus })),
    ...character.augmentations
      .filter((aug) => isCyberjackName(aug.name))
      .map((aug) => {
        const stats = cyberjackStats(ratingFromName(aug.name, aug.rating))
        return { name: aug.name, attack: 0, sleaze: 0, ...stats }
      }),
  ]
  const devices = active.filter((d) => d.kind !== 'cyberjack')
  const byRating = (x: MatrixDevice, y: MatrixDevice) => y.deviceRating - x.deviceRating
  const main = devices.filter((d) => d.kind === 'cyberdeck').sort(byRating)[0] ?? [...devices].sort(byRating)[0]
  const running = character.programs.filter((p) => p.running)
  const has = (name: string) => running.some((p) => p.name.trim().toLowerCase() === name)
  const warnings: string[] = []

  let persona: Pick<MatrixStats, 'device' | 'parts' | 'deviceRating' | (typeof MATRIX_KEYS)[number]>
  // A technomancer's commlink is just a phone; they hack with their living persona.
  const living = a.resonance > 0 && jacks.length === 0 && (!main || main.kind === 'commlink')
  if (!living && (main || jacks.length > 0)) {
    const pieces = [...devices, ...jacks]
    const best = (key: (typeof MATRIX_KEYS)[number]) => Math.max(0, ...pieces.map((p) => p[key]))
    persona = {
      device: main,
      parts: pieces.map((p) => ({
        name: p.name || 'Unnamed device',
        provides: MATRIX_KEYS.filter((k) => p[k] > 0 && p[k] === best(k))
          .map((k) => MATRIX_LABELS[k])
          .join(', '),
      })),
      deviceRating: main?.deviceRating ?? Math.max(...jacks.map((j) => j.dataProcessing - 3)),
      attack: best('attack'),
      sleaze: best('sleaze'),
      dataProcessing: best('dataProcessing'),
      firewall: best('firewall'),
    }
    if (main?.kind === 'cyberdeck' && persona.dataProcessing === 0 && persona.firewall === 0) {
      warnings.push(
        'A cyberdeck has no Data Processing or Firewall. Add a cyberjack (as an augmentation or a device) or make a commlink active too.',
      )
    }
    if (!main) warnings.push('A cyberjack needs a cyberdeck or commlink to get online. Make one active.')
  } else if (living) {
    // Living persona.
    persona = {
      device: undefined,
      parts: [],
      deviceRating: a.resonance,
      // Matrix Attribute Upgrade echoes add to the living persona (p. 195).
      attack: a.charisma + gradeEffects(character).persona.attack,
      sleaze: a.intuition + gradeEffects(character).persona.sleaze,
      dataProcessing: a.logic + gradeEffects(character).persona.dataProcessing,
      firewall: a.willpower + gradeEffects(character).persona.firewall,
    }
  } else {
    return null
  }
  if (has('toolbox')) persona.dataProcessing += TOOLBOX_DATA_PROCESSING
  const programSlots = (persona.device?.programSlots ?? 0) + (has('virtual machine') ? VIRTUAL_MACHINE_SLOTS : 0)
  if (persona.device && running.length > programSlots) {
    warnings.push(`${running.length} programs are running but only ${programSlots} fit. Stop some of them.`)
  }
  const vrScore = persona.dataProcessing + a.intuition
  return {
    ...persona,
    monitor: SPECIAL_RULES.matrixMonitorBase + Math.ceil(persona.deviceRating / 2),
    arInitiative: { score: a.reaction + a.intuition, dice: 1 },
    coldSimInitiative: { score: vrScore, dice: SPECIAL_RULES.vrColdDice },
    // Overclocking (an echo) adds a die in hot-sim (p. 195).
    hotSimInitiative: {
      score: vrScore,
      dice: Math.min(
        SPECIAL_RULES.maxInitiativeDice,
        SPECIAL_RULES.vrHotDice + (living ? gradeEffects(character).hotSimDice : 0),
      ),
    },
    cyberjackInitiativeBonus: Math.max(0, ...jacks.map((j) => j.initiativeBonus)),
    programSlots,
    runningPrograms: running,
    warnings,
  }
}

export const MATRIX_LABELS: Record<(typeof MATRIX_KEYS)[number], string> = {
  attack: 'Attack',
  sleaze: 'Sleaze',
  dataProcessing: 'Data Processing',
  firewall: 'Firewall',
}

function woundModifier(filledBoxes: number): number {
  return 0 - Math.floor(Math.max(0, filledBoxes) / BOXES_PER_WOUND_STEP)
}

function skillPool(attributes: Attributes, skill: SkillDef, owned: CharacterSkill | undefined): SkillPool {
  const attribute = attributes[skill.attribute]
  const rating = owned?.rating ?? 0
  let pool: number | null
  if (rating > 0) pool = rating + attribute
  else if (skill.untrained) pool = Math.max(0, attribute - 1)
  else pool = null

  const withBonus = (text: string | undefined, bonus: number) =>
    pool !== null && rating > 0 && text?.trim() ? pool + bonus : null

  return {
    skill,
    owned,
    rating,
    attribute,
    pool,
    specializationPool: withBonus(owned?.specialization, SPECIALIZATION_BONUS),
    expertisePool: withBonus(owned?.expertise, EXPERTISE_BONUS),
  }
}

/** Pool for a skill by id, or null if the character can't roll it. */
function ownedPool(character: Character, attributes: Attributes, skillId: string): number | null {
  const skill = SKILLS_BY_ID.get(skillId)
  if (!skill) return null
  return skillPool(
    attributes,
    skill,
    character.skills.find((s) => s.skillId === skillId),
  ).pool
}

/** Pools for the character's own skills, in the order they were added. */
export function ownedSkillPools(character: Character): SkillPool[] {
  const attributes = effectiveAttributes(character)
  return character.skills.flatMap((owned) => {
    const skill = SKILLS_BY_ID.get(owned.skillId)
    return skill ? [skillPool(attributes, skill, owned)] : []
  })
}

/** Pools for skills the character doesn't have but could roll untrained. */
export function untrainedSkillPools(character: Character): SkillPool[] {
  const attributes = effectiveAttributes(character)
  const owned = new Set(character.skills.map((s) => s.skillId))
  return SKILLS.filter((s) => s.untrained && !owned.has(s.id)).map((s) => skillPool(attributes, s, undefined))
}

export interface WeaponPool {
  /** Dice before wound modifiers; null when the skill can't be used untrained. */
  pool: number | null
  /** Bonus included in `pool` from a matching specialization (+2) or expertise (+3). */
  bonus: number
}

/** Attack pool for a weapon: its skill + attribute, plus a matching specialization or expertise. */
export function weaponPool(character: Character, weapon: Weapon): WeaponPool {
  const skill = SKILLS_BY_ID.get(weapon.skillId)
  if (!skill) return { pool: null, bonus: 0 }
  const owned = character.skills.find((s) => s.skillId === skill.id)
  const base = skillPool(effectiveAttributes(character), skill, owned)
  if (base.pool === null) return { pool: null, bonus: 0 }

  const matches = (text: string | undefined) => specializationCovers(text ?? '', weapon.specialization)
  let bonus = 0
  if (base.expertisePool !== null && matches(owned?.expertise)) bonus = EXPERTISE_BONUS
  else if (base.specializationPool !== null && matches(owned?.specialization)) bonus = SPECIALIZATION_BONUS
  return { pool: base.pool + bonus, bonus }
}

/** Singular, lower-case words: "Heavy Pistols" → ["heavy", "pistol"]. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
}

/**
 * Whether a skill specialization applies to a weapon's category: exact match,
 * or every word of the specialization appears in the category, so "Rifles"
 * covers "Assault Rifles" and "Pistols" covers "Heavy Pistols".
 */
export function specializationCovers(specialization: string, weaponCategory: string): boolean {
  const spec = words(specialization)
  const category = words(weaponCategory)
  return spec.length > 0 && category.length > 0 && spec.every((w) => category.includes(w))
}
