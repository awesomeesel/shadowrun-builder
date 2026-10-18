import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import type { Campaign, CampaignRun, SharedSheet } from '../db/db'
import { isFileSheet } from '../share/campaigns'
import { gmSends, sendToRunner } from '../share/messages'
import { runTotals } from './runTotals'
import { updateCampaign } from './store'

/** Today in local time, as yyyy-mm-dd. */
const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const formatNuyen = (n: number) => `${n.toLocaleString()}¥`

/** Game nights: what happened, who was there, and the karma and nuyen paid out. */
export function RunLog({ campaign, runners }: { campaign: Campaign; runners: SharedSheet[] }) {
  const runs = campaign.runs ?? []
  const [editing, setEditing] = useState<CampaignRun | null>(null)
  const [notice, setNotice] = useState('')
  const save = (run: CampaignRun, send: boolean) => {
    const exists = runs.some((r) => r.id === run.id)
    const next = exists ? runs.map((r) => (r.id === run.id ? run : r)) : [...runs, run]
    next.sort((a, b) => a.date.localeCompare(b.date))
    void updateCampaign(campaign.id, { runs: next })
    setEditing(null)
    setNotice('')
    if (send) void sendRewards(run)
  }
  /** Karma and nuyen to each runner who played and is shared live; they accept it on their sheet. */
  const sendRewards = async (run: CampaignRun) => {
    const live = runners.filter((s) => !isFileSheet(s) && run.runnerIds.includes(s.character.id))
    const sent: string[] = []
    const failed: string[] = []
    for (const sheet of live) {
      try {
        await sendToRunner(campaign, sheet, {
          kind: 'reward',
          karma: run.karma,
          nuyen: run.nuyen,
          note: run.title || run.date,
        })
        sent.push(sheet.character.name)
      } catch (e) {
        failed.push(`${sheet.character.name} (${e instanceof Error ? e.message : String(e)})`)
      }
    }
    const missed = run.runnerNames.filter((n) => !live.some((s) => s.character.name === n))
    setNotice(
      [
        sent.length && `Sent to ${sent.join(', ')}; it’s added when they accept.`,
        missed.length && `Not shared live, so add it by hand: ${missed.join(', ')}.`,
        failed.length && `Couldn’t send to ${failed.join(', ')}.`,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
  const remove = (run: CampaignRun) => {
    if (confirm(`Delete "${run.title || run.date}" from the run log?`))
      void updateCampaign(campaign.id, { runs: runs.filter((r) => r.id !== run.id) })
  }
  const blank = (): CampaignRun => ({
    id: crypto.randomUUID(),
    date: today(),
    title: '',
    notes: '',
    karma: 0,
    nuyen: 0,
    runnerIds: runners.map((s) => s.character.id),
    runnerNames: runners.map((s) => s.character.name),
  })
  const totals = runTotals(runs)

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
          <CalendarDays className="size-5 text-accent" /> Run log
        </h2>
        {!editing && (
          <button className="btn text-sm" onClick={() => setEditing(blank())}>
            <Plus className="size-4" /> Log a run
          </button>
        )}
      </div>
      {notice && <p className="mb-3 text-xs text-accent">{notice}</p>}
      {editing && (
        <RunForm
          canSend={gmSends(campaign).rewards && runners.some((s) => !isFileSheet(s))}
          run={editing}
          runners={runners}
          onSave={save}
          onCancel={() => setEditing(null)}
          isNew={!runs.some((r) => r.id === editing.id)}
        />
      )}
      {runs.length === 0 && !editing ? (
        <div className="card p-6 text-sm text-muted">
          After each game night, note what happened and the karma and nuyen you paid out. The totals per runner add up
          here.
        </div>
      ) : (
        <>
          {totals.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              {totals.map((t) => (
                <span key={t.name} className="chip">
                  <span className="text-fg">{t.name}</span> {t.runs} {t.runs === 1 ? 'run' : 'runs'} ·{' '}
                  <span className="text-accent">{t.karma} karma</span> · {formatNuyen(t.nuyen)}
                </span>
              ))}
            </div>
          )}
          <ol className="grid gap-2">
            {[...runs].reverse().map((run) => (
              <li key={run.id} className="card p-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs text-muted tabular-nums">{run.date}</span>
                  <span className="mr-auto font-semibold">{run.title || 'Untitled run'}</span>
                  <span className="text-xs">
                    <span className="text-accent">{run.karma} karma</span> · {formatNuyen(run.nuyen)} each
                  </span>
                  <button className="text-muted hover:text-fg" onClick={() => setEditing(run)} aria-label="Edit run">
                    <Pencil className="size-3.5" />
                  </button>
                  <button className="text-muted hover:text-danger" onClick={() => remove(run)} aria-label="Delete run">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {run.runnerNames.length > 0 && (
                  <div className="mt-0.5 text-xs text-muted">{run.runnerNames.join(', ')}</div>
                )}
                {run.notes && <p className="mt-1 whitespace-pre-wrap text-muted">{run.notes}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function RunForm({
  run,
  runners,
  isNew,
  canSend,
  onSave,
  onCancel,
}: {
  run: CampaignRun
  runners: SharedSheet[]
  isNew: boolean
  /** Rewards can be sent to live shared runners. */
  canSend: boolean
  onSave: (run: CampaignRun, send: boolean) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(run)
  const [send, setSend] = useState(true)
  // Runners who played: today's shared runners plus anyone already on this run who isn't shared any more.
  const choices = [
    ...runners.map((s) => ({ id: s.character.id, name: s.character.name })),
    ...run.runnerIds
      .map((id, i) => ({ id, name: run.runnerNames[i] ?? '?' }))
      .filter((r) => !runners.some((s) => s.character.id === r.id)),
  ]
  const toggle = (id: string, name: string, on: boolean) => {
    const pairs = draft.runnerIds.map((rid, i) => [rid, draft.runnerNames[i]] as const).filter(([rid]) => rid !== id)
    if (on) pairs.push([id, name])
    setDraft({ ...draft, runnerIds: pairs.map(([rid]) => rid), runnerNames: pairs.map(([, n]) => n) })
  }
  const number = (value: string) => Math.max(0, parseInt(value, 10) || 0)
  return (
    <form
      className="card mb-3 grid gap-3 p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft, isNew && canSend && send && (draft.karma > 0 || draft.nuyen > 0))
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label>
          <div className="mb-1 text-xs text-muted">Date</div>
          <input
            {...noAutofill}
            type="date"
            className="input w-full"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value || today() })}
          />
        </label>
        <label>
          <div className="mb-1 text-xs text-muted">Run</div>
          <input
            {...noAutofill}
            className="input w-full"
            placeholder="The Renraku data heist"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
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
        <label>
          <div className="mb-1 text-xs text-muted">Nuyen each</div>
          <input
            {...noAutofill}
            type="number"
            min={0}
            step={500}
            inputMode="numeric"
            className="input w-32"
            value={draft.nuyen}
            onChange={(e) => setDraft({ ...draft, nuyen: number(e.target.value) })}
          />
        </label>
      </div>
      {choices.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted">Who played</div>
          <div className="flex flex-wrap gap-3">
            {choices.map((r) => (
              <label key={r.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.runnerIds.includes(r.id)}
                  onChange={(e) => toggle(r.id, r.name, e.target.checked)}
                />
                {r.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <label>
        <div className="mb-1 text-xs text-muted">What happened</div>
        <textarea
          {...noAutofillField}
          className="input field-sizing-content min-h-16 w-full"
          rows={2}
          placeholder="Who they met, what went wrong, what they took, loose ends…"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      {isNew && canSend && (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
          <span>
            Send the karma and nuyen to the runners who played
            <span className="block text-xs text-muted">
              It goes into their karma and money history once they accept. Untick if they add it themselves.
            </span>
          </span>
        </label>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary">{isNew ? 'Add to the log' : 'Save'}</button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
