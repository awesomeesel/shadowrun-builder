import type { SharedSheet } from '../db/db'
import type { Character } from '../model/character'

export interface FeedRoll {
  key: string
  runner: string
  label: string
  pool: number
  hits: number
  glitch: boolean
  criticalGlitch: boolean
  /** Initiative total; null for tests. */
  total: number | null
  edge: number
  at: string
}

/** The latest rolls from the runners' running sessions, newest first. Rolls from before timestamps are left out. */
export function tableFeed(sheets: SharedSheet[], limit = 20): FeedRoll[] {
  const rolls: FeedRoll[] = []
  for (const sheet of sheets) {
    const session = sheet.character.play.session
    for (const [i, r] of (session?.rolls ?? []).entries()) {
      if (!r.at) continue
      rolls.push({ ...r, key: `${sheet.id}/${i}`, runner: sheet.character.name, at: r.at })
    }
  }
  return rolls.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

/** Initiative a runner rolled on their own sheet for the fight they're in, if any. */
export function playerInitiative(character: Character | undefined): { value: number; at?: string } | null {
  const combat = character?.play.combat
  return combat ? { value: combat.initiative, at: combat.rolledAt } : null
}
