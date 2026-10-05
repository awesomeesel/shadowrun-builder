import type { AttributeId } from './attributes'

export const METATYPE_IDS = ['human', 'dwarf', 'elf', 'ork', 'troll'] as const
export type MetatypeId = (typeof METATYPE_IDS)[number]

export interface MetatypeDef {
  id: MetatypeId
  name: string
  /** Attribute maximums that differ from the default of 6. Minimum is always 1. */
  maximums: Partial<Record<AttributeId, number>>
}

// TODO: verify maximums against the SR6 Core Rulebook metatype table.
export const METATYPES: Record<MetatypeId, MetatypeDef> = {
  human: { id: 'human', name: 'Human', maximums: { edge: 7 } },
  dwarf: { id: 'dwarf', name: 'Dwarf', maximums: { body: 7, reaction: 5, strength: 8, willpower: 7 } },
  elf: { id: 'elf', name: 'Elf', maximums: { agility: 7, charisma: 8 } },
  ork: { id: 'ork', name: 'Ork', maximums: { body: 8, strength: 8, charisma: 5 } },
  troll: { id: 'troll', name: 'Troll', maximums: { body: 9, agility: 5, strength: 9, charisma: 5 } },
}

export function attributeMaximum(metatype: MetatypeId, attribute: AttributeId): number {
  return METATYPES[metatype].maximums[attribute] ?? 6
}
