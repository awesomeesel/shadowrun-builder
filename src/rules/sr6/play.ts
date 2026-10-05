import {
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
  })
  return {
    ...character,
    damage: {
      ...character.damage,
      stun: options.clearStun ? 0 : character.damage.stun,
      physical: options.clearPhysical ? 0 : character.damage.physical,
      overflow: options.clearPhysical ? 0 : character.damage.overflow,
    },
    sessions: [...character.sessions, record],
    play: { ...character.play, session: null },
  }
}

/** Most rolls a session keeps for its summary. */
const MAX_SESSION_ROLLS = 300

/** Remember a roll made during the running session. */
export function recordRoll(character: Character, label: string, roll: Roll, total: number | null = null): Character {
  const session = character.play.session
  if (!session) return character
  // Initiative is a total, not a test, so it can't glitch.
  const record = RollRecordSchema.parse({
    label,
    total,
    ...roll,
    ...(total !== null ? { glitch: false, criticalGlitch: false } : {}),
  })
  return {
    ...character,
    play: { ...character.play, session: { ...session, rolls: [...session.rolls, record].slice(-MAX_SESSION_ROLLS) } },
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
  pool: number
  dice: number[]
  /** Dice showing 5 or 6. */
  hits: number
  ones: number
  /** More than half the dice show 1. */
  glitch: boolean
  /** A glitch with no hits. */
  criticalGlitch: boolean
}

/** Roll a Shadowrun dice pool: d6s, hits on 5+, glitch when over half are 1s. */
export function rollPool(pool: number, random: () => number = secureRandom): Roll {
  const size = Math.max(0, Math.floor(pool))
  const dice = Array.from({ length: size }, () => 1 + Math.floor(random() * 6))
  const hits = dice.filter((d) => d >= 5).length
  const ones = dice.filter((d) => d === 1).length
  const glitch = size > 0 && ones > size / 2
  return { pool: size, dice, hits, ones, glitch, criticalGlitch: glitch && hits === 0 }
}

function secureRandom(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] / 2 ** 32
}
