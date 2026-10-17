/**
 * Spirits and sprites: their stats by type and Force/Level, and the summoning
 * and compiling tests (Core Rulebook pp. 146–148 and 191–193).
 */
import type { AttributeId } from './attributes'
import type { Initiative } from './derived'
import { rollPool, type Roll } from './play'

type SpiritAttribute = Exclude<AttributeId, 'edge' | 'magic' | 'resonance'>

export interface SpiritType {
  name: string
  /** Each attribute is Force plus this. */
  attributes: Record<SpiritAttribute, number>
  /** Initiative is (Force × 2) + this, with 2D6. */
  initiative: number
  /** Defense Rating is Force plus this. */
  defense: number
  skills: string[]
  powers: string[]
  optionalPowers: string[]
  /** Attacks as printed, with F for Force. */
  attacks: string[]
}

const attrs = (b: number, a: number, r: number, s: number, w = 0, l = 0, i = 0, c = 0) => ({
  body: b,
  agility: a,
  reaction: r,
  strength: s,
  willpower: w,
  logic: l,
  intuition: i,
  charisma: c,
})

const ELEMENTAL = 'Elemental Attack: DV (F)P, AR (F×2)/(F×2)−2/(F×2)−8/(F×2)−10/—'
const ENGULF = 'Engulf: DV (F+2)S + Fatigue, AR (F×2)+1'

export const SPIRIT_TYPES = {
  air: {
    name: 'Air',
    attributes: attrs(-2, 3, 4, -3),
    initiative: 4,
    defense: -2,
    skills: ['Astral', 'Athletics', 'Close Combat', 'Exotic Weapons', 'Perception'],
    powers: [
      'Accident',
      'Astral Form',
      'Concealment',
      'Confusion',
      'Engulf (Air)',
      'Materialization',
      'Movement',
      'Sapience',
      'Search',
    ],
    optionalPowers: [
      'Elemental Attack (Cold)',
      'Elemental Attack (Electricity)',
      'Energy Aura',
      'Fear',
      'Guard',
      'Noxious Breath',
      'Psychokinesis',
    ],
    attacks: [ELEMENTAL, ENGULF],
  },
  beasts: {
    name: 'Beasts',
    attributes: attrs(2, 1, 0, 2),
    initiative: 0,
    defense: 2,
    skills: ['Astral', 'Close Combat', 'Perception'],
    powers: ['Animal Control', 'Astral Form', 'Enhanced Senses', 'Fear', 'Materialization', 'Movement', 'Sapience'],
    optionalPowers: ['Concealment', 'Confusion', 'Guard', 'Natural Weapon', 'Noxious Breath', 'Search', 'Venom'],
    attacks: ['Claw/bite: DV (F/2)P, AR (F×2)'],
  },
  earth: {
    name: 'Earth',
    attributes: attrs(4, -2, -1, 4, 0, -1),
    initiative: -1,
    defense: 4,
    skills: ['Astral', 'Close Combat', 'Exotic Weapons', 'Perception'],
    powers: ['Astral Form', 'Binding', 'Guard', 'Materialization', 'Movement', 'Sapience', 'Search'],
    optionalPowers: ['Concealment', 'Confusion', 'Elemental Attack (Chemical)', 'Engulf (Earth)', 'Fear'],
    attacks: [ELEMENTAL],
  },
  fire: {
    name: 'Fire',
    attributes: attrs(1, 2, 3, -2, 0, 0, 1),
    initiative: 4,
    defense: 1,
    skills: ['Astral', 'Athletics', 'Close Combat', 'Exotic Weapons', 'Perception'],
    powers: [
      'Accident',
      'Astral Form',
      'Confusion',
      'Elemental Attack (Fire)',
      'Energy Aura (Fire)',
      'Engulf (Fire)',
      'Materialization',
      'Sapience',
    ],
    optionalPowers: ['Fear', 'Guard', 'Noxious Breath', 'Search'],
    attacks: [ELEMENTAL, ENGULF],
  },
  kin: {
    name: 'Kin',
    attributes: attrs(1, 0, 2, -2, 0, 0, 1),
    initiative: 3,
    defense: 1,
    skills: ['Astral', 'Close Combat', 'Perception', 'Sorcery'],
    powers: [
      'Accident',
      'Astral Form',
      'Concealment',
      'Confusion',
      'Enhanced Senses',
      'Guard',
      'Influence',
      'Materialization',
      'Sapience',
      'Search',
    ],
    optionalPowers: ['Fear', 'Innate Spell', 'Movement', 'Psychokinesis'],
    attacks: ['Fists: DV (F/2)S, AR (F×2)'],
  },
  water: {
    name: 'Water',
    attributes: attrs(0, 1, 2, 0),
    initiative: 2,
    defense: 0,
    skills: ['Astral', 'Athletics', 'Close Combat', 'Exotic Weapons', 'Perception'],
    powers: [
      'Astral Form',
      'Concealment',
      'Confusion',
      'Engulf (Water)',
      'Materialization',
      'Movement',
      'Sapience',
      'Search',
    ],
    optionalPowers: [
      'Accident',
      'Binding',
      'Elemental Attack (Cold)',
      'Energy Aura (Cold)',
      'Guard',
      'Weather Control',
    ],
    attacks: [ELEMENTAL, ENGULF],
  },
} satisfies Record<string, SpiritType>

export type SpiritTypeId = keyof typeof SPIRIT_TYPES

/** Which attribute each spirit skill uses; spirits roll Magic (= Force) for Sorcery. */
const SPIRIT_SKILL_ATTRIBUTE: Record<string, SpiritAttribute | 'magic'> = {
  Astral: 'intuition',
  Athletics: 'agility',
  'Close Combat': 'agility',
  'Exotic Weapons': 'agility',
  Perception: 'intuition',
  Sorcery: 'magic',
}

export interface SpiritStats {
  attributes: Record<SpiritAttribute, number>
  initiative: Initiative
  astralInitiative: Initiative
  defenseRating: number
  /** One condition monitor, (Force / 2) + 8. */
  monitor: number
  /**
   * Skill dice pools. The book doesn't print spirit skill ratings; they are
   * taken as equal to Force, as for sprites (whose ratings equal their Level).
   */
  skills: { name: string; pool: number }[]
}

export function spiritStats(type: SpiritTypeId, force: number): SpiritStats {
  const def: SpiritType = SPIRIT_TYPES[type]
  const attributes = Object.fromEntries(
    Object.entries(def.attributes).map(([a, mod]) => [a, Math.max(1, force + mod)]),
  ) as Record<SpiritAttribute, number>
  return {
    attributes,
    initiative: { score: force * 2 + def.initiative, dice: 2 },
    astralInitiative: { score: force * 2, dice: 3 },
    defenseRating: Math.max(0, force + def.defense),
    monitor: Math.ceil(force / 2) + 8,
    skills: def.skills.map((name) => {
      const attribute = SPIRIT_SKILL_ATTRIBUTE[name] ?? 'agility'
      return { name, pool: force + (attribute === 'magic' ? force : attributes[attribute]) }
    }),
  }
}

/** Active spirits' Force can add up to at most Magic × 3 (p. 147). */
export const spiritForceLimit = (magic: number) => magic * 3

// ---------------------------------------------------------------------------
// Sprites

export interface SpriteType {
  name: string
  /** Matrix attributes are Level plus these. */
  attack: number
  sleaze: number
  dataProcessing: number
  firewall: number
  /** Initiative is (Level × 2) + this, with 4D6. */
  initiative: number
  skills: string[]
  powers: string[]
}

export const SPRITE_TYPES = {
  courier: {
    name: 'Courier',
    attack: 0,
    sleaze: 3,
    dataProcessing: 1,
    firewall: 2,
    initiative: 1,
    skills: ['Electronics', 'Cracking'],
    powers: ['Cookie', 'Hash'],
  },
  crack: {
    name: 'Crack',
    attack: 0,
    sleaze: 3,
    dataProcessing: 2,
    firewall: 1,
    initiative: 2,
    skills: ['Electronics', 'Cracking'],
    powers: ['Phantom', 'Suppression'],
  },
  data: {
    name: 'Data',
    attack: -1,
    sleaze: 0,
    dataProcessing: 4,
    firewall: 1,
    initiative: 4,
    skills: ['Electronics', 'Cracking'],
    powers: ['Camouflage', 'Watermark'],
  },
  fault: {
    name: 'Fault',
    attack: 3,
    sleaze: 0,
    dataProcessing: 1,
    firewall: 2,
    initiative: 1,
    skills: ['Electronics', 'Cracking'],
    powers: ['Electron Storm', 'Trap'],
  },
  machine: {
    name: 'Machine',
    attack: 1,
    sleaze: 0,
    dataProcessing: 3,
    firewall: 2,
    initiative: 3,
    skills: ['Electronics', 'Engineering'],
    powers: ['Diagnostics', 'Override', 'Stability'],
  },
} satisfies Record<string, SpriteType>

export type SpriteTypeId = keyof typeof SPRITE_TYPES

export interface SpriteStats {
  attack: number
  sleaze: number
  dataProcessing: number
  firewall: number
  initiative: Initiative
  /** Matrix condition monitor, (Level / 2) + 8. */
  monitor: number
  /** Skill ratings equal Level (p. 193); sprites roll skill + Level as their Resonance. */
  skills: { name: string; pool: number }[]
}

export function spriteStats(type: SpriteTypeId, level: number): SpriteStats {
  const def: SpriteType = SPRITE_TYPES[type]
  return {
    attack: Math.max(0, level + def.attack),
    sleaze: Math.max(0, level + def.sleaze),
    dataProcessing: Math.max(0, level + def.dataProcessing),
    firewall: Math.max(0, level + def.firewall),
    initiative: { score: level * 2 + def.initiative, dice: 4 },
    monitor: Math.ceil(level / 2) + 8,
    skills: def.skills.map((name) => ({ name, pool: level * 2 })),
  }
}

// ---------------------------------------------------------------------------
// Summoning and compiling

export interface CallResult {
  /** The summoner's or technomancer's roll. */
  roll: Roll
  /** The spirit's or sprite's resistance roll, Force/Level × 2 dice. */
  resist: Roll
  /** Net hits: services for a spirit, tasks for a sprite; 0 means it failed. */
  services: number
  /** Drain or Fading Value to resist: the hits the spirit or sprite rolled. */
  drainValue: number
}

/**
 * Summon a spirit (Conjuring + Magic vs. Force × 2) or compile a sprite
 * (Tasking + Resonance vs. Level × 2). Drain/Fading equals the other side's hits.
 */
export function callForth(pool: number, force: number, random?: () => number): CallResult {
  const roll = rollPool(pool, random)
  const resist = rollPool(force * 2, random)
  return { roll, resist, services: Math.max(0, roll.hits - resist.hits), drainValue: resist.hits }
}
