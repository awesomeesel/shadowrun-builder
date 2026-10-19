import { BonusesSchema, type Bonuses } from '../../model/character'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS, type AttributeId } from './attributes'

/** Attributes by full name or three-letter abbreviation, upper case. */
const BY_NAME = new Map(
  ATTRIBUTE_IDS.flatMap((a) => [
    [ATTRIBUTE_LABELS[a].short, a],
    [ATTRIBUTE_LABELS[a].name.toUpperCase(), a],
  ]),
)

export const noBonuses = (): Bonuses => BonusesSchema.parse({})

/** Bonuses that aren't attributes, with the words that can name them in bonus text. */
const OTHER_BONUSES = [
  { key: 'defenseRating', label: 'Defense Rating', names: ['DEFENSE RATING', 'DEFENSE', 'DR'] },
  {
    key: 'physicalResistance',
    label: 'Physical damage resistance',
    names: ['PHYSICAL DAMAGE RESISTANCE', 'PHYSICAL RESISTANCE', 'DAMAGE RESISTANCE', 'SOAK'],
  },
  {
    key: 'unarmedAttackRating',
    label: 'Unarmed attack rating',
    names: ['UNARMED ATTACK RATING', 'UNARMED AR'],
  },
  { key: 'unarmedDamage', label: 'Unarmed damage', names: ['UNARMED DAMAGE', 'UNARMED DV'] },
  {
    key: 'physicalBoxes',
    label: 'Physical boxes',
    names: ['PHYSICAL BOXES', 'PHYSICAL CONDITION MONITOR', 'PHYSICAL MONITOR', 'PHYSICAL CM'],
  },
  { key: 'stunBoxes', label: 'Stun boxes', names: ['STUN BOXES', 'STUN CONDITION MONITOR', 'STUN MONITOR', 'STUN CM'] },
] as const

/** The non-attribute bonuses with their labels, for editors. */
export const BONUS_KINDS = OTHER_BONUSES.map(({ key, label }) => ({ key, label }))

/**
 * Parse bonus text like "Reaction +2, Agility +1, +2D6, Defense Rating +1,
 * Unarmed physical" (abbreviations like "REA +2" work too). Returns undefined
 * if any part can't be understood, so the input can flag it.
 */
export function parseBonuses(text: string): Bonuses | undefined {
  const result = noBonuses()
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
    // "Unarmed DV 4P": the DV becomes 4 and Physical (no sign, unlike "Unarmed DV +1").
    const setDv = part.match(/^UNARMED (?:DV|DAMAGE) (\d+)\s*P?$/)
    if (setDv) {
      result.unarmedDamageSet = parseInt(setDv[1], 10)
      if (part.endsWith('P')) result.unarmedPhysical = true
      continue
    }
    if (/^UNARMED (PHYSICAL|DAMAGE IS PHYSICAL|P)$/.test(part)) {
      result.unarmedPhysical = true
      continue
    }
    const other = part.match(/^([A-Z][A-Z ]*?)\s*([+-])\s*(\d+)$/)
    const otherBonus = other && OTHER_BONUSES.find((b) => (b.names as readonly string[]).includes(other[1]))
    if (other && otherBonus) {
      result[otherBonus.key] += parseInt(other[3], 10) * (other[2] === '-' ? -1 : 1)
      continue
    }
    const attr = part.match(/^([A-Z]+)\s*([+-])\s*(\d+)$/)
    const id: AttributeId | undefined = attr ? BY_NAME.get(attr[1]) : undefined
    if (!attr || !id) return undefined
    const value = parseInt(attr[3], 10) * (attr[2] === '-' ? -1 : 1)
    result.attributes[id] = (result.attributes[id] ?? 0) + value
  }
  return result
}

export function formatBonuses(bonuses: Bonuses): string {
  const parts = ATTRIBUTE_IDS.flatMap((a) => {
    const value = bonuses.attributes[a]
    return value ? [`${ATTRIBUTE_LABELS[a].name} ${value > 0 ? '+' : ''}${value}`] : []
  })
  if (bonuses.initiativeDice) parts.push(`+${bonuses.initiativeDice}D6`)
  for (const { key, label } of OTHER_BONUSES) {
    if (bonuses[key]) parts.push(`${label} ${bonuses[key] > 0 ? '+' : ''}${bonuses[key]}`)
  }
  if (bonuses.unarmedDamageSet)
    parts.push(`Unarmed DV ${bonuses.unarmedDamageSet}${bonuses.unarmedPhysical ? 'P' : ''}`)
  else if (bonuses.unarmedPhysical) parts.push('Unarmed physical')
  return parts.join(', ')
}

/**
 * Bonuses of well-known implants and powers that rulebook tables don't list.
 * Each entry also names the attribute it raises, so an importer can work out
 * the rating from how much that attribute went up. Checked against the Core Rulebook (pp. 157, 287–293).
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

/** Implants whose bonuses are fixed or simply scale with rating (Core Rulebook, bodyware). */
const FIXED_BONUSES: { pattern: RegExp; bonuses: (rating: number) => Partial<Bonuses> }[] = [
  // Bone Lacing table: physical resistance, Defense Rating, unarmed DV, unarmed AR.
  {
    pattern: /^bone lacing\s*\(?plastic/i,
    bonuses: () => ({ physicalResistance: 1, defenseRating: 1, unarmedDamageSet: 3, unarmedAttackRating: 1 }),
  },
  {
    pattern: /^bone lacing\s*\(?alumin/i,
    bonuses: () => ({ physicalResistance: 2, defenseRating: 1, unarmedDamageSet: 4, unarmedAttackRating: 2 }),
  },
  {
    pattern: /^bone lacing\s*\(?titanium/i,
    bonuses: () => ({ physicalResistance: 2, defenseRating: 2, unarmedDamageSet: 4, unarmedAttackRating: 3 }),
  },
  // Dermal plating: Defense Rating equal to its rating.
  { pattern: /^dermal plating/i, bonuses: (r) => ({ defenseRating: r }) },
]

/** The attribute a well-known implant or power raises, if we know it. */
export function knownBonusAttribute(name: string): AttributeId | undefined {
  return KNOWN_BONUSES.find((k) => k.pattern.test(name.trim()))?.attribute
}

/** Bonuses for a well-known implant or power at a rating (or the number at the end of its name). */
export function knownBonuses(name: string, rating: number): Bonuses {
  const r = Math.max(1, rating || parseInt(name.match(/(\d+)\s*$/)?.[1] ?? '1', 10))
  const fixed = FIXED_BONUSES.find((k) => k.pattern.test(name.trim()))
  if (fixed) {
    const bonuses = fixed.bonuses(r)
    // Bone lacing makes unarmed attacks deal Physical damage.
    return BonusesSchema.parse({ ...bonuses, unarmedPhysical: /^bone lacing/i.test(name.trim()) })
  }
  const known = KNOWN_BONUSES.find((k) => k.pattern.test(name.trim()))
  if (!known) return noBonuses()
  return BonusesSchema.parse({
    attributes: { [known.attribute]: r },
    initiativeDice: known.dicePerRating ? r : 0,
  })
}
