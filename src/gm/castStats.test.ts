import { describe, expect, it } from 'vitest'
import type { CastMember } from '../db/db'
import { createCharacter, PlayStatusSchema } from '../model/character'
import { ParticipantSchema } from '../model/encounter'
import { combatantStats, newEncounter, turnOrder } from '../rules/sr6/encounter'
import type { NpcEntry } from '../rules/sr6/npc'
import { addCastMember, castStatsSummary } from './castStats'

const member = (extra: Partial<CastMember>): CastMember => ({
  id: crypto.randomUUID(),
  name: 'Mr. Chen',
  role: 'Fixer',
  attitude: 'neutral',
  notes: 'Owes Rook a favour',
  updatedAt: '',
  ...extra,
})

const block = {
  kind: 'npc',
  name: 'Fixer',
  category: 'Contacts',
  page: 1,
  professionalRating: null,
  metatype: 'human',
  attributes: {
    body: { base: 3, augmented: 3 },
    reaction: { base: 3, augmented: 3 },
    intuition: { base: 4, augmented: 4 },
  },
  defenseRating: 3,
  initiative: { score: 7, dice: 1 },
  actions: '',
  monitor: { physical: null, stun: null },
  move: '',
  skills: '',
  knowledge: '',
  gear: '',
  augmentations: '',
  weapons: '',
  spells: '',
  powers: '',
  weaknesses: '',
  notes: '',
} as unknown as NpcEntry

describe('cast in encounters', () => {
  it('adds a member with a stat block under their own name, with their notes', () => {
    const e = addCastMember(newEncounter('Test'), member({ npc: block }))
    expect(e.participants).toHaveLength(1)
    expect(e.participants[0]).toMatchObject({ kind: 'npc', name: 'Mr. Chen', notes: 'Owes Rook a favour' })
  })

  it('adds quick-number members, and leaves out those without stats', () => {
    const custom = { initiativeScore: 9, initiativeDice: 2, defenseRating: 5, monitor: 11, pool: 10 }
    expect(addCastMember(newEncounter('Test'), member({ custom })).participants[0]).toMatchObject({
      kind: 'custom',
      custom,
    })
    expect(addCastMember(newEncounter('Test'), member({})).participants).toHaveLength(0)
    expect(castStatsSummary(member({}))).toMatch(/roleplay/)
  })
})

describe('runner statuses from the sheet', () => {
  it('count for the turn order', () => {
    const sheet = createCharacter({ name: 'Rook' })
    sheet.play.statuses = [PlayStatusSchema.parse({ name: 'Dazed' })]
    const runner = ParticipantSchema.parse({ kind: 'runner', name: 'Rook', characterId: 'x', initiative: 12 })
    const thug = ParticipantSchema.parse({ kind: 'custom', name: 'Thug', initiative: 10 })
    const enc = { ...newEncounter('Test'), participants: [runner, thug] }
    const stats = new Map([
      [runner.id, combatantStats(runner, sheet)],
      [thug.id, combatantStats(thug)],
    ])
    // Dazed: −4, so Rook (12 → 8) goes after the thug (10).
    expect(turnOrder(enc, stats).map((p) => p.name)).toEqual(['Thug', 'Rook'])
  })
})
