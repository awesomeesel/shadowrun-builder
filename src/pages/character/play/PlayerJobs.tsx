import { useLiveQuery } from 'dexie-react-hooks'
import { Briefcase, CheckCircle2, Circle, Clock } from 'lucide-react'
import { useState } from 'react'
import { Section } from '../../../components/ui'
import { db, type PlayerJob } from '../../../db/db'
import { isFinished, JOB_STATUSES } from '../../../gm/jobRules'

/**
 * The jobs the GM shows the players, from every campaign this runner is
 * shared in: who's paying, the deadline, what was said and how far along
 * the team is. Read-only; the GM ticks off objectives.
 */
export function PlayerJobs({ characterId }: { characterId: string }) {
  const boards = useLiveQuery(async () => {
    const campaigns = (await db.campaigns.where('role').equals('player').toArray()).filter(
      (c) => !c.closed && c.characterIds.includes(characterId),
    )
    const result: { campaign: string; jobs: PlayerJob[] }[] = []
    for (const c of campaigns) {
      const board = await db.jobBoards.get(c.id)
      if (board?.jobs.length) result.push({ campaign: c.name, jobs: board.jobs })
    }
    return result
  }, [characterId])
  const [showDone, setShowDone] = useState(false)
  if (!boards?.length) return null
  const several = boards.length > 1

  return (
    <Section title="Jobs" icon={<Briefcase className="size-4" />}>
      <div className="grid gap-3">
        {boards.map((b) => {
          const open = b.jobs.filter((j) => !isFinished(j))
          const done = b.jobs.filter((j) => isFinished(j))
          return (
            <div key={b.campaign}>
              {several && <div className="mb-1 text-xs tracking-wider text-muted uppercase">{b.campaign}</div>}
              {open.length === 0 && <p className="text-sm text-muted">No open jobs right now.</p>}
              <ul className="grid gap-2">
                {[...open, ...(showDone ? done : [])].map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </ul>
              {done.length > 0 && (
                <button className="mt-1 text-xs text-muted hover:text-fg" onClick={() => setShowDone(!showDone)}>
                  {showDone ? 'Hide' : 'Show'} finished jobs ({done.length})
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function JobCard({ job }: { job: PlayerJob }) {
  const status = JOB_STATUSES.find((s) => s.id === job.status)
  const done = job.objectives.filter((o) => o.done).length
  return (
    <li className="rounded-lg border border-line bg-bg/40 p-3 text-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{job.title || 'A job'}</div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted">
            {job.kind && <span>{job.kind}</span>}
            {job.johnson && <span>for {job.johnson}</span>}
            {(job.nuyen > 0 || job.karma > 0) && (
              <span className="text-fg">
                {[job.nuyen > 0 && `${job.nuyen.toLocaleString()}¥`, job.karma > 0 && `${job.karma} karma`]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                each
              </span>
            )}
            {job.deadline && (
              <span className="flex items-center gap-1 text-amber">
                <Clock className="size-3" /> {job.deadline}
              </span>
            )}
          </div>
        </div>
        {status && <span className={`chip shrink-0 text-xs ${status.tone}`}>{status.label}</span>}
      </div>
      {job.brief && <p className="mt-1.5 whitespace-pre-wrap text-muted">{job.brief}</p>}
      {job.objectives.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-muted">
            Objectives {done}/{job.objectives.length}
          </div>
          <ul className="grid gap-1">
            {job.objectives.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                {o.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted" />
                )}
                <span className={o.done ? 'text-muted line-through' : ''}>{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
