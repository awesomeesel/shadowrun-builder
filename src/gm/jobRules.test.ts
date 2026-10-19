import { describe, expect, it } from 'vitest'
import { newJob, putJob, sortJobs } from './jobRules'

const job = (title: string, status: ReturnType<typeof newJob>['status'], at: string) => ({
  ...newJob(),
  title,
  status,
  createdAt: at,
  updatedAt: at,
})

describe('jobs', () => {
  it('lists open jobs by how far along they are, then finished ones newest first', () => {
    const jobs = [
      job('Old win', 'done', '2026-01-01'),
      job('Offer', 'offered', '2026-01-02'),
      job('Heist', 'underway', '2026-01-03'),
      job('Recent loss', 'failed', '2026-02-01'),
      job('Prep', 'legwork', '2026-01-04'),
    ]
    expect(sortJobs(jobs).map((j) => j.title)).toEqual(['Heist', 'Prep', 'Offer', 'Recent loss', 'Old win'])
  })

  it('adds or replaces a job and stamps it', () => {
    const a = job('A', 'offered', '2026-01-01')
    const added = putJob([], a)
    expect(added).toHaveLength(1)
    const changed = putJob(added, { ...a, title: 'A2' })
    expect(changed.map((j) => j.title)).toEqual(['A2'])
    expect(changed[0].updatedAt > a.updatedAt).toBe(true)
  })
})
