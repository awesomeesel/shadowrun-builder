/**
 * SR6 rules for augmentations, magic, resonance and the Matrix.
 *
 * VERIFY: entered from memory, not yet checked against the Core Rulebook.
 */
import type { AttributeId } from './attributes'

export const AUGMENTATION_GRADES = {
  used: { name: 'Used', essence: 1.1, cost: 0.75 },
  standard: { name: 'Standard', essence: 1, cost: 1 },
  alpha: { name: 'Alphaware', essence: 0.8, cost: 1.2 },
  beta: { name: 'Betaware', essence: 0.7, cost: 1.5 },
  delta: { name: 'Deltaware', essence: 0.5, cost: 2.5 },
} as const

export type GradeId = keyof typeof AUGMENTATION_GRADES

export const AUGMENTATION_KINDS = ['cyberware', 'bioware', 'other'] as const

export const SPECIAL_RULES = {
  /** Augmented attributes can't exceed the natural rating by more than this. */
  maxAugmentedBonus: 4,
  maxInitiativeDice: 5,
  /** Magic and Resonance drop by 1 for each started point of Essence lost. */
  magicLossRoundsUp: true,
  /** Matrix condition monitor = 8 + ceil(Device Rating / 2). */
  matrixMonitorBase: 8,
  /** Extra initiative dice in VR: cold-sim / hot-sim. */
  vrColdDice: 2,
  vrHotDice: 3,
  /** Fading resistance: Willpower + this attribute. */
  fadingAttribute: 'logic' as AttributeId,
} as const

/** Drain is resisted with Willpower + the tradition's attribute. */
export const TRADITIONS = {
  hermetic: { name: 'Hermetic', drainAttribute: 'logic' },
  shamanic: { name: 'Shamanic', drainAttribute: 'charisma' },
  other: { name: 'Other', drainAttribute: null },
} as const

export type TraditionId = keyof typeof TRADITIONS

export const SPELL_CATEGORIES = ['combat', 'detection', 'health', 'illusion', 'manipulation'] as const

/** Build-mode karma costs. */
export const SPECIAL_CREATION_RULES = {
  spellKarma: 5,
  complexFormKarma: 5,
  /** Mystic adepts buy power points with karma. */
  powerPointKarma: 5,
} as const
