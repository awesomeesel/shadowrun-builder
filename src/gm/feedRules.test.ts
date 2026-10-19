import { describe, expect, it } from 'vitest'
import type { SharedSheet } from '../db/db'
import { createCharacter } from '../model/character'
import { playerInitiative, tableFeed } from './feedRules'

const sheet = (name: string, rolls: { label: string; at?: string }[]): SharedSheet => {
  const c = createCharacter()
  return {
    id: `room/${name}`,
    roomId: 'room',
    sheetId: name,
    updatedAt: '',
    receivedAt: '',
    character: {
      ...c,
      name,
      play: {
        ...c.play,
        session: {
          title: '',
          startedAt: '',
          notes: '',
          edgeStart: null,
          rolls: rolls.map((r) => ({
            pool: 8,
            hits: 2,
            glitch: false,
            criticalGlitch: false,
            total: null,
            edge: 0,
            ...r,
          })),
        },
      },
    },
  }
}

describe('table feed', () => {
  it('merges runners’ rolls, newest first, skipping ones without a time', () => {
    const feed = tableFeed([
      sheet('Buck', [
        { label: 'Old', at: undefined },
        { label: 'Shoot', at: '2026-10-19T18:02:00Z' },
      ]),
      sheet('Mika', [{ label: 'Sneak', at: '2026-10-19T18:05:00Z' }]),
    ])
    expect(feed.map((r) => `${r.runner}: ${r.label}`)).toEqual(['Mika: Sneak', 'Buck: Shoot'])
  })

  it('reads the initiative a runner rolled for their fight', () => {
    const c = createCharacter()
    expect(playerInitiative(c)).toBeNull()
    const fighting = {
      ...c,
      play: {
        ...c.play,
        combat: { round: 1, initiative: 17, majorLeft: 1, minorLeft: 2, edgeGained: 0, rolledAt: 'x' },
      },
    }
    expect(playerInitiative(fighting)).toEqual({ value: 17, at: 'x' })
  })
})
