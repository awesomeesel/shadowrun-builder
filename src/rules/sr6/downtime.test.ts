import { describe, expect, it } from 'vitest'
import { CharacterSchema, ContactSchema, LifestyleSchema } from '../../model/character'
import {
  applyDowntime,
  currentLifestyle,
  daysLeft,
  downtimeOutcome,
  emptyPlan,
  lifestyleHealingDice,
  passDays,
  reputationCost,
} from './downtime'
import { formatDays } from './format'
import { sessionSummary } from './play'

const low = (monthsPaid: number, daysUsed = 0) =>
  LifestyleSchema.parse({ name: 'Home', level: 'Low', cost: 2000, monthsPaid, daysUsed })

describe('lifestyle rent', () => {
  it('uses up paid months as days pass', () => {
    const home = low(2)
    expect(passDays(home, 10)).toEqual({ lifestyle: { ...home, daysUsed: 10 }, ranOutAfter: null })
    expect(passDays(low(2, 25), 10).lifestyle).toMatchObject({ monthsPaid: 1, daysUsed: 5 })
    expect(daysLeft(low(2, 25))).toBe(35)
  })

  it('says when rent ran out', () => {
    const { lifestyle, ranOutAfter } = passDays(low(1, 20), 14)
    expect(ranOutAfter).toBe(10)
    expect(lifestyle).toMatchObject({ monthsPaid: 0, daysUsed: 0 })
    expect(passDays(low(0), 7).ranOutAfter).toBe(0)
  })

  it('never charges the free Street lifestyle', () => {
    const street = LifestyleSchema.parse({ name: 'Street', cost: 0 })
    expect(passDays(street, 90)).toEqual({ lifestyle: street, ranOutAfter: null })
  })

  it('finds where the runner lives and the optional healing dice', () => {
    const c = CharacterSchema.parse({
      lifestyles: [low(0), LifestyleSchema.parse({ name: 'Safehouse', level: 'Middle', cost: 5000, monthsPaid: 1 })],
    })
    expect(currentLifestyle(c)?.name).toBe('Safehouse')
    expect(lifestyleHealingDice(c)).toBe(2)
    expect(lifestyleHealingDice(CharacterSchema.parse({ lifestyles: [low(0)] }))).toBe(-2)
    expect(lifestyleHealingDice(CharacterSchema.parse({}))).toBe(0)
  })
})

describe('downtime', () => {
  it('prices Reputation by the new level, or the size of a negative one', () => {
    expect(reputationCost(4, 1)).toEqual({ nuyen: 5000, karma: 1, days: 14 })
    expect(reputationCost(-12, 1).nuyen).toBe(12000)
    expect(reputationCost(0, 2).nuyen).toBe(1000 + 2000)
  })

  it('pays rent, lowers Heat, works and buys favors, then logs it', () => {
    const fixer = ContactSchema.parse({ name: 'Fixer', connection: 3, loyalty: 3 })
    const cop = ContactSchema.parse({ name: 'Cop', connection: 4, loyalty: 2 })
    const home = low(0)
    const c = CharacterSchema.parse({
      nuyen: 20000,
      karma: { available: 5, career: 5 },
      heat: 7,
      reputation: 2,
      lifestyles: [home],
      contacts: [fixer, cop],
    })
    const plan = {
      ...emptyPlan(60),
      rent: { [home.id]: 3 },
      lieLow: true,
      heatContact: cop.id,
      bribes: 1,
      workForTheMan: 1,
      favors: [{ contactId: fixer.id, pay: 'nuyen' as const }],
      notes: 'Fixed the car',
    }
    const outcome = downtimeOutcome(c, plan)
    // 7 − 2 (two months low) − 2 (cop) − 1 (bribe)
    expect(outcome.heat).toBe(-5)
    expect(outcome.nuyen).toBe(-6000 - 1000 + 2000 - 3000)
    expect(outcome.karma).toBe(-1)
    expect(outcome.ranOut).toEqual([])

    const after = applyDowntime(c, plan, new Date('2080-01-01T00:00:00Z'))
    expect(after.nuyen).toBe(12000)
    expect(after.karma.available).toBe(4)
    expect(after.heat).toBe(2)
    expect(after.lifestyles[0]).toMatchObject({ monthsPaid: 1, daysUsed: 0 })
    expect(after.contacts.find((x) => x.id === cop.id)?.loyalty).toBe(1)
    expect(after.contacts.find((x) => x.id === fixer.id)?.favors).toBe(1)
    const record = after.sessions.at(-1)!
    expect(record).toMatchObject({ kind: 'downtime', days: 60, heat: -5, notes: 'Fixed the car' })
    expect(sessionSummary(record)[0]).toBe('2 months of downtime.')
  })

  it("doesn't lower Heat below 0 or bribe away Heat that isn't there", () => {
    const c = CharacterSchema.parse({ heat: 1 })
    const outcome = downtimeOutcome(c, { ...emptyPlan(90), lieLow: true, bribes: 3 })
    expect(outcome.heat).toBe(-1)
    expect(outcome.nuyen).toBe(0)
  })

  it('warns when rent runs out and when activities take too long', () => {
    const home = low(1, 25)
    const c = CharacterSchema.parse({ lifestyles: [home], karma: { available: 5 } })
    const outcome = downtimeOutcome(c, { ...emptyPlan(7), workForTheMan: 2 })
    expect(outcome.ranOut).toEqual([{ name: 'Home', day: 5 }])
    expect(outcome.busyDays).toBe(14)
  })
})

describe('formatDays', () => {
  it('reads naturally', () => {
    expect(formatDays(1)).toBe('1 day')
    expect(formatDays(14)).toBe('2 weeks')
    expect(formatDays(10)).toBe('10 days')
    expect(formatDays(35)).toBe('1 month and 5 days')
  })
})
