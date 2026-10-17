import {
  CombatSchema,
  LedgerEntrySchema,
  RollRecordSchema,
  SessionRecordSchema,
  type Character,
  type SessionRecord,
  type Weapon,
} from '../../model/character'
import { computeDerived } from './derived'

/** Rounds a weapon holds, from its ammo text like "15(c)". 0 when it doesn't use ammo. */
export function ammoCapacity(weapon: Weapon): number {
  const match = weapon.ammo.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

/** Start a session: Edge refills to the character's rating and empty magazines are loaded. */
export function startSession(character: Character, title: string, now = new Date()): Character {
  const ammo = { ...character.play.ammo }
  for (const weapon of character.weapons) {
    if (ammo[weapon.id] === undefined && ammoCapacity(weapon) > 0) ammo[weapon.id] = ammoCapacity(weapon)
  }
  return {
    ...character,
    play: {
      ...character.play,
      edge: computeDerived(character).attributes.edge,
      ammo,
      combat: null,
      session: {
        title,
        startedAt: now.toISOString(),
        notes: '',
        edgeStart: computeDerived(character).attributes.edge,
        rolls: [],
      },
    },
  }
}

/** Record a nuyen/karma change. Positive karma also counts toward career karma. */
export function addLedgerEntry(
  character: Character,
  change: { nuyen?: number; karma?: number; note?: string },
  now = new Date(),
): Character {
  const entry = LedgerEntrySchema.parse({ ...change, date: now.toISOString() })
  return {
    ...character,
    nuyen: character.nuyen + entry.nuyen,
    karma: {
      available: character.karma.available + entry.karma,
      career: character.karma.career + Math.max(0, entry.karma),
    },
    ledger: [...character.ledger, entry],
  }
}

/** Undo a ledger entry, reversing its effect on nuyen and karma. */
export function removeLedgerEntry(character: Character, id: string): Character {
  const entry = character.ledger.find((e) => e.id === id)
  if (!entry) return character
  return {
    ...character,
    nuyen: character.nuyen - entry.nuyen,
    karma: {
      available: character.karma.available - entry.karma,
      career: character.karma.career - Math.max(0, entry.karma),
    },
    ledger: character.ledger.filter((e) => e.id !== id),
  }
}

/** Ledger entries made since the current session started. */
export function sessionEntries(character: Character) {
  const session = character.play.session
  return session ? character.ledger.filter((e) => e.date >= session.startedAt) : []
}

export interface EndSessionOptions {
  /** Stun damage normally wears off between sessions. */
  clearStun: boolean
  clearPhysical: boolean
  /** Heat and Reputation gained (or lost) on this run. */
  heat?: number
  reputation?: number
}

/** Close the session and save a summary of what happened to the session log. */
export function endSession(character: Character, options: EndSessionOptions, now = new Date()): Character {
  const session = character.play.session
  if (!session) return character
  const entries = sessionEntries(character)
  const record = SessionRecordSchema.parse({
    title: session.title,
    startedAt: session.startedAt,
    endedAt: now.toISOString(),
    nuyen: entries.reduce((sum, e) => sum + e.nuyen, 0),
    karma: entries.reduce((sum, e) => sum + e.karma, 0),
    notes: session.notes,
    entries: entries.map(({ note, nuyen, karma }) => ({ note, nuyen, karma })),
    damage: { physical: character.damage.physical, stun: character.damage.stun },
    edgeStart: session.edgeStart,
    edgeEnd: character.play.edge,
    rolls: session.rolls,
    heat: options.heat ?? 0,
    reputation: options.reputation ?? 0,
  })
  return {
    ...character,
    heat: Math.max(0, character.heat + (options.heat ?? 0)),
    reputation: character.reputation + (options.reputation ?? 0),
    damage: {
      ...character.damage,
      stun: options.clearStun ? 0 : character.damage.stun,
      physical: options.clearPhysical ? 0 : character.damage.physical,
      overflow: options.clearPhysical ? 0 : character.damage.overflow,
    },
    sessions: [...character.sessions, record],
    play: { ...character.play, session: null, combat: null },
  }
}

/** Most rolls a session keeps for its summary. */
const MAX_SESSION_ROLLS = 300

/**
 * Remember a roll made during the running session. With `replace`, the last
 * roll is updated instead (after Edge changed its result).
 */
export function recordRoll(
  character: Character,
  label: string,
  roll: Roll,
  total: number | null = null,
  replace = false,
): Character {
  const session = character.play.session
  if (!session) return character
  // Initiative is a total, not a test, so it can't glitch.
  const record = RollRecordSchema.parse({
    label,
    total,
    pool: roll.pool,
    hits: roll.hits,
    glitch: roll.glitch,
    criticalGlitch: roll.criticalGlitch,
    edge: roll.edge,
    ...(total !== null ? { glitch: false, criticalGlitch: false } : {}),
  })
  const rolls = replace && session.rolls.length ? session.rolls.slice(0, -1) : session.rolls
  return {
    ...character,
    play: { ...character.play, session: { ...session, rolls: [...rolls, record].slice(-MAX_SESSION_ROLLS) } },
  }
}

/** Update a logged session, e.g. to add notes afterwards. */
export function updateSessionRecord(character: Character, id: string, change: Partial<SessionRecord>): Character {
  return { ...character, sessions: character.sessions.map((s) => (s.id === id ? { ...s, ...change } : s)) }
}

export function deleteSessionRecord(character: Character, id: string): Character {
  return { ...character, sessions: character.sessions.filter((s) => s.id !== id) }
}

/** "3 h 12 min" between two ISO timestamps. */
export function formatDuration(startedAt: string, endedAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000))
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
}

/** A few plain sentences describing what happened in a logged session. */
export function sessionSummary(record: SessionRecord): string[] {
  const lines = [`Played for ${formatDuration(record.startedAt, record.endedAt)}.`]
  // Group by direction so it reads "Earned 8,000¥ and 5 karma", not "earned … and earned …".
  const amounts = [
    { value: record.nuyen, text: `${Math.abs(record.nuyen).toLocaleString()}¥` },
    { value: record.karma, text: `${Math.abs(record.karma)} karma` },
  ]
  const earned = amounts.filter((a) => a.value > 0).map((a) => a.text)
  const spent = amounts.filter((a) => a.value < 0).map((a) => a.text)
  const money = [
    ...(earned.length ? [`earned ${earned.join(' and ')}`] : []),
    ...(spent.length ? [`spent ${spent.join(' and ')}`] : []),
  ]
  if (money.length) lines.push(`${capitalize(money.join('; '))}.`)
  const standing: string[] = []
  if (record.heat) standing.push(`Heat ${record.heat > 0 ? '+' : ''}${record.heat}`)
  if (record.reputation) standing.push(`Reputation ${record.reputation > 0 ? '+' : ''}${record.reputation}`)
  if (standing.length) lines.push(`${standing.join(', ')}.`)
  const hurt: string[] = []
  if (record.damage.physical) hurt.push(`${record.damage.physical} Physical`)
  if (record.damage.stun) hurt.push(`${record.damage.stun} Stun`)
  if (hurt.length) lines.push(`Ended with ${hurt.join(' and ')} damage.`)
  if (record.edgeStart !== null && record.edgeEnd !== null && record.edgeStart !== record.edgeEnd) {
    const diff = record.edgeStart - record.edgeEnd
    lines.push(diff > 0 ? `Spent ${diff} Edge.` : `Gained ${-diff} Edge.`)
  }
  const tests = record.rolls.filter((r) => r.total === null)
  if (record.rolls.length) {
    const best = [...tests].sort((a, b) => b.hits - a.hits)[0]
    const glitches = tests.filter((r) => r.glitch).length
    let line = `Rolled ${record.rolls.length} ${record.rolls.length === 1 ? 'time' : 'times'}`
    if (best) line += `; best was ${best.hits} ${best.hits === 1 ? 'hit' : 'hits'} on ${best.label}`
    if (glitches) line += `; ${glitches} ${glitches === 1 ? 'glitch' : 'glitches'}`
    lines.push(`${line}.`)
  }
  return lines
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export interface Roll {
  /** Dice rolled, not counting extra dice from exploding 6s. */
  pool: number
  /** Every die, including extra dice from exploding 6s at the end. */
  dice: number[]
  /** Hits: dice showing 5 or 6, plus bought automatic hits. */
  hits: number
  /** Automatic hits bought with Edge. */
  autoHits: number
  ones: number
  /** More than half the dice show 1. */
  glitch: boolean
  /** A glitch with no hits. */
  criticalGlitch: boolean
  /** Edge spent on this roll. */
  edge: number
}

/** Count hits and glitches. 1s on dice added by exploding 6s don't count toward glitches (p. 47). */
function score(pool: number, dice: number[], autoHits: number, edge: number): Roll {
  const hits = dice.filter((d) => d >= 5).length + autoHits
  const ones = dice.slice(0, pool).filter((d) => d === 1).length
  const glitch = pool > 0 && ones > pool / 2
  return { pool, dice, hits, autoHits, ones, glitch, criticalGlitch: glitch && hits === 0, edge }
}

const d6 = (random: () => number) => 1 + Math.floor(random() * 6)

/**
 * Roll a Shadowrun dice pool: d6s, hits on 5+, glitch when over half are 1s.
 * With `explode`, every 6 adds another die (the 4-Edge boost).
 */
export function rollPool(
  pool: number,
  random: () => number = secureRandom,
  options: { explode?: boolean; edge?: number } = {},
): Roll {
  const size = Math.max(0, Math.floor(pool))
  const dice = Array.from({ length: size }, () => d6(random))
  if (options.explode) {
    for (let i = 0; i < dice.length && dice.length < 200; i++) if (dice[i] === 6) dice.push(d6(random))
  }
  return score(size, dice, 0, options.edge ?? 0)
}

/** Edge boosts that change a roll after it's made (Core Rulebook pp. 46–47). */
export const EDGE_BOOSTS = {
  rerollOne: { cost: 1, label: 'Reroll one die' },
  plusOne: { cost: 2, label: '+1 to one die' },
  autoHit: { cost: 3, label: 'Buy an automatic hit' },
  rerollFailures: { cost: 4, label: 'Reroll all failed dice' },
} as const
export type EdgeBoost = keyof typeof EDGE_BOOSTS

/** Cost of the 4-Edge boost that adds Edge to the pool with exploding 6s, chosen before rolling. */
export const EDGE_POOL_BOOST_COST = 4

/** Apply an after-the-roll Edge boost; `die` is the index of the die it targets, if any. */
export function boostRoll(roll: Roll, boost: EdgeBoost, die = -1, random: () => number = secureRandom): Roll {
  const dice = [...roll.dice]
  const edge = roll.edge + EDGE_BOOSTS[boost].cost
  switch (boost) {
    case 'rerollOne':
      if (dice[die] === undefined) return roll
      dice[die] = d6(random)
      break
    case 'plusOne':
      if (dice[die] === undefined || dice[die] === 6) return roll
      dice[die] += 1
      break
    case 'autoHit':
      return score(roll.pool, dice, roll.autoHits + 1, edge)
    case 'rerollFailures':
      // Not allowed after a glitch.
      if (roll.glitch) return roll
      for (let i = 0; i < dice.length; i++) if (dice[i] < 5) dice[i] = d6(random)
      break
  }
  return score(roll.pool, dice, roll.autoHits, edge)
}

function secureRandom(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] / 2 ** 32
}

// ---------------------------------------------------------------------------
// Damage

export type DamageType = 'P' | 'S'

/**
 * Fill boxes on the condition monitors (p. 38): Stun that doesn't fit becomes
 * Physical, and Physical that doesn't fit becomes Overflow.
 */
export function applyDamage(character: Character, boxes: number, type: DamageType): Character {
  if (boxes <= 0) return character
  const d = computeDerived(character)
  let { physical, stun, overflow } = character.damage
  let rest = boxes
  if (type === 'S') {
    const room = Math.max(0, d.stunMonitor.boxes - stun)
    stun += Math.min(room, rest)
    rest -= Math.min(room, rest)
  }
  const physicalRoom = Math.max(0, d.physicalMonitor.boxes - physical)
  physical += Math.min(physicalRoom, rest)
  rest -= Math.min(physicalRoom, rest)
  overflow = Math.min(d.overflow.boxes, overflow + rest)
  return { ...character, damage: { ...character.damage, physical, stun, overflow } }
}

/** Drain beyond the caster's Magic is Physical instead of Stun (p. 131). */
export function drainType(boxes: number, magic: number): DamageType {
  return boxes > magic ? 'P' : 'S'
}

/** "4P" → { value: 4, type: 'P' }; null when it can't be read. */
export function parseDamage(text: string): { value: number; type: DamageType } | null {
  const match = text.match(/(\d+)\s*([PS])/i)
  return match ? { value: parseInt(match[1], 10), type: match[2].toUpperCase() as DamageType } : null
}

// ---------------------------------------------------------------------------
// Firing modes (p. 109)

export interface FiringMode {
  id: 'SS' | 'SA' | 'BF' | 'FA'
  label: string
  rounds: number
  attackRating: number
  damage: number
}

const FIRING_MODES: FiringMode[] = [
  { id: 'SS', label: 'Single shot', rounds: 1, attackRating: 0, damage: 0 },
  { id: 'SA', label: 'Semi-auto', rounds: 2, attackRating: -2, damage: 1 },
  { id: 'BF', label: 'Burst', rounds: 4, attackRating: -4, damage: 2 },
  { id: 'FA', label: 'Full auto', rounds: 10, attackRating: -6, damage: 0 },
]

/**
 * The modes a weapon can fire in, from its modes text like "SA/BF". A semi-auto
 * weapon can also fire single shots.
 */
export function firingModes(weapon: Weapon): FiringMode[] {
  const listed = new Set(weapon.modes.toUpperCase().match(/\b(SS|SA|BF|FA)\b/g) ?? [])
  if (listed.has('SA')) listed.add('SS')
  return FIRING_MODES.filter((m) => listed.has(m.id))
}

/**
 * A shot with fewer rounds than the mode needs (p. 109): the Attack Rating
 * penalty follows the rounds fired, and damage is +1 with at least 2 rounds.
 */
export function shotWith(mode: FiringMode, loaded: number): FiringMode {
  if (loaded >= mode.rounds || mode.id === 'SS') return mode
  const rounds = Math.max(0, loaded)
  return { ...mode, rounds, attackRating: -rounds, damage: rounds >= 2 && mode.damage > 0 ? 1 : 0 }
}

/** Who gains Edge from comparing Attack Rating with Defense Rating: a difference of 4 or more (p. 106). */
export function edgeFromRatings(attackRating: number, defenseRating: number): 'attacker' | 'defender' | null {
  if (attackRating - defenseRating >= 4) return 'attacker'
  if (defenseRating - attackRating >= 4) return 'defender'
  return null
}

// ---------------------------------------------------------------------------
// Combat rounds (p. 107)

/** Minor actions per round: 1 plus 1 per initiative die, at most 5. */
export function minorActions(initiativeDice: number): number {
  return Math.min(5, 1 + initiativeDice)
}

export function startCombat(character: Character, initiative: number): Character {
  const dice = computeDerived(character).initiative.dice
  return {
    ...character,
    play: {
      ...character.play,
      combat: CombatSchema.parse({ initiative, majorLeft: 1, minorLeft: minorActions(dice) }),
    },
  }
}

export function nextRound(character: Character): Character {
  const combat = character.play.combat
  if (!combat) return character
  const dice = computeDerived(character).initiative.dice
  return {
    ...character,
    play: {
      ...character.play,
      combat: { ...combat, round: combat.round + 1, majorLeft: 1, minorLeft: minorActions(dice), edgeGained: 0 },
    },
  }
}

/** Each sustained spell is −2 dice on action tests (p. 132). */
export function sustainPenalty(character: Character): number {
  return -2 * character.play.sustained.length
}

/** Drain Value from a spell's printed drain and the adjustments chosen (p. 131). */
export function spellDrain(drain: string, ampUp: number, area: number): number {
  const base = parseInt(drain.match(/\d+/)?.[0] ?? '0', 10)
  // Amp Up: +2 drain per extra point of damage. Increase Area: +1 drain per 2 meters.
  return base + ampUp * 2 + area
}

/** Most Edge a character can gain in one combat round (p. 45). */
export const MAX_EDGE_GAIN_PER_ROUND = 2
