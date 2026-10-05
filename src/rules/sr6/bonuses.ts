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
    const dice = part.match(/^\+?\s*(\d+)\s*D6(?:\s*INIT(?:IATIVE)?)?$/) ?? part.match(/^(?:ID|INIT(?:IATIVE)?(?: DICE)?)\s*\+?\s*(\d+)$/)
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
