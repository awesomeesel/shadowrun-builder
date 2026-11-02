/**
 * Using contacts at the table (Core Rulebook p. 52), in our own words. The GM
 * rolls the contact's Connection + Connection to see what they know; the
 * player rolls Influence + Charisma with the contact's Loyalty as extra dice,
 * and each hit is one level of that knowledge shared for free. More levels
 * cost money, about 100¥ each.
 */
import type { Character } from '../../model/character'
import { ownedSkillPools, untrainedSkillPools } from './derived'

type Contact = Character['contacts'][number]

/** Influence + Charisma (untrained if need be) plus the contact's Loyalty. */
export function contactPool(character: Character, contact: Pick<Contact, 'loyalty'>): number {
  const influence = [...ownedSkillPools(character), ...untrainedSkillPools(character)].find(
    (p) => p.skill.id === 'influence',
  )
  return Math.max(0, influence?.pool ?? 0) + contact.loyalty
}

/** "They owe you 2", "You owe them 1", "Even". */
export function favorsText(favors: number): string {
  if (favors > 0) return `They owe you ${favors === 1 ? 'a favor' : `${favors} favors`}`
  if (favors < 0) return `You owe them ${favors === -1 ? 'a favor' : `${-favors} favors`}`
  return 'Even'
}

/** The contact's notes with a dated line added at the end. */
export function addContactNote(notes: string, text: string, now = new Date()): string {
  const date = now.toISOString().slice(0, 10)
  return `${notes.trimEnd()}${notes.trim() ? '\n' : ''}[${date}] ${text.trim()}`
}
