import { describe, expect, it } from 'vitest'
import { ParticipantSchema } from '../../model/encounter'
import { combatantStats, woundModifier } from './encounter'
import { hostAttributes, isStandardSpread } from './ic'

describe('hosts and IC (p. 185–187)', () => {
  it('spreads a host rating over its four attributes', () => {
    expect(hostAttributes(4)).toEqual({ attack: 4, sleaze: 5, dataProcessing: 6, firewall: 7 })
    expect(isStandardSpread(4, { attack: 5, sleaze: 4, dataProcessing: 7, firewall: 6 })).toBe(true)
    expect(isStandardSpread(4, { attack: 8, sleaze: 4, dataProcessing: 7, firewall: 6 })).toBe(false)
  })

  it('gives IC the host rating × 2 for attacks and boxes, and DP × 2 + 3D6 initiative', () => {
    const killer = ParticipantSchema.parse({
      kind: 'ic',
      name: 'Killer IC',
      ic: {
        type: 'killer',
        hostName: 'Stuffer Shack',
        hostRating: 4,
        attack: 5,
        sleaze: 4,
        dataProcessing: 7,
        firewall: 6,
      },
    })
    const s = combatantStats(killer)
    expect(s.initiative).toEqual({ score: 14, dice: 3 })
    expect(s.defenseRating).toBe(13)
    expect(s.monitor).toEqual({ physical: 8, stun: null })
    expect(s.pools.find((p) => p.label === 'Attack')).toMatchObject({ pool: 8 })
    expect(s.pools.find((p) => p.label === 'Attack')?.info).toMatch(/Intuition \+ Firewall/)
    // Programs don't suffer wound modifiers.
    expect(woundModifier({ ...killer, damage: { physical: 6, stun: 0 } }, s)).toBe(0)
  })

  it('gives Patrol IC no attack, only Matrix Perception', () => {
    const patrol = ParticipantSchema.parse({
      kind: 'ic',
      name: 'Patrol IC',
      ic: { type: 'patrol', hostName: 'H', hostRating: 3, attack: 3, sleaze: 4, dataProcessing: 5, firewall: 6 },
    })
    const labels = combatantStats(patrol).pools.map((p) => p.label)
    expect(labels).not.toContain('Attack')
    expect(labels).toContain('Matrix Perception')
  })
})
