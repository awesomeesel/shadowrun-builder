import type { CampaignJob } from '../db/db'

export const JOB_STATUSES: { id: CampaignJob['status']; label: string; tone: string }[] = [
  { id: 'offered', label: 'Offered', tone: 'text-amber' },
  { id: 'legwork', label: 'Legwork', tone: 'text-accent' },
  { id: 'underway', label: 'Underway', tone: 'text-danger' },
  { id: 'done', label: 'Done', tone: 'text-muted' },
  { id: 'failed', label: 'Failed', tone: 'text-muted' },
]

/** Kinds of run to pick from; anything else can be typed. */
export const JOB_KINDS = [
  'Datasteal',
  'Extraction',
  'Heist',
  'Courier',
  'Wetwork',
  'Bodyguard',
  'Investigation',
  'Sabotage',
  'Smuggling',
  'Recovery',
]

export const isFinished = (job: CampaignJob) => job.status === 'done' || job.status === 'failed'

/** Open jobs first (most urgent status first), then finished ones, newest first. */
export function sortJobs(jobs: CampaignJob[]): CampaignJob[] {
  const rank = (j: CampaignJob) => ['underway', 'legwork', 'offered', 'done', 'failed'].indexOf(j.status)
  return [...jobs].sort((a, b) =>
    isFinished(a) !== isFinished(b)
      ? Number(isFinished(a)) - Number(isFinished(b))
      : isFinished(a)
        ? b.updatedAt.localeCompare(a.updatedAt)
        : rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt),
  )
}

export function newJob(): CampaignJob {
  const at = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: '',
    kind: '',
    status: 'offered',
    nuyen: 0,
    karma: 0,
    deadline: '',
    brief: '',
    twists: '',
    objectives: [],
    castIds: [],
    encounterIds: [],
    createdAt: at,
    updatedAt: at,
  }
}

/** Swap in a changed job (or add a new one), stamping it so backup merges keep the newer copy. */
export function putJob(jobs: CampaignJob[], job: CampaignJob): CampaignJob[] {
  const stamped = { ...job, updatedAt: new Date().toISOString() }
  return jobs.some((j) => j.id === job.id) ? jobs.map((j) => (j.id === job.id ? stamped : j)) : [...jobs, stamped]
}
