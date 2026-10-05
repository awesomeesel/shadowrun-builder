import type { Character, CharacterSkill } from '../../model/character'
import { SKILLS, SKILLS_BY_ID, type SkillDef } from './skills'

/** Damage boxes per wound modifier step (-1 for every 3 boxes filled). */
const BOXES_PER_WOUND_STEP = 3
const SPECIALIZATION_BONUS = 2
const EXPERTISE_BONUS = 3

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

export interface DerivedStats {
  essence: number
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
    composure: number
    judgeIntentions: number
    memory: number
    liftCarry: number
  }
  unarmedAttackRating: number
}

export function computeDerived(character: Character): DerivedStats {
  const a = character.attributes
  const physicalMonitor = { boxes: 8 + Math.ceil(a.body / 2), filled: character.damage.physical }
  const stunMonitor = { boxes: 8 + Math.ceil(a.willpower / 2), filled: character.damage.stun }
  const armor = character.gear
    .filter((item) => item.equipped && item.armor)
    .reduce((sum, item) => sum + (item.armor ?? 0), 0)

  return {
    essence: (600 - character.essenceLoss) / 100,
    initiative: { score: a.reaction + a.intuition, dice: 1 },
    astralInitiative: { score: a.intuition * 2, dice: 2 },
    physicalMonitor,
    stunMonitor,
    // TODO: verify overflow box count against the SR6 Core Rulebook.
    overflow: { boxes: a.body * 2, filled: character.damage.overflow },
    woundModifier: woundModifier(physicalMonitor.filled) + woundModifier(stunMonitor.filled),
    armor,
    defenseRating: a.body + armor,
    pools: {
      defense: a.reaction + a.intuition,
      damageResistance: a.body,
      composure: a.willpower + a.charisma,
      judgeIntentions: a.willpower + a.intuition,
      memory: a.logic + a.intuition,
      liftCarry: a.body + a.willpower,
    },
    unarmedAttackRating: a.reaction + a.strength,
  }
}

function woundModifier(filledBoxes: number): number {
  return 0 - Math.floor(Math.max(0, filledBoxes) / BOXES_PER_WOUND_STEP)
}

function skillPool(character: Character, skill: SkillDef, owned: CharacterSkill | undefined): SkillPool {
  const attribute = character.attributes[skill.attribute]
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

/** Pools for the character's own skills, in the order they were added. */
export function ownedSkillPools(character: Character): SkillPool[] {
  return character.skills.flatMap((owned) => {
    const skill = SKILLS_BY_ID.get(owned.skillId)
    return skill ? [skillPool(character, skill, owned)] : []
  })
}

/** Pools for skills the character doesn't have but could roll untrained. */
export function untrainedSkillPools(character: Character): SkillPool[] {
  const owned = new Set(character.skills.map((s) => s.skillId))
  return SKILLS.filter((s) => s.untrained && !owned.has(s.id)).map((s) => skillPool(character, s, undefined))
}
