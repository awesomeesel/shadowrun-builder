import { describe, expect, it } from 'vitest'
import { runTotals } from './runTotals'

const run = (karma: number, nuyen: number, runners: [string, string][]) => ({
  id: crypto.randomUUID(),
  date: '2026-10-18',
  title: '',
  notes: '',
  karma,
  nuyen,
  runnerIds: runners.map(([id]) => id),
  runnerNames: runners.map(([, name]) => name),
})

describe('run log totals', () => {
  it('adds up karma and nuyen for the runs each runner played', () => {
    const totals = runTotals([
      run(5, 4000, [
        ['a', 'Sly'],
        ['b', 'Bricks'],
      ]),
      run(6, 6000, [['a', 'Sly']]),
    ])
    expect(totals).toEqual([
      { name: 'Bricks', runs: 1, karma: 5, nuyen: 4000 },
      { name: 'Sly', runs: 2, karma: 11, nuyen: 10000 },
    ])
  })
})
