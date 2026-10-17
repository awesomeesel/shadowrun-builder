import { z } from 'zod'
import type { NpcEntry } from '../rules/sr6/npc'

const id = () =>
  z
    .string()
    .min(1)
    .default(() => crypto.randomUUID())
const int = (fallback = 0) => z.number().int().default(fallback)
const text = () => z.string().default('')

/** A status on a combatant, e.g. Burning 3 for 2 more rounds. */
export const StatusSchema = z.object({
  id: id(),
  name: z.string(),
  /** The level (Blinded II) or number (Burning 3); 0 when it has none. */
  value: int(0),
  /** Rounds left; null lasts until removed. */
  rounds: z.number().int().nullable().default(null),
})

/** Who is in the fight and what kind of stats they use. */
export const ParticipantSchema = z.object({
  id: id(),
  kind: z.enum(['npc', 'spirit', 'runner', 'custom']).default('custom'),
  name: z.string().default(''),
  /** Grunts added together share initiative and an Edge pool (p. 203). */
  group: text(),
  /** A copy of the book stat block, so the encounter doesn't depend on the catalog later. */
  npc: z.custom<NpcEntry>().optional(),
  spirit: z.object({ type: z.string(), force: int(1) }).optional(),
  /** A player character from this device, if linked; otherwise just a name and initiative. */
  characterId: z.string().optional(),
  /** Stats for quick custom enemies and unlinked runners. */
  custom: z
    .object({
      initiativeScore: int(8),
      initiativeDice: int(1),
      defenseRating: int(4),
      monitor: int(10),
      pool: int(8),
    })
    .optional(),
  /** Initiative total for this fight; null until rolled or typed in. */
  initiative: z.number().int().nullable().default(null),
  damage: z.object({ physical: int(0), stun: int(0) }).prefault({}),
  edge: int(0),
  statuses: z.array(StatusSchema).default([]),
  majorLeft: int(1),
  minorLeft: int(1),
  /** Down, fled or otherwise out of the fight; skipped in the turn order. */
  out: z.boolean().default(false),
  notes: text(),
})

export const EncounterSchema = z.object({
  id: id(),
  name: z.string().default('New encounter'),
  notes: text(),
  /** 0 before the fight starts. */
  round: int(0),
  /** Whose turn it is. */
  activeId: z.string().nullable().default(null),
  participants: z.array(ParticipantSchema).default([]),
  /**
   * Turn state from before each Next turn / End round, newest last, so the GM
   * can step back. Damage and Edge aren't in it: going back keeps those.
   */
  history: z
    .array(
      z.object({
        round: z.number().int(),
        activeId: z.string().nullable(),
        participants: z.array(
          z.object({
            id: z.string(),
            statuses: z.array(StatusSchema),
            majorLeft: z.number().int(),
            minorLeft: z.number().int(),
          }),
        ),
      }),
    )
    .default([]),
  /** Shared Edge per grunt group. */
  groupEdge: z.record(z.string(), z.number().int()).default({}),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
})

export type Encounter = z.infer<typeof EncounterSchema>
export type Participant = z.infer<typeof ParticipantSchema>
export type Status = z.infer<typeof StatusSchema>
