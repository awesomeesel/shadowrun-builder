import type { Bonuses, Character, CharacterSkill, MatrixDevice, Program, Weapon } from '../../model/character'
import { ATTRIBUTE_IDS, type AttributeId } from './attributes'
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
    drainResistance: number | null
    powerPoints: { available: number; used: number }
  } | null
  /** Present for technomancers. */
  resonance: { tasking: number | null; fadingResistance: number } | null
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

function allBonuses(character: Character): Bonuses[] {
  return [...character.augmentations.map((a) => a.bonuses), ...character.adeptPowers.map((p) => p.bonuses)]
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
  const physicalMonitor = { boxes: 8 + Math.ceil(a.body / 2), filled: character.damage.physical }
  const stunMonitor = { boxes: 8 + Math.ceil(a.willpower / 2), filled: character.damage.stun }
  const armor = character.gear.filter((item) => item.equipped).reduce((sum, item) => sum + item.armor, 0)
  const bonuses = allBonuses(character)
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
    // Logic + Intuition, matching Commlink's calculation. VERIFY against the Core Rulebook.
    astralInitiative: { score: a.logic + a.intuition, dice: 2 },
    physicalMonitor,
    stunMonitor,
    // TODO: verify overflow box count against the SR6 Core Rulebook.
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
      value: Math.ceil(a.strength / 2) + total('unarmedDamage'),
      type: bonuses.some((b) => b.unarmedPhysical) ? 'P' : 'S',
    },
    magic: character.attributes.magic > 0 ? magicStats(character, a) : null,
    resonance:
      character.attributes.resonance > 0
        ? {
            tasking: ownedPool(character, a, 'tasking'),
            fadingResistance: a.willpower + a[SPECIAL_RULES.fadingAttribute],
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
    drainResistance: drainAttribute ? a.willpower + a[drainAttribute] : null,
    powerPoints: {
      available: isMysticAdept ? character.powerPointsBought : a.magic,
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
  if (main || jacks.length > 0) {
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
  } else if (a.resonance > 0) {
    // Living persona.
    persona = {
      device: undefined,
      parts: [],
      deviceRating: a.resonance,
      attack: a.charisma,
      sleaze: a.intuition,
      dataProcessing: a.logic,
      firewall: a.willpower,
    }
  } else {
    return null
  }
  if (has('toolbox')) persona.dataProcessing += TOOLBOX_DATA_PROCESSING
  const programSlots = (main?.programSlots ?? 0) + (has('virtual machine') ? VIRTUAL_MACHINE_SLOTS : 0)
  if (main && running.length > programSlots) {
    warnings.push(`${running.length} programs are running but only ${programSlots} fit. Stop some of them.`)
  }
  const vrScore = persona.dataProcessing + a.intuition
  return {
    ...persona,
    monitor: SPECIAL_RULES.matrixMonitorBase + Math.ceil(persona.deviceRating / 2),
    arInitiative: { score: a.reaction + a.intuition, dice: 1 },
    coldSimInitiative: { score: vrScore, dice: SPECIAL_RULES.vrColdDice },
    hotSimInitiative: { score: vrScore, dice: SPECIAL_RULES.vrHotDice },
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
