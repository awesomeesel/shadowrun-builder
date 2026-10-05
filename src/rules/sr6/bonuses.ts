import type { Bonuses } from '../../model/character'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS, type AttributeId } from './attributes'

const BY_SHORT = new Map(ATTRIBUTE_IDS.map((a) => [ATTRIBUTE_LABELS[a].short, a]))

/**
 * Parse bonus text like "REA +2, AGI +1, +2D6". Returns undefined if any part
 * can't be understood, so the input can flag it.
 */
export function parseBonuses(text: string): Bonuses | undefined {
  const result: Bonuses = { attributes: {}, initiativeDice: 0 }
  for (const raw of text.split(/[,;]/)) {
    const part = raw.trim().toUpperCase()
    if (!part) continue
    const dice =
      part.match(/^\+?\s*(\d+)\s*D6(?:\s*INIT(?:IATIVE)?)?$/) ??
      part.match(/^(?:ID|INIT(?:IATIVE)?(?: DICE)?)\s*\+?\s*(\d+)$/)
    if (dice) {
      result.initiativeDice += parseInt(dice[1], 10)
      continue
    }
    const attr = part.match(/^([A-Z]{3})\s*([+-])\s*(\d+)$/)
    const id: AttributeId | undefined = attr ? BY_SHORT.get(attr[1]) : undefined
    if (!attr || !id) return undefined
    const value = parseInt(attr[3], 10) * (attr[2] === '-' ? -1 : 1)
    result.attributes[id] = (result.attributes[id] ?? 0) + value
  }
  return result
}

export function formatBonuses(bonuses: Bonuses): string {
  const parts = ATTRIBUTE_IDS.flatMap((a) => {
    const value = bonuses.attributes[a]
    return value ? [`${ATTRIBUTE_LABELS[a].short} ${value > 0 ? '+' : ''}${value}`] : []
  })
  if (bonuses.initiativeDice) parts.push(`+${bonuses.initiativeDice}D6`)
  return parts.join(', ')
}

/**
 * Bonuses of well-known implants and powers that rulebook tables don't list.
 * Each entry also names the attribute it raises, so an importer can work out
 * the rating from how much that attribute went up. VERIFY against the Core Rulebook.
 */
const KNOWN_BONUSES: { pattern: RegExp; attribute: AttributeId; dicePerRating: boolean }[] = [
  { pattern: /^wired reflexes/i, attribute: 'reaction', dicePerRating: true },
  { pattern: /^synaptic booster/i, attribute: 'reaction', dicePerRating: true },
  { pattern: /^reaction enhancers?/i, attribute: 'reaction', dicePerRating: false },
  { pattern: /^muscle toner/i, attribute: 'agility', dicePerRating: false },
  { pattern: /^muscle augmentation/i, attribute: 'strength', dicePerRating: false },
  { pattern: /^cerebral booster/i, attribute: 'logic', dicePerRating: false },
  { pattern: /^improved reflexes/i, attribute: 'reaction', dicePerRating: true },
]

/** The attribute a well-known implant or power raises, if we know it. */
export function knownBonusAttribute(name: string): AttributeId | undefined {
  return KNOWN_BONUSES.find((k) => k.pattern.test(name.trim()))?.attribute
}

/** Bonuses for a well-known implant or power at a rating (or the number at the end of its name). */
export function knownBonuses(name: string, rating: number): Bonuses {
  const r = Math.max(1, rating || parseInt(name.match(/(\d+)\s*$/)?.[1] ?? '1', 10))
  const known = KNOWN_BONUSES.find((k) => k.pattern.test(name.trim()))
  if (!known) return { attributes: {}, initiativeDice: 0 }
  return { attributes: { [known.attribute]: r }, initiativeDice: known.dicePerRating ? r : 0 }
}
