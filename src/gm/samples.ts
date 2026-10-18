import type { Encounter } from '../model/encounter'
import { addNpcs, newEncounter } from '../rules/sr6/encounter'
import type { NpcEntry } from '../rules/sr6/npc'

/**
 * The grunt stat blocks at one Professional Rating, in book order. The books
 * give an example grunt for each rating, then lieutenants with magic or tech
 * skills (p. 203), so the first is the rank and file.
 */
export function gruntTemplates(entries: NpcEntry[], rating: number): NpcEntry[] {
  return entries
    .filter((e) => e.professionalRating === rating)
    .sort((a, b) => a.page - b.page || a.name.localeCompare(b.name))
}

/** Suggested numbers: one more grunt than there are runners, and one lieutenant to lead them. */
export function suggestedCounts(templates: NpcEntry[], runners: number): number[] {
  return templates.map((_, i) => (i === 0 ? Math.max(2, runners + 1) : i === 1 ? 1 : 0))
}

/** An encounter made from templates and counts; several of one template form a grunt group. */
export function sampleEncounter(name: string, picks: { npc: NpcEntry; count: number }[]): Encounter {
  let encounter = newEncounter(name)
  for (const { npc, count } of picks) if (count > 0) encounter = addNpcs(encounter, npc, count)
  return encounter
}
