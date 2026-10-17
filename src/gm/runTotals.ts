import type { CampaignRun } from '../db/db'

/** Totals per runner over the runs they played. */
export function runTotals(runs: CampaignRun[]): { name: string; runs: number; karma: number; nuyen: number }[] {
  const totals = new Map<string, { name: string; runs: number; karma: number; nuyen: number }>()
  for (const run of runs) {
    run.runnerIds.forEach((id, i) => {
      const t = totals.get(id) ?? { name: run.runnerNames[i] ?? '?', runs: 0, karma: 0, nuyen: 0 }
      t.runs++
      t.karma += run.karma
      t.nuyen += run.nuyen
      totals.set(id, t)
    })
  }
  return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name))
}
