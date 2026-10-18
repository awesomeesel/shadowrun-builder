import { entrySummary } from '../books/toCharacter'
import type { CastMember } from '../db/db'
import { ParticipantSchema, type Encounter } from '../model/encounter'
import { addNpcs } from '../rules/sr6/encounter'

/** One line about a cast member's stats, or that they have none. */
export function castStatsSummary(m: CastMember): string {
  if (m.npc) return `${m.npc.name} · ${entrySummary(m.npc)}`
  if (m.custom)
    return `Initiative ${m.custom.initiativeScore} + ${m.custom.initiativeDice}D6 · Defense Rating ${m.custom.defenseRating} · ${m.custom.monitor} boxes · ${m.custom.pool} dice`
  return 'No stats: for roleplay only'
}

/** Put a cast member into an encounter under their own name, with their notes. Members without stats can't fight. */
export function addCastMember(encounter: Encounter, member: CastMember): Encounter {
  if (member.npc) {
    const added = addNpcs(encounter, { ...member.npc, name: member.name }, 1)
    const last = added.participants.at(-1)!
    return {
      ...added,
      participants: added.participants.map((p) => (p.id === last.id ? { ...p, notes: member.notes } : p)),
    }
  }
  if (member.custom) {
    const p = ParticipantSchema.parse({ kind: 'custom', name: member.name, custom: member.custom, notes: member.notes })
    return { ...encounter, participants: [...encounter.participants, p] }
  }
  return encounter
}
