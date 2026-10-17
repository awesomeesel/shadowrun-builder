/**
 * Healing (Core Rulebook pp. 119–121): first aid, medkits and healing magic
 * against a threshold of 5 − Essence, then natural recovery with rest.
 * Overflow always heals first.
 */
import type { Character } from '../../model/character'
import { computeDerived } from './derived'
import { rollPool, type Roll } from './play'

export type Treatment = 'firstAid' | 'medkit' | 'magic'

export const TREATMENTS: Record<Treatment, { name: string; test: string; window: string }> = {
  firstAid: { name: 'First aid', test: 'Biotech + Logic', window: 'within 1 minute of the fight' },
  medkit: { name: 'Medkit', test: 'Biotech + Logic', window: 'within 1 hour of the fight' },
  magic: { name: 'Healing magic', test: 'Sorcery + Magic (Heal spell)', window: 'any time' },
}

/** First aid without a kit is −2 dice (p. 119). */
export const NO_KIT_PENALTY = -2
/** A Biotech-trained helper watching over the rest gives +2 dice (p. 120). */
export const MEDICAL_CARE_BONUS = 2

export interface Damage {
  physical: number
  stun: number
  overflow: number
}

/**
 * Threshold for treating the patient: 5 − Essence (rounded up, never below 0).
 * A fully natural patient (Essence 6) also gives the healer one free hit.
 */
export function treatmentThreshold(essence: number): { threshold: number; freeHit: boolean } {
  return { threshold: Math.max(0, Math.ceil(5 - essence - 1e-9)), freeHit: essence >= 6 }
}

/** The character's own dice for a treatment, or null without the skill. */
export function treatmentPool(character: Character, treatment: Treatment): number | null {
  const d = computeDerived(character)
  if (treatment === 'magic') return d.magic?.spellcasting ?? null
  const biotech = character.skills.find((s) => s.skillId === 'biotech')
  return biotech ? biotech.rating + d.attributes.logic : null
}

/**
 * Turn hits above the threshold into healed boxes. Overflow goes first; then
 * Physical or Stun, whichever the player prefers. First aid heals a Stun box
 * per hit but needs 2 hits per Physical or Overflow box (p. 119).
 */
export function spendHealing(
  damage: Damage,
  hits: number,
  treatment: Treatment,
  prefer: 'physical' | 'stun' = 'physical',
): Damage {
  const physicalCost = treatment === 'firstAid' ? 2 : 1
  let left = Math.max(0, hits)
  const healed: Damage = { physical: 0, stun: 0, overflow: 0 }
  const take = (kind: keyof Damage, cost: number) => {
    const boxes = Math.min(damage[kind], Math.floor(left / cost))
    healed[kind] = boxes
    left -= boxes * cost
  }
  take('overflow', physicalCost)
  if (prefer === 'physical') {
    take('physical', physicalCost)
    take('stun', 1)
  } else {
    take('stun', 1)
    take('physical', physicalCost)
  }
  return healed
}

export function heal(character: Character, healed: Damage): Character {
  const { physical, stun, overflow } = character.damage
  return {
    ...character,
    damage: {
      ...character.damage,
      physical: Math.max(0, physical - healed.physical),
      stun: Math.max(0, stun - healed.stun),
      overflow: Math.max(0, overflow - healed.overflow),
    },
  }
}

export interface RestResult {
  rolls: Roll[]
  healed: Damage
  /** Hours (Stun) or days (Physical) actually needed. */
  periods: number
}

/**
 * Natural recovery: Body + Willpower once per hour for Stun, Body + Body once per
 * day for Physical (Overflow first, with wound modifiers). Each hit heals a box.
 * Stops early when everything of that kind is healed.
 */
export function rest(
  character: Character,
  kind: 'stun' | 'physical',
  periods: number,
  medicalCare: boolean,
  random?: () => number,
): RestResult {
  const d = computeDerived(character)
  const a = d.attributes
  const bonus = medicalCare ? MEDICAL_CARE_BONUS : 0
  const left = { ...character.damage }
  const healed: Damage = { physical: 0, stun: 0, overflow: 0 }
  const rolls: Roll[] = []
  for (let i = 0; i < periods; i++) {
    if (kind === 'stun' ? left.stun === 0 : left.physical + left.overflow === 0) break
    if (kind === 'stun') {
      const roll = rollPool(a.body + a.willpower + bonus, random)
      rolls.push(roll)
      const boxes = Math.min(left.stun, roll.hits)
      left.stun -= boxes
      healed.stun += boxes
    } else {
      // Overflow heals first, and wound modifiers apply while there is any (p. 121).
      const wounds = left.overflow > 0 ? d.woundModifier : 0
      const roll = rollPool(Math.max(0, a.body * 2 + bonus + wounds), random)
      rolls.push(roll)
      let hits = roll.hits
      const fromOverflow = Math.min(left.overflow, hits)
      left.overflow -= fromOverflow
      healed.overflow += fromOverflow
      hits -= fromOverflow
      const fromPhysical = Math.min(left.physical, hits)
      left.physical -= fromPhysical
      healed.physical += fromPhysical
    }
  }
  return { rolls, healed, periods: rolls.length }
}
