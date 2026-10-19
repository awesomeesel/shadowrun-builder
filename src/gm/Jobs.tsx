import { Briefcase, Check, Clock, Pencil, Plus, Swords, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import { db, type Campaign, type CampaignJob } from '../db/db'
import type { Encounter } from '../model/encounter'
import { newEncounter } from '../rules/sr6/encounter'
import { isFinished, JOB_KINDS, JOB_STATUSES, newJob, putJob, sortJobs } from './jobRules'
import { updateCampaign } from './store'

const formatNuyen = (n: number) => `${n.toLocaleString()}¥`
const statusOf = (job: CampaignJob) => JOB_STATUSES.find((s) => s.id === job.status) ?? JOB_STATUSES[0]

/**
 * The campaign's jobs: who's paying, what has to happen, the twists only the
 * GM knows, and the encounters that belong to each. Finishing one opens the
 * run log with the pay filled in.
 */
export function JobsSection({
  campaign,
  encounters,
  onPayOut,
}: {
  campaign: Campaign
  encounters: Encounter[]
  /** The job is done: log the run and pay the runners. */
  onPayOut: (job: CampaignJob) => void
}) {
  const jobs = sortJobs(campaign.jobs ?? [])
  const [editing, setEditing] = useState<CampaignJob | null>(null)
  const [showFinished, setShowFinished] = useState(false)
  const save = (job: CampaignJob) => {
    void updateCampaign(campaign.id, { jobs: putJob(campaign.jobs ?? [], job) })
    setEditing(null)
  }
  const remove = (job: CampaignJob) => {
    if (confirm(`Delete the job "${job.title}"? Its encounters stay.`))
      void updateCampaign(campaign.id, { jobs: (campaign.jobs ?? []).filter((j) => j.id !== job.id) })
  }
  const open = jobs.filter((j) => !isFinished(j))
  const finished = jobs.filter(isFinished)
  const card = (job: CampaignJob) => (
    <JobCard
      key={job.id}
      job={job}
      campaign={campaign}
      encounters={encounters}
      onChange={save}
      onEdit={() => setEditing(job)}
      onRemove={() => remove(job)}
      onPayOut={() => {
        save({ ...job, status: 'done' })
        onPayOut(job)
      }}
    />
  )

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
          <Briefcase className="size-5 text-accent" /> Jobs
          <span className="text-xs font-normal text-muted">players never see this</span>
        </h2>
        <button className="btn text-sm" onClick={() => setEditing(newJob())}>
          <Plus className="size-4" /> New job
        </button>
      </div>
      {jobs.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          The runs on offer and the ones underway: who’s paying and how much, the deadline, what has to get done, and
          the twists the Johnson left out. Tick off objectives as the runners go, and pay out to the run log when it’s
          over.
        </div>
      ) : (
        <div className="grid gap-3">
          {open.length > 0 ? (
            <ul className="grid gap-3 lg:grid-cols-2">{open.map(card)}</ul>
          ) : (
            <div className="card p-4 text-sm text-muted">No open jobs. Time for the fixer to call.</div>
          )}
          {finished.length > 0 && (
            <div>
              <button className="text-xs text-muted hover:text-fg" onClick={() => setShowFinished(!showFinished)}>
                {showFinished ? 'Hide' : 'Show'} finished jobs ({finished.length})
              </button>
              {showFinished && <ul className="mt-2 grid gap-3 lg:grid-cols-2">{finished.map(card)}</ul>}
            </div>
          )}
        </div>
      )}
      {editing && (
        <JobDialog
          job={editing}
          campaign={campaign}
          encounters={encounters}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

function JobCard({
  job,
  campaign,
  encounters,
  onChange,
  onEdit,
  onRemove,
  onPayOut,
}: {
  job: CampaignJob
  campaign: Campaign
  encounters: Encounter[]
  onChange: (job: CampaignJob) => void
  onEdit: () => void
  onRemove: () => void
  onPayOut: () => void
}) {
  const navigate = useNavigate()
  const cast = campaign.cast ?? []
  const johnson = cast.find((m) => m.id === job.johnsonId)
  const others = cast.filter((m) => job.castIds.includes(m.id))
  const fights = encounters.filter((e) => job.encounterIds.includes(e.id))
  const done = job.objectives.filter((o) => o.done).length
  const finished = isFinished(job)

  const newFight = async () => {
    const encounter = { ...newEncounter(`${job.title} ${fights.length + 1}`), campaignId: campaign.id }
    await db.encounters.add(encounter)
    onChange({ ...job, encounterIds: [...job.encounterIds, encounter.id] })
    navigate(`/gm/${encounter.id}`)
  }

  return (
    <li className={`card flex flex-col gap-2 p-4 text-sm ${finished ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight">{job.title || 'Untitled job'}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            {job.kind && <span>{job.kind}</span>}
            {johnson && <span>for {johnson.name}</span>}
            {(job.nuyen > 0 || job.karma > 0) && (
              <span className="text-fg">
                {job.nuyen > 0 && formatNuyen(job.nuyen)}
                {job.nuyen > 0 && job.karma > 0 && ' · '}
                {job.karma > 0 && `${job.karma} karma`} each
              </span>
            )}
            {job.deadline && !finished && (
              <span className="flex items-center gap-1 text-amber">
                <Clock className="size-3" /> {job.deadline}
              </span>
            )}
          </div>
        </div>
        <select
          {...noAutofillField}
          className={`input w-auto py-1 text-xs ${statusOf(job).tone}`}
          value={job.status}
          onChange={(e) => onChange({ ...job, status: e.target.value as CampaignJob['status'] })}
          aria-label="Status"
        >
          {JOB_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="mt-1.5 text-muted hover:text-fg" onClick={onEdit} aria-label={`Edit ${job.title}`}>
          <Pencil className="size-3.5" />
        </button>
        <button className="mt-1.5 text-muted hover:text-danger" onClick={onRemove} aria-label={`Delete ${job.title}`}>
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {job.brief && <p className="line-clamp-4 whitespace-pre-wrap text-muted">{job.brief}</p>}
      {job.twists && (
        <p className="line-clamp-3 rounded-lg border border-danger/30 bg-danger/5 px-2 py-1 whitespace-pre-wrap">
          <span className="text-xs tracking-wider text-danger uppercase">Twist </span>
          {job.twists}
        </p>
      )}
      {job.objectives.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted">
            Objectives {done}/{job.objectives.length}
          </div>
          <ul className="grid gap-1">
            {job.objectives.map((o) => (
              <li key={o.id}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-accent"
                    checked={o.done}
                    onChange={(e) =>
                      onChange({
                        ...job,
                        objectives: job.objectives.map((x) => (x.id === o.id ? { ...x, done: e.target.checked } : x)),
                      })
                    }
                  />
                  <span className={o.done ? 'text-muted line-through' : ''}>{o.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {others.map((m) => (
            <span key={m.id} className="chip" title={m.role}>
              {m.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {fights.map((e) => (
          <Link key={e.id} to={`/gm/${e.id}`} className="chip hover:border-accent/60">
            <Swords className="size-3 text-accent" /> {e.name}
          </Link>
        ))}
        {!finished && (
          <button className="text-muted hover:text-fg" onClick={() => void newFight()}>
            <Plus className="inline size-3" /> Encounter
          </button>
        )}
      </div>
      {!finished && (
        <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-2">
          <button className="btn btn-primary py-1 text-xs" onClick={onPayOut} title="Mark it done and log the pay">
            <Check className="size-3.5" /> Done, pay out
          </button>
          <button className="btn py-1 text-xs" onClick={() => onChange({ ...job, status: 'failed' })}>
            Failed
          </button>
        </div>
      )}
    </li>
  )
}

function JobDialog({
  job,
  campaign,
  encounters,
  onSave,
  onClose,
}: {
  job: CampaignJob
  campaign: Campaign
  encounters: Encounter[]
  onSave: (job: CampaignJob) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(job)
  const [objective, setObjective] = useState('')
  const cast = [...(campaign.cast ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const number = (value: string) => Math.max(0, parseInt(value, 10) || 0)
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id))
  const addObjective = () => {
    const text = objective.trim()
    if (!text) return
    setDraft({ ...draft, objectives: [...draft.objectives, { id: crypto.randomUUID(), text, done: false }] })
    setObjective('')
  }
  const save = () => {
    // An objective typed but not added yet still counts.
    const pending = objective.trim()
    onSave({
      ...draft,
      title: draft.title.trim(),
      kind: draft.kind.trim(),
      deadline: draft.deadline.trim(),
      objectives: pending
        ? [...draft.objectives, { id: crypto.randomUUID(), text: pending, done: false }]
        : draft.objectives,
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.title.trim()) save()
        }}
        aria-label="Job"
      >
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto font-display text-xl">{job.title ? `Edit ${job.title}` : 'New job'}</h2>
          <button type="button" className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label>
              <div className="mb-1 text-xs text-muted">Job</div>
              <input
                {...noAutofill}
                className="input w-full"
                placeholder="The skybar meet, the Aztechnology prototype…"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                autoFocus
              />
            </label>
            <label>
              <div className="mb-1 text-xs text-muted">Kind</div>
              <input
                {...noAutofill}
                className="input w-full"
                list="job-kinds"
                placeholder="Heist, extraction…"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              />
              <datalist id="job-kinds">
                {JOB_KINDS.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </label>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {JOB_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`chip cursor-pointer ${draft.status === s.id ? `border-current bg-bg ${s.tone}` : 'text-muted'}`}
                  onClick={() => setDraft({ ...draft, status: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-48 flex-1">
              <div className="mb-1 text-xs text-muted">Mr. Johnson</div>
              <select
                {...noAutofillField}
                className="input w-full"
                value={draft.johnsonId ?? ''}
                onChange={(e) => setDraft({ ...draft, johnsonId: e.target.value || undefined })}
              >
                <option value="">{cast.length ? 'Nobody from the cast' : 'Add them to the cast first'}</option>
                {cast.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role && ` (${m.role})`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="mb-1 text-xs text-muted">Nuyen each</div>
              <input
                {...noAutofill}
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                className="input w-32"
                value={draft.nuyen}
                onChange={(e) => setDraft({ ...draft, nuyen: number(e.target.value) })}
              />
            </label>
            <label>
              <div className="mb-1 text-xs text-muted">Karma each</div>
              <input
                {...noAutofill}
                type="number"
                min={0}
                inputMode="numeric"
                className="input w-24"
                value={draft.karma}
                onChange={(e) => setDraft({ ...draft, karma: number(e.target.value) })}
              />
            </label>
            <label className="min-w-40 flex-1">
              <div className="mb-1 text-xs text-muted">Deadline</div>
              <input
                {...noAutofill}
                className="input w-full"
                placeholder="Friday midnight, 3 days…"
                value={draft.deadline}
                onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
              />
            </label>
          </div>
          <label>
            <div className="mb-1 text-xs text-muted">The brief: what the Johnson told them</div>
            <textarea
              {...noAutofillField}
              className="input field-sizing-content min-h-20 w-full"
              placeholder="Meet on the 7th floor skybar. Get the prototype out of the dock warehouse before the auction…"
              value={draft.brief}
              onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
            />
          </label>
          <label>
            <div className="mb-1 text-xs text-muted">Twists: what the Johnson didn’t say</div>
            <textarea
              {...noAutofillField}
              className="input field-sizing-content min-h-16 w-full"
              placeholder="The Yakuza own the warehouse. The Johnson plans to sell them out…"
              value={draft.twists}
              onChange={(e) => setDraft({ ...draft, twists: e.target.value })}
            />
          </label>
          <div>
            <div className="mb-1 text-xs text-muted">Objectives</div>
            {draft.objectives.length > 0 && (
              <ul className="mb-2 grid gap-1">
                {draft.objectives.map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={o.done}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          objectives: draft.objectives.map((x) =>
                            x.id === o.id ? { ...x, done: e.target.checked } : x,
                          ),
                        })
                      }
                      aria-label="Done"
                    />
                    <input
                      {...noAutofill}
                      className="input flex-1 py-1"
                      value={o.text}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          objectives: draft.objectives.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="text-muted hover:text-danger"
                      onClick={() => setDraft({ ...draft, objectives: draft.objectives.filter((x) => x.id !== o.id) })}
                      aria-label="Remove objective"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                {...noAutofill}
                className="input flex-1 py-1"
                placeholder="Find out who’s guarding the docks"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addObjective()
                  }
                }}
              />
              <button type="button" className="btn py-1 text-xs" onClick={addObjective} disabled={!objective.trim()}>
                <Plus className="size-3.5" /> Add
              </button>
            </div>
          </div>
          {cast.some((m) => m.id !== draft.johnsonId) && (
            <div>
              <div className="mb-1 text-xs text-muted">Others from the cast in it</div>
              <div className="flex flex-wrap gap-1.5">
                {cast
                  .filter((m) => m.id !== draft.johnsonId)
                  .map((m) => {
                    const on = draft.castIds.includes(m.id)
                    return (
                      <button
                        type="button"
                        key={m.id}
                        className={`chip cursor-pointer ${on ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                        onClick={() => setDraft({ ...draft, castIds: toggle(draft.castIds, m.id, !on) })}
                      >
                        {m.name}
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
          {encounters.length > 0 && (
            <div>
              <div className="mb-1 text-xs text-muted">Encounters in it</div>
              <div className="flex flex-wrap gap-1.5">
                {encounters.map((e) => {
                  const on = draft.encounterIds.includes(e.id)
                  return (
                    <button
                      type="button"
                      key={e.id}
                      className={`chip cursor-pointer ${on ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                      onClick={() => setDraft({ ...draft, encounterIds: toggle(draft.encounterIds, e.id, !on) })}
                    >
                      {e.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!draft.title.trim()}>
              Save
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  )
}
