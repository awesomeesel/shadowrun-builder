/**
 * Initiation for the Awakened and submersion for technomancers (Core Rulebook
 * pp. 166–167 and 195): grades bought with karma, a higher Magic/Resonance
 * limit, and a metamagic or echo per grade.
 */
import type { Character } from '../../model/character'

export interface Ability {
  name: string
  /** One-line summary in our own words. */
  effect: string
  /** How many times it can be taken (Infinity = no limit). */
  max: number
  /** Only for adepts. */
  adeptOnly?: boolean
}

export const METAMAGICS: Ability[] = [
  {
    name: 'Adept Centering',
    effect: 'Minor Action: foes gain no Edge from conditions or illusions against you.',
    max: 1,
    adeptOnly: true,
  },
  { name: 'Centering', effect: 'Minor Action: + your grade in dice on Drain resistance tests.', max: 1 },
  { name: 'Fixation', effect: 'Spend karma to make alchemical preparations last much longer.', max: 1 },
  { name: 'Flexible Signature', effect: 'Disguise or forge your astral signature.', max: 1 },
  { name: 'Masking', effect: 'Make your aura look mundane, or your Magic higher or lower.', max: 1 },
  { name: 'Power Point', effect: '+1 power point instead of a metamagic.', max: Infinity, adeptOnly: true },
  { name: 'Quickening', effect: 'Spend karma to make a sustained spell permanent.', max: 1 },
  { name: 'Spell Shaping', effect: 'Take dice off Spellcasting to reshape an area spell.', max: 1 },
  { name: 'Shielding', effect: '+ your grade in dice when using Boosted Defense against spells.', max: 1 },
]

export const MATRIX_UPGRADE = 'Matrix Attribute Upgrade'
export const PERSONA_ATTRIBUTES = ['Attack', 'Sleaze', 'Data Processing', 'Firewall'] as const

export const ECHOES: Ability[] = [
  { name: 'Living Network', effect: 'Your living persona can be the master device of a PAN.', max: 1 },
  { name: 'Machine Mind', effect: 'Works like a rating 1 control rig.', max: 1 },
  { name: MATRIX_UPGRADE, effect: '+1 to one living persona attribute (each at most twice).', max: 8 },
  { name: 'NeuroFilter', effect: '+1 die to resist biofeedback damage.', max: 2 },
  { name: 'Overclocking', effect: 'In hot-sim: +1D6 initiative and an extra Minor Action.', max: 1 },
  { name: 'Resonance Link', effect: 'A one-way empathic link to another technomancer.', max: Infinity },
  { name: 'Skinlink', effect: 'Connect to a device by touching it, as with a DNI.', max: 1 },
]

/** Karma for the next grade: 10 + the new grade. */
export const gradeCost = (grade: number) => 10 + grade

const count = (list: string[], name: string) => list.filter((x) => x.split(':')[0].trim() === name).length

/** Metamagics or echoes that can still be chosen. */
export function availableAbilities(kind: 'metamagic' | 'echo', taken: string[], adept: boolean): Ability[] {
  return (kind === 'metamagic' ? METAMAGICS : ECHOES).filter(
    (a) => count(taken, a.name) < a.max && (!a.adeptOnly || adept),
  )
}

/** Matrix Attribute Upgrade can go on each attribute at most twice. */
export function upgradeableAttributes(echoes: string[]): string[] {
  return PERSONA_ATTRIBUTES.filter((a) => echoes.filter((e) => e === `${MATRIX_UPGRADE}: ${a}`).length < 2)
}

/** What the grades do to the numbers. */
export interface GradeEffects {
  /** Highest Magic rating: 6 + Initiate Grade. */
  maxMagic: number
  /** Highest Resonance rating: 6 + Submersion grade. */
  maxResonance: number
  /** Dice Centering adds to drain resistance (0 without it). */
  centeringDice: number
  /** Power points from the Power Point metamagic. */
  extraPowerPoints: number
  /** Living persona bonuses from Matrix Attribute Upgrade. */
  persona: { attack: number; sleaze: number; dataProcessing: number; firewall: number }
  /** Overclocking: +1D6 hot-sim initiative. */
  hotSimDice: number
  /** Machine Mind acts as a rating 1 control rig. */
  machineMind: boolean
  neuroFilter: number
}

export function gradeEffects(character: Character): GradeEffects {
  const { initiateGrade, metamagics, submersionGrade, echoes } = character
  const upgrade = (a: string) => echoes.filter((e) => e === `${MATRIX_UPGRADE}: ${a}`).length
  return {
    maxMagic: 6 + initiateGrade,
    maxResonance: 6 + submersionGrade,
    centeringDice: count(metamagics, 'Centering') ? initiateGrade : 0,
    extraPowerPoints: count(metamagics, 'Power Point'),
    persona: {
      attack: upgrade('Attack'),
      sleaze: upgrade('Sleaze'),
      dataProcessing: upgrade('Data Processing'),
      firewall: upgrade('Firewall'),
    },
    hotSimDice: count(echoes, 'Overclocking') ? 1 : 0,
    machineMind: count(echoes, 'Machine Mind') > 0,
    neuroFilter: count(echoes, 'NeuroFilter'),
  }
}
