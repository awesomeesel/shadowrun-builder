import { describe, expect, it } from 'vitest'
import { WeaponSchema, createCharacter } from '../../model/character'
import {
  addLedgerEntry,
  ammoCapacity,
  endSession,
  removeLedgerEntry,
  rollPool,
  sessionEntries,
  startSession,
} from './play'

const pistol = WeaponSchema.parse({ id: 'gun', name: 'Test pistol', ammo: '15(c)' })
const knife = WeaponSchema.parse({ id: 'knife', name: 'Knife', ammo: '' })

function runner() {
  return createCharacter({
    attributes: { ...createCharacter().attributes, edge: 4 },
    weapons: [pistol, knife],
    nuyen: 1000,
    karma: { available: 2, career: 10 },
  })
}

describe('sessions', () => {
  it('refills Edge and loads weapons when a session starts', () => {
    const c = startSession(runner(), 'Run 1', new Date('2026-10-05T18:00:00Z'))
    expect(c.play.session).toMatchObject({ title: 'Run 1', startedAt: '2026-10-05T18:00:00.000Z' })
    expect(c.play.edge).toBe(4)
    expect(c.play.ammo).toEqual({ gun: 15 })
  })

  it('keeps partly used magazines between sessions', () => {
    const c = startSession({ ...runner(), play: { ...runner().play, ammo: { gun: 3 } } }, 'Run 2')
    expect(c.play.ammo.gun).toBe(3)
  })

  it('tracks money and karma and summarises them when the session ends', () => {
    let c = startSession(runner(), 'Run 1', new Date('2026-10-05T18:00:00Z'))
    c = addLedgerEntry(c, { nuyen: 5000, note: 'Paid by Mr. Johnson' }, new Date('2026-10-05T20:00:00Z'))
    c = addLedgerEntry(c, { nuyen: -300, note: 'Ammo' }, new Date('2026-10-05T20:10:00Z'))
    c = addLedgerEntry(c, { karma: 5, note: 'Run reward' }, new Date('2026-10-05T22:00:00Z'))
    expect(c.nuyen).toBe(5700)
    expect(c.karma).toEqual({ available: 7, career: 15 })
    expect(sessionEntries(c)).toHaveLength(3)

    c = { ...c, damage: { physical: 4, stun: 6, overflow: 0 } }
    c = endSession(c, { clearStun: true, clearPhysical: false }, new Date('2026-10-05T23:00:00Z'))
    expect(c.play.session).toBeNull()
    expect(c.damage).toEqual({ physical: 4, stun: 0, overflow: 0 })
    expect(c.sessions).toEqual([
      expect.objectContaining({ title: 'Run 1', nuyen: 4700, karma: 5, endedAt: '2026-10-05T23:00:00.000Z' }),
    ])
  })

  it('does not count karma spent toward career karma', () => {
    const c = addLedgerEntry(runner(), { karma: -2, note: 'Raised a skill' })
    expect(c.karma).toEqual({ available: 0, career: 10 })
  })

  it('undoes a ledger entry', () => {
    const added = addLedgerEntry(runner(), { nuyen: 500, karma: 3, note: 'Oops' })
    const undone = removeLedgerEntry(added, added.ledger[0].id)
    expect(undone.nuyen).toBe(1000)
    expect(undone.karma).toEqual({ available: 2, career: 10 })
    expect(undone.ledger).toEqual([])
  })

  it('reads ammo capacity from the ammo text', () => {
    expect(ammoCapacity(pistol)).toBe(15)
    expect(ammoCapacity(knife)).toBe(0)
  })
})

describe('rollPool', () => {
  const fixed = (faces: number[]) => {
    let i = 0
    return () => (faces[i++] - 1) / 6
  }

  it('counts hits on 5 and 6', () => {
    expect(rollPool(4, fixed([5, 6, 4, 1]))).toMatchObject({ dice: [5, 6, 4, 1], hits: 2, glitch: false })
  })

  it('flags glitches and critical glitches', () => {
    expect(rollPool(3, fixed([1, 1, 5]))).toMatchObject({ hits: 1, glitch: true, criticalGlitch: false })
    expect(rollPool(3, fixed([1, 1, 3]))).toMatchObject({ hits: 0, glitch: true, criticalGlitch: true })
  })

  it('handles empty pools', () => {
    expect(rollPool(0)).toMatchObject({ dice: [], hits: 0, glitch: false })
  })
})
