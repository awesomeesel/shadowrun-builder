import { LedgerEntrySchema, SessionRecordSchema, type Character, type Weapon } from '../../model/character'
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
      session: { title, startedAt: now.toISOString(), notes: '' },
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
