import { describe, expect, it } from 'vitest'
import type { NpcEntry } from '../rules/sr6/npc'
import { gruntTemplates, sampleEncounter, suggestedCounts } from './samples'

const grunt = (name: string, page: number, professionalRating: number | null) =>
  ({
    kind: 'npc',
    name,
    page,
    category: '',
    professionalRating,
    metatype: '',
    attributes: { body: { base: 3, augmented: 3 }, willpower: { base: 3, augmented: 3 } },
    defenseRating: 3,
    initiative: { score: 6, dice: 1 },
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
  }) as unknown as NpcEntry

describe('sample encounters', () => {
  const entries = [
    grunt('Rigger', 207, 3),
    grunt('Patrolman', 206, 3),
    grunt('Ganger', 205, 1),
    grunt('Dog', 220, null),
  ]

  it('finds the grunts at a rating, rank and file first', () => {
    expect(gruntTemplates(entries, 3).map((e) => e.name)).toEqual(['Patrolman', 'Rigger'])
    expect(gruntTemplates(entries, 2)).toEqual([])
  })

  it('suggests one more grunt than runners and one lieutenant', () => {
    expect(suggestedCounts(gruntTemplates(entries, 3), 4)).toEqual([5, 1])
    expect(suggestedCounts(gruntTemplates(entries, 3), 0)).toEqual([2, 1])
  })

  it('makes a grunt group with shared Edge, plus the lieutenant', () => {
    const templates = gruntTemplates(entries, 3)
    const e = sampleEncounter('Lone Star', [
      { npc: templates[0], count: 3 },
      { npc: templates[1], count: 1 },
    ])
    expect(e.participants.map((p) => p.name)).toEqual(['Patrolman 1', 'Patrolman 2', 'Patrolman 3', 'Rigger'])
    expect(e.groupEdge).toEqual({ Patrolman: 3 })
  })
})
