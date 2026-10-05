import type { AttributeId } from './attributes'

export interface SkillDef {
  id: string
  name: string
  attribute: AttributeId
  /** Can be rolled at rating 0 (with the -1 unskilled penalty). */
  untrained: boolean
}

export const SKILLS: SkillDef[] = [
  { id: 'astral', name: 'Astral', attribute: 'intuition', untrained: false },
  { id: 'athletics', name: 'Athletics', attribute: 'agility', untrained: true },
  { id: 'biotech', name: 'Biotech', attribute: 'logic', untrained: false },
  { id: 'close-combat', name: 'Close Combat', attribute: 'agility', untrained: true },
  { id: 'con', name: 'Con', attribute: 'charisma', untrained: true },
  { id: 'conjuring', name: 'Conjuring', attribute: 'magic', untrained: false },
  { id: 'cracking', name: 'Cracking', attribute: 'logic', untrained: false },
  { id: 'electronics', name: 'Electronics', attribute: 'logic', untrained: true },
  { id: 'enchanting', name: 'Enchanting', attribute: 'magic', untrained: false },
  { id: 'engineering', name: 'Engineering', attribute: 'logic', untrained: true },
  { id: 'exotic-weapons', name: 'Exotic Weapons', attribute: 'agility', untrained: false },
  { id: 'firearms', name: 'Firearms', attribute: 'agility', untrained: true },
  { id: 'influence', name: 'Influence', attribute: 'charisma', untrained: true },
  { id: 'outdoors', name: 'Outdoors', attribute: 'intuition', untrained: true },
  { id: 'perception', name: 'Perception', attribute: 'intuition', untrained: true },
  { id: 'piloting', name: 'Piloting', attribute: 'reaction', untrained: true },
  { id: 'sorcery', name: 'Sorcery', attribute: 'magic', untrained: false },
  { id: 'stealth', name: 'Stealth', attribute: 'agility', untrained: true },
  { id: 'tasking', name: 'Tasking', attribute: 'resonance', untrained: false },
]

export const SKILLS_BY_ID = new Map(SKILLS.map((s) => [s.id, s]))
