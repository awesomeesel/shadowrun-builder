/**
 * The "(other version)" copies Drive sync keeps when a character was changed
 * on two devices: which character each belongs to, how the two differ, and
 * keeping the copy instead.
 */
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS } from '../rules/sr6/attributes'
import type { Character } from '../model/character'

export const COPY_SUFFIX = ' (other version)'

/** Whether a character is such a copy (older copies only have the name to go on). */
export const isConflictCopy = (c: Pick<Character, 'name' | 'conflictOf'>) =>
  !!c.conflictOf || c.name.endsWith(COPY_SUFFIX)

/** The main character a copy belongs to, if it's still here. */
export function originalOf(copy: Character, all: Character[]): Character | undefined {
  if (copy.conflictOf) return all.find((c) => c.id === copy.conflictOf)
  if (!copy.name.endsWith(COPY_SUFFIX)) return undefined
  const name = copy.name.slice(0, -COPY_SUFFIX.length)
  const matches = all.filter((c) => c.id !== copy.id && c.name === name)
  return matches.length === 1 ? matches[0] : undefined
}

/** Copies kept of this character. */
export function copiesOf(character: Character, all: Character[]): Character[] {
  return all.filter((c) => c.id !== character.id && isConflictCopy(c) && originalOf(c, all)?.id === character.id)
}

/** Plain-language differences between a copy and the main character, from the copy's point of view. */
export function differences(copy: Character, main: Character): string[] {
  const out: string[] = []
  const compare = (label: string, a: number, b: number, unit = '') => {
    if (a !== b) out.push(`${label}: ${a.toLocaleString()}${unit} here, ${b.toLocaleString()}${unit} in the main one`)
  }
  compare('Nuyen', copy.nuyen, main.nuyen, '¥')
  compare('Karma', copy.karma.available, main.karma.available)
  compare('Career karma', copy.karma.career, main.karma.career)
  compare('Physical damage', copy.damage.physical, main.damage.physical)
  compare('Stun damage', copy.damage.stun, main.damage.stun)
  for (const a of ATTRIBUTE_IDS) {
    const x = copy.attributes[a] as number | undefined
    const y = main.attributes[a] as number | undefined
    if (typeof x === 'number' && typeof y === 'number') compare(ATTRIBUTE_LABELS[a].name, x, y)
  }
  const rating = (c: Character) => new Map(c.skills.map((s) => [s.id, s.rating]))
  const mine = rating(copy)
  const theirs = rating(main)
  const skillChanges = [...new Set([...mine.keys(), ...theirs.keys()])].filter((id) => mine.get(id) !== theirs.get(id))
  if (skillChanges.length) out.push(`Skills differ (${skillChanges.length})`)
  const count = (label: string, a: unknown[], b: unknown[]) => {
    if (a.length !== b.length) out.push(`${label}: ${a.length} here, ${b.length} in the main one`)
  }
  count('Gear', copy.gear, main.gear)
  count('Weapons', copy.weapons, main.weapons)
  count('Augmentations', copy.augmentations, main.augmentations)
  count('Qualities', copy.qualities, main.qualities)
  count('Money and karma entries', copy.ledger, main.ledger)
  count('Logged sessions', copy.sessions, main.sessions)
  const notes = (c: Character) => c.play.session?.notes ?? ''
  if (notes(copy) !== notes(main)) out.push('Session notes differ')
  return out
}

/** The copy's content under the main character's id and name, ready to save over it. */
export function asMain(copy: Character, main: Character): Character {
  return { ...copy, id: main.id, name: main.name, createdAt: main.createdAt, conflictOf: undefined }
}
