import { describe, expect, it } from 'vitest'
import { SessionRecordSchema, WeaponSchema, createCharacter } from '../../model/character'
import {
  addLedgerEntry,
  ammoCapacity,
  applyDamage,
  boostRoll,
  drainType,
  edgeFromRatings,
  firingModes,
  minorActions,
  nextRound,
  parseDamage,
  shotWith,
  spellDrain,
  startCombat,
  sustainPenalty,
  deleteSessionRecord,
  endSession,
  recordRoll,
  removeLedgerEntry,
  rollPool,
  sessionEntries,
  sessionSummary,
  startSession,
  updateSessionRecord,
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

describe('session records', () => {
  it('keeps rolls, damage, Edge and entries, and summarises them', () => {
    let c = startSession(runner(), 'Run 1', new Date('2026-10-05T18:00:00Z'))
    const roll = (dice: number[]) =>
      rollPool(
        dice.length,
        (
          (i) => () =>
            (dice[i++] - 1) / 6
        )(0),
      )
    c = recordRoll(c, 'Firearms', roll([5, 6, 6, 2]))
    c = recordRoll(c, 'Defense', roll([1, 1, 2]))
    c = recordRoll(c, 'Initiative', roll([3, 4]), 15)
    c = addLedgerEntry(c, { nuyen: 5000, note: 'Pay' }, new Date('2026-10-05T19:00:00Z'))
    c = { ...c, damage: { physical: 3, stun: 2, overflow: 0 }, play: { ...c.play, edge: 2 } }
    c = endSession(c, { clearStun: true, clearPhysical: false }, new Date('2026-10-05T21:12:00Z'))

    const record = c.sessions[0]
    expect(record.rolls).toHaveLength(3)
    expect(record.damage).toEqual({ physical: 3, stun: 2 })
    expect(record.entries).toEqual([{ note: 'Pay', nuyen: 5000, karma: 0 }])
    expect(sessionSummary(record)).toEqual([
      'Played for 3 h 12 min.',
      'Earned 5,000¥.',
      'Ended with 3 Physical and 2 Stun damage.',
      'Spent 2 Edge.',
      'Rolled 3 times; best was 3 hits on Firearms; 1 glitch.',
    ])
    expect(record.rolls[2]).toMatchObject({ label: 'Initiative', total: 15, glitch: false })
    expect(sessionSummary({ ...record, karma: 4 })[1]).toBe('Earned 5,000¥ and 4 karma.')
    expect(sessionSummary({ ...record, nuyen: -200, karma: 4 })[1]).toBe('Earned 4 karma; spent 200¥.')
    expect(sessionSummary({ ...record, endedAt: record.startedAt })[0]).toBe('Played for under a minute.')
  })

  it('summarises old records without the newer details', () => {
    const old = SessionRecordSchema.parse({
      title: 'Old',
      startedAt: '2026-10-05T18:00:00Z',
      endedAt: '2026-10-05T18:45:00Z',
    })
    expect(sessionSummary(old)).toEqual(['Played for 45 min.'])
  })

  it('edits and deletes logged sessions', () => {
    let c = endSession(startSession(runner(), 'Run'), { clearStun: false, clearPhysical: false })
    const id = c.sessions[0].id
    c = updateSessionRecord(c, id, { notes: 'Added later' })
    expect(c.sessions[0].notes).toBe('Added later')
    expect(deleteSessionRecord(c, id).sessions).toEqual([])
  })

  it('ignores rolls outside a session', () => {
    expect(recordRoll(runner(), 'Test', rollPool(2)).play.session).toBeNull()
  })
})

/** Dice values in order, as a random source. */
const dice = (...values: number[]) => {
  let i = 0
  return () => (values[i++ % values.length] - 1) / 6
}

describe('Edge boosts', () => {
  it('explodes 6s without counting their 1s toward glitches', () => {
    const roll = rollPool(2, dice(6, 1, 1), { explode: true, edge: 4 })
    expect(roll).toMatchObject({ pool: 2, dice: [6, 1, 1], hits: 1, glitch: false, edge: 4 })
  })

  it('rerolls one die, adds 1 to a die, buys a hit and rerolls failures', () => {
    const roll = rollPool(3, dice(1, 4, 5))
    expect(boostRoll(roll, 'rerollOne', 0, dice(6))).toMatchObject({ dice: [6, 4, 5], hits: 2, edge: 1 })
    expect(boostRoll(roll, 'plusOne', 1)).toMatchObject({ dice: [1, 5, 5], hits: 2, edge: 2 })
    expect(boostRoll(roll, 'autoHit')).toMatchObject({ hits: 2, autoHits: 1, edge: 3 })
    expect(boostRoll(roll, 'rerollFailures', -1, dice(5, 6))).toMatchObject({ dice: [5, 6, 5], hits: 3, edge: 4 })
  })

  it("can't reroll failures after a glitch", () => {
    const glitched = rollPool(3, dice(1, 1, 5))
    expect(boostRoll(glitched, 'rerollFailures')).toBe(glitched)
  })
})

describe('damage', () => {
  const victim = () => createCharacter({ attributes: { ...createCharacter().attributes, body: 4, willpower: 2 } })

  it('spills Stun into Physical and Physical into Overflow', () => {
    // Body 4: 10 Physical boxes, Willpower 2: 9 Stun boxes, Overflow Body × 2 = 8.
    const stunned = applyDamage(victim(), 11, 'S')
    expect(stunned.damage).toMatchObject({ stun: 9, physical: 2, overflow: 0 })
    const dying = applyDamage(stunned, 10, 'P')
    expect(dying.damage).toMatchObject({ physical: 10, overflow: 2 })
  })

  it('makes drain above Magic Physical', () => {
    expect(drainType(3, 4)).toBe('S')
    expect(drainType(5, 4)).toBe('P')
  })

  it('reads damage codes', () => {
    expect(parseDamage('4P')).toEqual({ value: 4, type: 'P' })
    expect(parseDamage('3S(e)')).toEqual({ value: 3, type: 'S' })
    expect(parseDamage('special')).toBeNull()
  })
})

describe('firing modes', () => {
  const rifle = WeaponSchema.parse({ modes: 'SA/BF/FA', ammo: '30(c)' })

  it('lists the modes, with single shot for semi-automatics', () => {
    expect(firingModes(rifle).map((m) => [m.id, m.rounds, m.attackRating, m.damage])).toEqual([
      ['SS', 1, 0, 0],
      ['SA', 2, -2, 1],
      ['BF', 4, -4, 2],
      ['FA', 10, -6, 0],
    ])
    expect(firingModes(WeaponSchema.parse({ modes: 'SS' })).map((m) => m.id)).toEqual(['SS'])
  })

  it('weakens a burst that runs out of rounds', () => {
    const burst = firingModes(rifle)[2]
    expect(shotWith(burst, 3)).toMatchObject({ rounds: 3, attackRating: -3, damage: 1 })
    expect(shotWith(burst, 1)).toMatchObject({ rounds: 1, attackRating: -1, damage: 0 })
    expect(shotWith(burst, 30)).toBe(burst)
  })

  it('gives Edge for an Attack Rating 4 or more away from the Defense Rating', () => {
    expect(edgeFromRatings(9, 5)).toBe('attacker')
    expect(edgeFromRatings(5, 9)).toBe('defender')
    expect(edgeFromRatings(8, 5)).toBeNull()
  })
})

describe('combat rounds', () => {
  it('counts actions from initiative dice and resets them each round', () => {
    expect(minorActions(1)).toBe(2)
    expect(minorActions(5)).toBe(5)
    const fighting = startCombat(runner(), 14)
    expect(fighting.play.combat).toMatchObject({ round: 1, initiative: 14, majorLeft: 1, minorLeft: 2 })
    const used = {
      ...fighting,
      play: { ...fighting.play, combat: { ...fighting.play.combat!, majorLeft: 0, minorLeft: 0, edgeGained: 2 } },
    }
    expect(nextRound(used).play.combat).toMatchObject({ round: 2, majorLeft: 1, minorLeft: 2, edgeGained: 0 })
  })

  it('records Heat and Reputation when a session ends', () => {
    const ended = endSession(startSession(runner(), 'Loud run'), {
      clearStun: true,
      clearPhysical: false,
      heat: 2,
      reputation: 1,
    })
    expect(ended).toMatchObject({ heat: 2, reputation: 1, play: { session: null, combat: null } })
    expect(ended.sessions[0]).toMatchObject({ heat: 2, reputation: 1 })
    expect(sessionSummary(ended.sessions[0])).toContain('Heat +2, Reputation +1.')
  })
})

describe('spellcasting', () => {
  it('adds Amp Up and area to the Drain Value (p. 131)', () => {
    expect(spellDrain('5', 0, 0)).toBe(5)
    expect(spellDrain('3', 2, 1)).toBe(8)
    expect(spellDrain('', 1, 0)).toBe(2)
  })

  it('gives −2 dice per sustained spell (p. 132)', () => {
    const c = runner()
    const sustaining = {
      ...c,
      play: {
        ...c.play,
        sustained: [
          { id: 'a', name: 'Armor', hits: 3 },
          { id: 'b', name: 'Levitate', hits: 2 },
        ],
      },
    }
    expect(sustainPenalty(sustaining)).toBe(-4)
  })
})
