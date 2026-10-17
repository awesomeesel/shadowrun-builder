import type { AttributeId } from './attributes'

export const METATYPE_IDS = ['human', 'dwarf', 'elf', 'ork', 'troll'] as const
export type MetatypeId = (typeof METATYPE_IDS)[number]

/** A quality every member of a metatype has for free. */
export interface RacialQuality {
  name: string
  rating?: number
  page: number
}

export interface MetatypeDef {
  id: MetatypeId
  name: string
  /** Attribute maximums that differ from the default of 6. Minimum is always 1. */
  maximums: Partial<Record<AttributeId, number>>
  qualities: RacialQuality[]
}

const LOW_LIGHT = { name: 'Low-Light Vision', page: 72 }
const THERMOGRAPHIC = { name: 'Thermographic Vision', page: 73 }

/** Metatype Attributes Table, Core Rulebook p. 64. */
export const METATYPES: Record<MetatypeId, MetatypeDef> = {
  human: { id: 'human', name: 'Human', maximums: { edge: 7 }, qualities: [] },
  dwarf: {
    id: 'dwarf',
    name: 'Dwarf',
    maximums: { body: 7, reaction: 5, strength: 8, willpower: 7 },
    qualities: [{ name: 'Toxin Resistance', page: 73 }, THERMOGRAPHIC],
  },
  elf: { id: 'elf', name: 'Elf', maximums: { agility: 7, charisma: 8 }, qualities: [LOW_LIGHT] },
  ork: {
    id: 'ork',
    name: 'Ork',
    maximums: { body: 8, strength: 8, charisma: 5 },
    qualities: [LOW_LIGHT, { name: 'Built Tough', rating: 1, page: 70 }],
  },
  troll: {
    id: 'troll',
    name: 'Troll',
    maximums: { body: 9, agility: 5, strength: 9, charisma: 5 },
    qualities: [{ name: 'Dermal Deposits', page: 71 }, THERMOGRAPHIC, { name: 'Built Tough', rating: 2, page: 70 }],
  },
}

export function attributeMaximum(metatype: MetatypeId, attribute: AttributeId): number {
  return METATYPES[metatype].maximums[attribute] ?? 6
}
