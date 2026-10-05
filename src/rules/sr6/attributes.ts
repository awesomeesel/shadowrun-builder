export const PHYSICAL_ATTRIBUTES = ['body', 'agility', 'reaction', 'strength'] as const
export const MENTAL_ATTRIBUTES = ['willpower', 'logic', 'intuition', 'charisma'] as const
export const SPECIAL_ATTRIBUTES = ['edge', 'magic', 'resonance'] as const

export const ATTRIBUTE_IDS = [
  ...PHYSICAL_ATTRIBUTES,
  ...MENTAL_ATTRIBUTES,
  ...SPECIAL_ATTRIBUTES,
] as const

export type AttributeId = (typeof ATTRIBUTE_IDS)[number]

export const ATTRIBUTE_LABELS: Record<AttributeId, { name: string; short: string }> = {
  body: { name: 'Body', short: 'BOD' },
  agility: { name: 'Agility', short: 'AGI' },
  reaction: { name: 'Reaction', short: 'REA' },
  strength: { name: 'Strength', short: 'STR' },
  willpower: { name: 'Willpower', short: 'WIL' },
  logic: { name: 'Logic', short: 'LOG' },
  intuition: { name: 'Intuition', short: 'INT' },
  charisma: { name: 'Charisma', short: 'CHA' },
  edge: { name: 'Edge', short: 'EDG' },
  magic: { name: 'Magic', short: 'MAG' },
  resonance: { name: 'Resonance', short: 'RES' },
}
