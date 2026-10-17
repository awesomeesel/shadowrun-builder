import { describe, expect, it } from 'vitest'
import { ParticipantSchema, type Encounter } from '../../model/encounter'
import {
  addNpcs,
  canGoBack,
  combatantStats,
  endCombat,
  endRound,
  previousTurn,
  newEncounter,
  nextTurn,
  rollInitiative,
  startCombat,
  turnOrder,
  woundModifier,
  type CombatantStats,
} from './encounter'
import { npcStats, parseSkills, parseWeapons, type NpcEntry } from './npc'

const attr = (n: number) => ({ base: n, augmented: n })

/** A made-up grunt, not taken from any book. */
const guard: NpcEntry = {
  kind: 'npc',
  page: 10,
  name: 'Test Guard',
  category: 'Grunts (Professional Rating 2)',
  professionalRating: 2,
  metatype: 'Human',
  attributes: {
    body: attr(4),
    agility: attr(3),
    reaction: attr(3),
    strength: attr(3),
    willpower: attr(5),
    logic: attr(2),
    intuition: attr(3),
    charisma: attr(2),
  },
  defenseRating: null,
  initiative: null,
  actions: 'A1, I2',
  monitor: { physical: null, stun: null },
  move: '',
  skills: 'Firearms 3 (Pistols +2), Close Combat 2, Perception 2',
  knowledge: '',
  gear: '',
  augmentations: '',
  weapons:
    'Test Pistol [Light Pistol, DV 2P, SA, Attack Ratings 8/8/6/—/—], Stick [Club, DV 3S, Attack Ratings 6/—/—/—/—]',
  spells: '',
  powers: '',
  weaknesses: '',
  notes: '',
}

const statsFor = (enc: Encounter) => new Map(enc.participants.map((p) => [p.id, combatantStats(p)]))

describe('npc stat blocks', () => {
  it('reads skills with specializations', () => {
    expect(parseSkills('Firearms 3 (Pistols +2), Close Combat 2')).toEqual([
      { name: 'Firearms', rating: 3, specs: [{ name: 'Pistols', bonus: 2 }] },
      { name: 'Close Combat', rating: 2, specs: [] },
    ])
  })

  it('reads bracketed weapons and critter attacks', () => {
    const [pistol, stick] = parseWeapons(guard.weapons)
    expect(pistol).toMatchObject({
      name: 'Test Pistol',
      type: 'Light Pistol',
      damage: '2P',
      modes: 'SA',
      skill: 'Firearms',
    })
    expect(pistol.attackRatings).toEqual([8, 8, 6, null, null])
    expect(stick).toMatchObject({ name: 'Stick', skill: 'Close Combat' })
    const [claws] = parseWeapons('Claws: DV 3P, Attack Ratings 7/—/—/—/—')
    expect(claws).toMatchObject({ name: 'Claws', damage: '3P', skill: 'Close Combat' })
  })

  it('fills in grunt numbers (p. 203)', () => {
    const s = npcStats(guard)
    expect(s.isGrunt).toBe(true)
    // 8 + half the higher of Body (4) and Willpower (5), rounded up.
    expect(s.monitor).toEqual({ physical: 11, stun: null })
    expect(s.woundStep).toBe(2)
    expect(s.initiative).toEqual({ score: 6, dice: 1 })
    expect(s.defenseRating).toBe(4)
    expect(s.edge).toBe(2)
    // Firearms 3 + Agility 3 + Pistols specialization 2.
    expect(s.pools.find((p) => p.label === 'Test Pistol')?.pool).toBe(8)
    expect(s.pools.find((p) => p.label === 'Defense')?.pool).toBe(6)
  })
})

describe('encounters', () => {
  it('adds a grunt group with shared Edge', () => {
    const enc = addNpcs(newEncounter('Test'), guard, 3)
    expect(enc.participants.map((p) => p.name)).toEqual(['Test Guard 1', 'Test Guard 2', 'Test Guard 3'])
    expect(new Set(enc.participants.map((p) => p.group))).toEqual(new Set(['Test Guard']))
    expect(enc.groupEdge).toEqual({ 'Test Guard': 2 })
    const more = addNpcs(enc, guard, 2)
    expect(more.participants.slice(3).map((p) => p.name)).toEqual(['Test Guard 4', 'Test Guard 5'])
    expect(more.participants[3].group).not.toBe('Test Guard')
  })

  it('rolls one initiative per group and leaves runners alone', () => {
    let enc = addNpcs(newEncounter('Test'), guard, 3)
    enc = { ...enc, participants: [...enc.participants, ParticipantSchema.parse({ kind: 'runner', name: 'Runner' })] }
    const rolled = rollInitiative(enc, statsFor(enc), false, () => 0.5)
    const totals = rolled.participants.filter((p) => p.kind === 'npc').map((p) => p.initiative)
    expect(new Set(totals).size).toBe(1)
    expect(totals[0]).toBe(6 + 4)
    expect(rolled.participants.find((p) => p.kind === 'runner')?.initiative).toBeNull()
  })

  it('orders by initiative, then Edge, Reaction, Intuition; out last', () => {
    const make = (name: string, initiative: number, custom = {}) =>
      ParticipantSchema.parse({ kind: 'custom', name, initiative, custom })
    const enc: Encounter = {
      ...newEncounter('Test'),
      participants: [make('Slow', 5), make('Fast', 12), make('Out', 20), make('Mid', 9)],
    }
    enc.participants[2].out = true
    expect(turnOrder(enc, statsFor(enc)).map((p) => p.name)).toEqual(['Fast', 'Mid', 'Slow', 'Out'])
  })

  it('applies status initiative changes', () => {
    const a = ParticipantSchema.parse({ kind: 'custom', name: 'A', initiative: 10 })
    const b = ParticipantSchema.parse({ kind: 'custom', name: 'B', initiative: 8, statuses: [] })
    a.statuses = [{ id: 's', name: 'Dazed', value: 0, rounds: null }]
    const enc = { ...newEncounter('Test'), participants: [a, b] }
    expect(turnOrder(enc, statsFor(enc)).map((p) => p.name)).toEqual(['B', 'A'])
  })

  it('runs turns and rounds', () => {
    const make = (name: string, initiative: number) => ParticipantSchema.parse({ kind: 'custom', name, initiative })
    let enc: Encounter = { ...newEncounter('Test'), participants: [make('A', 12), make('B', 8)] }
    const stats = statsFor(enc)
    enc = startCombat(enc, stats)
    expect(enc.round).toBe(1)
    expect(enc.activeId).toBe(enc.participants[0].id)
    enc = { ...enc, participants: enc.participants.map((p) => ({ ...p, majorLeft: 0 })) }
    enc = nextTurn(enc, stats).encounter
    expect(enc.activeId).toBe(enc.participants[1].id)
    const result = nextTurn(enc, stats)
    expect(result.encounter.round).toBe(2)
    expect(result.encounter.activeId).toBe(enc.participants[0].id)
    expect(result.encounter.participants.every((p) => p.majorLeft === 1)).toBe(true)
  })

  it('reminds about status damage and counts statuses down at the end of a round', () => {
    const p = ParticipantSchema.parse({
      kind: 'custom',
      name: 'Victim',
      initiative: 5,
      statuses: [
        { name: 'Burning', value: 3 },
        { name: 'Poisoned', value: 1 },
        { name: 'Zapped', rounds: 1 },
        { name: 'Cover', value: 2, rounds: 3 },
      ],
    })
    const enc = { ...newEncounter('Test'), participants: [p], round: 1 }
    const { encounter, messages } = endRound(enc, statsFor(enc))
    expect(messages.some((m) => m.includes('Burning 3') && m.includes('Physical'))).toBe(true)
    expect(messages.some((m) => m.includes('Poisoned 1'))).toBe(true)
    expect(messages.some((m) => m.includes('Zapped wears off'))).toBe(true)
    const statuses = encounter.participants[0].statuses
    expect(statuses.map((s) => s.name)).toEqual(['Burning', 'Cover'])
    expect(statuses[1].rounds).toBe(2)
  })

  it('takes −1 per 2 boxes for grunts and per 3 for others', () => {
    const enc = addNpcs(newEncounter('Test'), guard, 1)
    const grunt = { ...enc.participants[0], damage: { physical: 5, stun: 0 } }
    expect(woundModifier(grunt, combatantStats(grunt) as CombatantStats)).toBe(-2)
    const other = ParticipantSchema.parse({ kind: 'custom', name: 'X', damage: { physical: 5, stun: 3 } })
    expect(woundModifier(other, combatantStats(other))).toBe(-2)
  })
})

describe('joining a fight in progress', () => {
  it('rolls only for newcomers, who join their group', () => {
    let enc = rollInitiative(addNpcs(newEncounter('Test'), guard, 2), new Map(), false)
    enc = rollInitiative(enc, statsFor(enc), false, () => 0)
    const group = enc.participants[0].group
    const newcomer = ParticipantSchema.parse({ kind: 'npc', name: 'Late', group, npc: guard })
    const solo = ParticipantSchema.parse({ kind: 'custom', name: 'Solo' })
    enc = { ...enc, participants: [...enc.participants, newcomer, solo] }
    const rolled = rollInitiative(enc, statsFor(enc), false, () => 0.99, true)
    expect(rolled.participants.map((p) => p.initiative)).toEqual([7, 7, 7, 8 + 6])
  })
})

describe('going back', () => {
  const make = (name: string, initiative: number) => ParticipantSchema.parse({ kind: 'custom', name, initiative })

  it('undoes Next turn and a round end, keeping damage', () => {
    let enc: Encounter = { ...newEncounter('Test'), participants: [make('A', 12), make('B', 8)] }
    const stats = statsFor(enc)
    enc = startCombat(enc, stats)
    expect(canGoBack(enc, stats)).toBe(false)
    enc = nextTurn(enc, stats).encounter
    // B is burning and uses its Major, then the GM presses Next turn by mistake.
    enc = {
      ...enc,
      participants: enc.participants.map((p) =>
        p.name === 'B' ? { ...p, majorLeft: 0, statuses: [{ id: 's', name: 'Zapped', value: 0, rounds: 1 }] } : p,
      ),
    }
    enc = nextTurn(enc, stats).encounter
    expect(enc.round).toBe(2)
    expect(enc.participants[1].statuses).toEqual([])
    // Damage marked after the mistake survives going back.
    enc = { ...enc, participants: enc.participants.map((p) => ({ ...p, damage: { physical: 2, stun: 0 } })) }
    enc = previousTurn(enc, stats)
    expect(enc.round).toBe(1)
    expect(enc.activeId).toBe(enc.participants[1].id)
    expect(enc.participants[1].majorLeft).toBe(0)
    expect(enc.participants[1].statuses.map((s) => s.name)).toEqual(['Zapped'])
    expect(enc.participants[1].damage.physical).toBe(2)
    enc = previousTurn(enc, stats)
    expect(enc.activeId).toBe(enc.participants[0].id)
    expect(canGoBack(enc, stats)).toBe(false)
  })

  it('steps back in the order without history', () => {
    let enc: Encounter = { ...newEncounter('Test'), participants: [make('A', 12), make('B', 8)] }
    const stats = statsFor(enc)
    enc = { ...startCombat(enc, stats), round: 3, activeId: enc.participants[0].id }
    enc = previousTurn(enc, stats)
    expect(enc.round).toBe(2)
    expect(enc.activeId).toBe(enc.participants[1].id)
  })

  it('ends the fight and forgets the history', () => {
    let enc: Encounter = { ...newEncounter('Test'), participants: [make('A', 12)] }
    const stats = statsFor(enc)
    enc = nextTurn(startCombat(enc, stats), stats).encounter
    enc = endCombat(enc)
    expect(enc).toMatchObject({ round: 0, activeId: null, history: [] })
    expect(enc.participants[0].initiative).toBe(12)
  })
})
