/**
 * Running a fight from the GM's side (Core Rulebook pp. 106–107): initiative
 * order with ERIC tie-breaks, combat rounds and turns, actions, and statuses
 * that count down or hurt at the end of each round.
 */
import type { Character } from '../../model/character'
import { EncounterSchema, ParticipantSchema, type Encounter, type Participant } from '../../model/encounter'
import { SPIRIT_TYPES, spiritStats, type SpiritTypeId } from './companions'
import { computeDerived, weaponPool } from './derived'
import { npcStats, type NpcEntry, type NpcPool } from './npc'
import { minorActions, rollPool } from './play'
import { IC_BY_ID } from './ic'
import { STATUS_BY_NAME, statusInitiative, statusLabel } from './statuses'

export interface CombatantStats {
  initiative: { score: number; dice: number }
  defenseRating: number
  monitor: { physical: number; stun: number | null }
  /** Boxes per −1 wound modifier: 2 for grunts, 3 otherwise. */
  woundStep: number
  pools: NpcPool[]
  /** Starting Edge (for grunts: the shared group pool). */
  edge: number
  /** Edge, Reaction, Intuition: the ERIC tie-break order (p. 106). */
  eric: [number, number, number]
  majors: number
  minors: number
  isGrunt: boolean
  /** Attacks or powers to show on the card, e.g. a spirit's Elemental Attack. */
  extras: string[]
  /** Statuses on a runner's own sheet (set by the player); they count for initiative like the GM's. */
  sheetStatuses: { id: string; name: string; value: number; rounds: number | null }[]
}

/** "A1, I2" → 1 Major and 2 Minor actions. */
function parseActions(text: string, dice: number): { majors: number; minors: number } {
  const m = text.match(/A(\d+),\s*I(\d+)/)
  if (m) return { majors: parseInt(m[1], 10), minors: Math.min(5, parseInt(m[2], 10)) }
  const words = text.match(/(\d+)\s*Major,\s*(\d+)\s*Minor/i)
  if (words) return { majors: parseInt(words[1], 10), minors: parseInt(words[2], 10) }
  return { majors: 1, minors: minorActions(dice) }
}

export function combatantStats(p: Participant, character?: Character): CombatantStats {
  if (p.kind === 'npc' && p.npc) {
    const s = npcStats(p.npc)
    const { majors, minors } = parseActions(p.npc.actions, s.initiative.dice)
    return {
      initiative: s.initiative,
      defenseRating: s.defenseRating,
      monitor: s.monitor,
      woundStep: s.woundStep,
      pools: s.pools,
      edge: s.edge,
      eric: [s.attributes.edge ?? 0, s.attributes.reaction ?? 0, s.attributes.intuition ?? 0],
      majors,
      minors,
      isGrunt: s.isGrunt,
      extras: [p.npc.powers && `Powers: ${p.npc.powers}`, p.npc.weaknesses && `Weaknesses: ${p.npc.weaknesses}`].filter(
        Boolean,
      ) as string[],
      sheetStatuses: [],
    }
  }
  if (p.kind === 'spirit' && p.spirit && p.spirit.type in SPIRIT_TYPES) {
    const type = p.spirit.type as SpiritTypeId
    const s = spiritStats(type, p.spirit.force)
    return {
      initiative: s.initiative,
      defenseRating: s.defenseRating,
      // Spirits have one condition monitor (p. 147).
      monitor: { physical: s.monitor, stun: null },
      woundStep: 3,
      pools: [
        { label: 'Defense', pool: s.attributes.reaction + s.attributes.intuition },
        { label: 'Soak', pool: s.attributes.body, ignoreWounds: true },
        ...s.skills.map((k) => ({ label: k.name, pool: k.pool })),
      ],
      edge: 0,
      eric: [0, s.attributes.reaction, s.attributes.intuition],
      majors: 1,
      minors: minorActions(s.initiative.dice),
      isGrunt: false,
      extras: SPIRIT_TYPES[type].attacks.map((a) => `${a} (F = ${p.spirit!.force})`),
      sheetStatuses: [],
    }
  }
  if (p.kind === 'ic' && p.ic) {
    const ic = p.ic
    const def = IC_BY_ID.get(ic.type)
    const rolls = ic.hostRating * 2
    return {
      initiative: { score: ic.dataProcessing * 2, dice: 3 },
      // In the Matrix, Defense Rating is Data Processing + Firewall (p. 175).
      defenseRating: ic.dataProcessing + ic.firewall,
      monitor: { physical: rolls, stun: null },
      // IC are programs: Matrix damage gives them no wound modifiers.
      woundStep: 1000,
      pools: [
        ...(def?.defense
          ? [{ label: 'Attack', pool: rolls, info: `AR ${rolls} · they defend with ${def.defense}. ${def.effect}` }]
          : []),
        { label: 'Matrix Perception', pool: rolls },
        { label: 'Defense', pool: rolls, ignoreWounds: true },
      ],
      edge: 0,
      eric: [0, 0, 0],
      majors: 1,
      minors: minorActions(3),
      isGrunt: false,
      extras: [
        `Attack Rating ${rolls} (Host Rating × 2). ${def ? `${def.defense ? `Defends with ${def.defense}. ` : ''}${def.effect}` : ''}`,
        `Host ${ic.hostName || ''} rating ${ic.hostRating}: Attack ${ic.attack}, Sleaze ${ic.sleaze}, Data Processing ${ic.dataProcessing}, Firewall ${ic.firewall}.`,
      ],
      sheetStatuses: [],
    }
  }
  if (p.kind === 'runner' && character) {
    const d = computeDerived(character)
    return {
      initiative: d.initiative,
      defenseRating: d.defenseRating,
      monitor: { physical: d.physicalMonitor.boxes, stun: d.stunMonitor.boxes },
      woundStep: 3,
      pools: [
        { label: 'Defense', pool: d.pools.defense },
        { label: 'Soak', pool: d.pools.damageResistance, ignoreWounds: true },
        ...character.weapons.flatMap((w) => {
          const pool = weaponPool(character, w).pool
          return pool === null ? [] : [{ label: w.name, pool, info: `DV ${w.damage} + net hits` }]
        }),
      ],
      edge: d.attributes.edge,
      eric: [d.attributes.edge, d.attributes.reaction, d.attributes.intuition],
      majors: 1,
      minors: minorActions(d.initiative.dice),
      isGrunt: false,
      extras: [],
      sheetStatuses: character.play.statuses,
    }
  }
  const c = p.custom ?? { initiativeScore: 8, initiativeDice: 1, defenseRating: 4, monitor: 10, pool: 8 }
  return {
    initiative: { score: c.initiativeScore, dice: c.initiativeDice },
    defenseRating: c.defenseRating,
    monitor: { physical: c.monitor, stun: null },
    woundStep: 3,
    pools: [{ label: 'Main pool', pool: c.pool }],
    edge: 0,
    eric: [0, 0, 0],
    majors: 1,
    minors: minorActions(c.initiativeDice),
    isGrunt: false,
    extras: [],
    sheetStatuses: [],
  }
}

/** −1 per full step of boxes on each track. */
export function woundModifier(p: Participant, stats: CombatantStats): number {
  const step = stats.woundStep
  return -(Math.floor(p.damage.physical / step) + Math.floor(p.damage.stun / step)) || 0
}

/** Initiative including status changes (Chilled −4, Dazed −4, Zapped −2). */
export function effectiveInitiative(p: Participant, stats?: CombatantStats): number | null {
  return p.initiative === null
    ? null
    : p.initiative + statusInitiative([...p.statuses, ...(stats?.sheetStatuses ?? [])])
}

/** Highest initiative first; ties go to higher Edge, then Reaction, then Intuition (p. 106). */
export function turnOrder(encounter: Encounter, stats: Map<string, CombatantStats>): Participant[] {
  const key = (p: Participant) => effectiveInitiative(p, stats.get(p.id)) ?? -Infinity
  return [...encounter.participants].sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1
    const diff = key(b) - key(a)
    if (diff) return diff
    const ea = stats.get(a.id)?.eric ?? [0, 0, 0]
    const eb = stats.get(b.id)?.eric ?? [0, 0, 0]
    for (let i = 0; i < 3; i++) if (ea[i] !== eb[i]) return eb[i] - ea[i]
    return 0
  })
}

/**
 * Roll initiative for everyone the GM runs. Grunts in a group share one roll,
 * since grunts of the same template act together (p. 203). Runners keep what
 * their players typed in, unless `includeRunners` is set. With `onlyMissing`,
 * only those without initiative roll (newcomers joining a fight in progress).
 */
export function rollInitiative(
  encounter: Encounter,
  stats: Map<string, CombatantStats>,
  includeRunners = false,
  random?: () => number,
  onlyMissing = false,
): Encounter {
  const groupRolls = new Map<string, number>()
  // Newcomers to a group already in the fight take the group's initiative.
  if (onlyMissing) {
    for (const p of encounter.participants) if (p.group && p.initiative !== null) groupRolls.set(p.group, p.initiative)
  }
  const participants = encounter.participants.map((p) => {
    if (p.kind === 'runner' && !includeRunners) return p
    if (onlyMissing && p.initiative !== null) return p
    const s = stats.get(p.id)
    if (!s) return p
    const roll = () => s.initiative.score + rollPool(s.initiative.dice, random).dice.reduce((a, b) => a + b, 0)
    let total: number
    if (p.group) {
      if (!groupRolls.has(p.group)) groupRolls.set(p.group, roll())
      total = groupRolls.get(p.group)!
    } else total = roll()
    return { ...p, initiative: total }
  })
  return { ...encounter, participants }
}

/** Start the fight: round 1, actions refilled, first in the order acts. */
export function startCombat(encounter: Encounter, stats: Map<string, CombatantStats>): Encounter {
  const refilled = refill(encounter, stats)
  const order = turnOrder(refilled, stats).filter((p) => !p.out)
  return { ...refilled, round: 1, activeId: order[0]?.id ?? null, history: [] }
}

function refill(encounter: Encounter, stats: Map<string, CombatantStats>): Encounter {
  return {
    ...encounter,
    participants: encounter.participants.map((p) => {
      const s = stats.get(p.id)
      return s ? { ...p, majorLeft: s.majors, minorLeft: s.minors } : p
    }),
  }
}

export interface TurnResult {
  encounter: Encounter
  /** Reminders when a new round starts, e.g. "Ganger 2: resist Burning 3 (Physical)". */
  messages: string[]
}

/**
 * Pass the turn to the next combatant. After the last one the round ends:
 * damaging statuses are reminded, timed statuses count down, actions refill,
 * and the order starts again (initiative isn't rerolled, p. 107).
 */
export function nextTurn(encounter: Encounter, stats: Map<string, CombatantStats>): TurnResult {
  const result = advanceTurn(encounter, stats)
  return { ...result, encounter: withHistory(result.encounter, encounter) }
}

function advanceTurn(encounter: Encounter, stats: Map<string, CombatantStats>): TurnResult {
  const order = turnOrder(encounter, stats).filter((p) => !p.out)
  if (order.length === 0) return { encounter, messages: [] }
  const index = order.findIndex((p) => p.id === encounter.activeId)
  if (index >= 0 && index < order.length - 1) {
    return { encounter: { ...encounter, activeId: order[index + 1].id }, messages: [] }
  }
  return finishRound(encounter, stats)
}

/** End the round now, skipping whoever hasn't acted yet. */
export function endRound(encounter: Encounter, stats: Map<string, CombatantStats>): TurnResult {
  const result = finishRound(encounter, stats)
  return { ...result, encounter: withHistory(result.encounter, encounter) }
}

const HISTORY_LIMIT = 30

/** Remember the turn state of `before` on `after`, so Back can return to it. */
function withHistory(after: Encounter, before: Encounter): Encounter {
  if (after === before) return after
  const snapshot = {
    round: before.round,
    activeId: before.activeId,
    participants: before.participants.map(({ id, statuses, majorLeft, minorLeft }) => ({
      id,
      statuses,
      majorLeft,
      minorLeft,
    })),
  }
  return { ...after, history: [...before.history, snapshot].slice(-HISTORY_LIMIT) }
}

/**
 * Undo the last Next turn or End round: the turn, round, actions and statuses
 * go back; damage and Edge marked since stay. Without history (an encounter
 * from before this existed), it just steps back one place in the order.
 */
export function previousTurn(encounter: Encounter, stats: Map<string, CombatantStats>): Encounter {
  const snapshot = encounter.history.at(-1)
  if (snapshot) {
    const saved = new Map(snapshot.participants.map((p) => [p.id, p]))
    return {
      ...encounter,
      round: snapshot.round,
      activeId: encounter.participants.some((p) => p.id === snapshot.activeId) ? snapshot.activeId : null,
      participants: encounter.participants.map((p) => {
        const s = saved.get(p.id)
        return s ? { ...p, statuses: s.statuses, majorLeft: s.majorLeft, minorLeft: s.minorLeft } : p
      }),
      history: encounter.history.slice(0, -1),
    }
  }
  const order = turnOrder(encounter, stats).filter((p) => !p.out)
  const index = order.findIndex((p) => p.id === encounter.activeId)
  if (index > 0) return { ...encounter, activeId: order[index - 1].id }
  if (encounter.round > 1) return { ...encounter, round: encounter.round - 1, activeId: order.at(-1)?.id ?? null }
  return encounter
}

/** Whether Back has anywhere to go. */
export function canGoBack(encounter: Encounter, stats: Map<string, CombatantStats>): boolean {
  if (encounter.round === 0) return false
  if (encounter.history.length > 0) return true
  const order = turnOrder(encounter, stats).filter((p) => !p.out)
  return encounter.round > 1 || order.findIndex((p) => p.id === encounter.activeId) > 0
}

/** End the fight: no round, no active turn, no history. Damage, statuses and initiative stay. */
export function endCombat(encounter: Encounter): Encounter {
  return { ...encounter, round: 0, activeId: null, history: [] }
}

function finishRound(encounter: Encounter, stats: Map<string, CombatantStats>): TurnResult {
  const messages: string[] = []
  const participants = encounter.participants.map((p) => {
    if (p.out) return p
    const statuses = p.statuses.flatMap((s) => {
      const def = STATUS_BY_NAME.get(s.name.toLowerCase())
      if (def?.roundDamage && s.value > 0) {
        messages.push(
          `${p.name}: resist ${statusLabel(s)} (${def.roundDamage === 'P' ? 'Physical' : def.roundDamage}) with Body.`,
        )
      }
      // Poison weakens by 1 each round (p. 53).
      const value = def?.name === 'Poisoned' ? Math.max(0, s.value - 1) : s.value
      const rounds = s.rounds === null ? null : s.rounds - 1
      if (rounds !== null && rounds <= 0) {
        messages.push(`${p.name}: ${statusLabel(s)} wears off.`)
        return []
      }
      if (def?.name === 'Poisoned' && value === 0) return []
      return [{ ...s, value, rounds }]
    })
    return { ...p, statuses }
  })
  const next = refill({ ...encounter, participants, round: encounter.round + 1 }, stats)
  const order = turnOrder(next, stats).filter((p) => !p.out)
  return { encounter: { ...next, activeId: order[0]?.id ?? null }, messages }
}

/** Add enemies from a book stat block. Several at once form a grunt group with shared Edge. */
export function addNpcs(encounter: Encounter, npc: NpcEntry, count: number): Encounter {
  const existing = encounter.participants.filter((p) => p.npc?.name === npc.name).length
  const grouped = count > 1
  const group = grouped ? `${npc.name}${existing ? ` (${Math.floor(existing / count) + 2})` : ''}` : ''
  const stats = npcStats(npc)
  const added = Array.from({ length: count }, (_, i) =>
    ParticipantSchema.parse({
      kind: 'npc',
      name: count > 1 || existing ? `${npc.name} ${existing + i + 1}` : npc.name,
      group,
      npc,
      edge: stats.isGrunt ? 0 : stats.edge,
    }),
  )
  return {
    ...encounter,
    participants: [...encounter.participants, ...added],
    groupEdge: group && stats.isGrunt ? { ...encounter.groupEdge, [group]: stats.edge } : encounter.groupEdge,
  }
}

export function newEncounter(name: string): Encounter {
  return EncounterSchema.parse({ name })
}
