import type { HelpEntry } from '../../../rules/sr6/help'

/** A dice pool the player can roll from the Play tab. */
export interface QuickPool {
  label: string
  /** Dice before wound modifiers; for initiative, the number of initiative dice. */
  pool: number
  /** Initiative rolls add the score to the dice. */
  initiativeScore?: number
  /** Shown under the result, e.g. "DV 5P + net hits · AR 9". */
  info?: string
  /** Damage resistance isn't affected by wound modifiers (p. 38). */
  ignoreWounds?: boolean
  /** A physical initiative roll that starts (or updates) the combat tracker. */
  startsCombat?: boolean
  /** An attack's Attack Rating at the chosen range and firing mode; null when out of range. */
  attackRating?: number | null
  /** What's in the pool, e.g. "Firearms 6 + Agility 6". */
  formula?: string
  /** What the pool is for, behind a help button. */
  help?: HelpEntry
}
