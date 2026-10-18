/**
 * Hosts and IC (Core Rulebook p. 185–187), summarised in our own words.
 * A host's rating (1–12) gives its four Matrix attributes: the rating, +1,
 * +2 and +3, in any order. IC share them. Every IC uses Host Rating × 2 for
 * its Attack Rating, Condition Monitor and most rolls; its Initiative is
 * Data Processing × 2 + 3D6. A host launches one IC per combat round, at
 * most one of each type and its rating in total.
 */

export interface IcType {
  id: string
  name: string
  /** The target's defense roll against its attack; none for IC that don't attack. */
  defense: string | null
  /** What happens when it hits. */
  effect: string
}

export const IC_TYPES: IcType[] = [
  {
    id: 'patrol',
    name: 'Patrol',
    defense: null,
    effect:
      'Watches the host: rolls Matrix Perception when launched and each minute; one Minor Action always goes to it.',
  },
  {
    id: 'acid',
    name: 'Acid',
    defense: 'Willpower + Firewall',
    effect: 'Firewall −1 per net hit until they leave the host.',
  },
  {
    id: 'binder',
    name: 'Binder',
    defense: 'Willpower + Data Processing',
    effect: 'Data Processing −1 per net hit; at 0 they can’t take Matrix actions.',
  },
  {
    id: 'black',
    name: 'Black IC',
    defense: 'Intuition + Firewall',
    effect: 'Host rating + net hits as Matrix damage and as biofeedback damage.',
  },
  {
    id: 'blaster',
    name: 'Blaster',
    defense: 'Logic + Firewall',
    effect: 'Host rating Matrix damage, and link-locks them.',
  },
  {
    id: 'crash',
    name: 'Crash',
    defense: 'Intuition + Firewall',
    effect: 'No damage; crashes one random program until a reboot.',
  },
  {
    id: 'jammer',
    name: 'Jammer',
    defense: 'Willpower + Attack',
    effect: 'Attack −1 per net hit; at 0 no Attack actions.',
  },
  { id: 'killer', name: 'Killer', defense: 'Intuition + Firewall', effect: 'Host rating + net hits Matrix damage.' },
  {
    id: 'marker',
    name: 'Marker',
    defense: 'Willpower + Sleaze',
    effect: 'Sleaze −1 per net hit; at 0 no Sleaze actions.',
  },
  {
    id: 'scramble',
    name: 'Scramble',
    defense: 'Willpower + Firewall',
    effect: 'Forces a reboot on their next turn, unless they’re link-locked.',
  },
  {
    id: 'sparky',
    name: 'Sparky',
    defense: 'Intuition + Firewall',
    effect: 'Host rating + net hits biofeedback damage, straight to the user.',
  },
  { id: 'tar-baby', name: 'Tar Baby', defense: 'Logic + Firewall', effect: 'Link-locks them.' },
  { id: 'track', name: 'Track', defense: 'Willpower + Sleaze', effect: 'Finds their physical location.' },
]

export const IC_BY_ID = new Map(IC_TYPES.map((t) => [t.id, t]))

export interface HostAttributes {
  attack: number
  sleaze: number
  dataProcessing: number
  firewall: number
}

/** The usual spread: rating, +1, +2, +3. A security host leads with Firewall, a data host with Data Processing. */
export function hostAttributes(rating: number): HostAttributes {
  return { attack: rating, sleaze: rating + 1, dataProcessing: rating + 2, firewall: rating + 3 }
}

/** Whether the four attributes are the rating, +1, +2 and +3 in some order. */
export function isStandardSpread(rating: number, a: HostAttributes): boolean {
  const values = [a.attack, a.sleaze, a.dataProcessing, a.firewall].sort((x, y) => x - y)
  return values.every((v, i) => v === rating + i)
}
