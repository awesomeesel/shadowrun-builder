/**
 * What's in a dice pool, and pools put together on the spot. Most tests are a
 * skill plus its usual attribute, but the GM can call for another pairing
 * ("Athletics + Strength") or two attributes ("Logic + Willpower"). An
 * untrained skill counts as its attribute − 1, and some skills can't be used
 * untrained at all.
 */
import type { Character } from '../../model/character'
import { ATTRIBUTE_LABELS, type AttributeId } from './attributes'
import { effectiveAttributes, type SkillPool } from './derived'
import { SKILLS_BY_ID } from './skills'

const name = (a: AttributeId) => ATTRIBUTE_LABELS[a].name

/** "Firearms 6 + Agility 6", or "Agility 6 − 1 (untrained)". */
export function skillFormula(pool: SkillPool): string {
  const attribute = `${name(pool.skill.attribute)} ${pool.attribute}`
  return pool.rating > 0 ? `${pool.skill.name} ${pool.rating} + ${attribute}` : `${attribute} − 1 (untrained)`
}

/** "Willpower 4 + Charisma 3", from the character's current attributes. */
export function pairFormula(character: Character, a: AttributeId, b: AttributeId): string {
  const values = effectiveAttributes(character)
  return `${name(a)} ${values[a]} + ${name(b)} ${values[b]}`
}

/** The first half of a combined pool: a skill, or an attribute on its own. */
export type FirstPart = { kind: 'skill'; id: string } | { kind: 'attribute'; id: AttributeId }

export interface Combined {
  /** Dice before wound modifiers; null when it can't be rolled (a skill that needs training). */
  pool: number | null
  /** "Athletics 4 + Strength 5 + 2 (Climbing)". */
  formula: string
  /** Why it can't be rolled. */
  reason?: string
}

export function combinePool(
  character: Character,
  first: FirstPart,
  second: AttributeId | null,
  bonus: { specialization?: boolean; expertise?: boolean } = {},
): Combined {
  const values = effectiveAttributes(character)
  const secondPart = second ? { value: values[second], text: `${name(second)} ${values[second]}` } : null
  if (first.kind === 'attribute') {
    const parts = [`${name(first.id)} ${values[first.id]}`, ...(secondPart ? [secondPart.text] : [])]
    return { pool: values[first.id] + (secondPart?.value ?? 0), formula: parts.join(' + ') }
  }
  const skill = SKILLS_BY_ID.get(first.id)
  if (!skill) return { pool: null, formula: '', reason: 'Unknown skill' }
  const owned = character.skills.find((s) => s.skillId === first.id)
  const rating = owned?.rating ?? 0
  const attribute = secondPart ?? {
    value: values[skill.attribute],
    text: `${name(skill.attribute)} ${values[skill.attribute]}`,
  }
  if (rating === 0) {
    if (!skill.untrained) return { pool: null, formula: '', reason: `${skill.name} can’t be used untrained` }
    return { pool: Math.max(0, attribute.value - 1), formula: `${attribute.text} − 1 (untrained ${skill.name})` }
  }
  const extras: string[] = []
  let pool = rating + attribute.value
  if (bonus.expertise && owned?.expertise.trim()) {
    pool += 3
    extras.push(`+ 3 (${owned.expertise.trim()})`)
  } else if (bonus.specialization && owned?.specialization.trim()) {
    pool += 2
    extras.push(`+ 2 (${owned.specialization.trim()})`)
  }
  return { pool, formula: [`${skill.name} ${rating} + ${attribute.text}`, ...extras].join(' ') }
}
