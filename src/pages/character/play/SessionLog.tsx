import { ChevronRight, NotebookPen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { noAutofillField } from '../../../components/noAutofill'
import { Stat } from '../../../components/sheetParts'
import { Section } from '../../../components/ui'
import type { SessionRecord } from '../../../model/character'
import { deleteSessionRecord, formatDuration, sessionSummary, updateSessionRecord } from '../../../rules/sr6/play'
import type { CharacterContext } from '../CharacterPage'

export function SessionLog({ character, update }: CharacterContext) {
  const [open, setOpen] = useState<string | null>(null)
  if (character.sessions.length === 0) return null
  return (
    <Section title="Session log" icon={<NotebookPen className="size-4" />}>
      <p className="-mt-1 mb-3 text-xs text-muted">Click a session to see its summary and notes.</p>
      <ol className="grid gap-3">
        {[...character.sessions].reverse().map((s) => (
          <SessionEntry
            key={s.id}
            record={s}
            open={open === s.id}
            onToggle={() => setOpen(open === s.id ? null : s.id)}
            update={update}
          />
        ))}
      </ol>
    </Section>
  )
}

const signed = (n: number, unit = '') => `${n > 0 ? '+' : ''}${n.toLocaleString()}${unit}`

function SessionEntry({
  record: s,
  open,
  onToggle,
  update,
}: {
  record: SessionRecord
  open: boolean
  onToggle: () => void
  update: CharacterContext['update']
}) {
  const notable = [...s.rolls]
    .filter((r) => r.total === null)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
  const glitches = s.rolls.filter((r) => r.glitch && r.total === null)
  // Sessions logged before damage and Edge were tracked have no edgeStart.
  const detailed = s.edgeStart !== null
  return (
    <li className={`rounded-lg border bg-bg/40 text-sm transition-colors ${open ? 'border-accent/50' : 'border-line'}`}>
      <button
        className="flex w-full flex-wrap items-baseline gap-x-3 p-3 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <ChevronRight className={`size-4 self-center text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="font-semibold">{s.title || 'Session'}</span>
        <span className="text-xs text-muted">{new Date(s.startedAt).toLocaleDateString()}</span>
        <span className="ml-auto text-xs tabular-nums">
          <span className={s.nuyen >= 0 ? 'text-accent' : 'text-danger'}>{signed(s.nuyen, '¥')}</span>
          <span className="ml-2 text-amber">{signed(s.karma)} karma</span>
        </span>
        {!open && s.notes && <p className="mt-1 line-clamp-1 basis-full pl-7 text-muted">{s.notes}</p>}
      </button>

      {open && (
        <div className="grid gap-4 border-t border-line p-3 sm:p-4">
          <div>
            <h4 className="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Summary</h4>
            <p className="leading-relaxed">{sessionSummary(s).join(' ')}</p>
          </div>

          <div className={`grid grid-cols-3 gap-2 ${detailed ? 'sm:grid-cols-6' : ''}`}>
            <Stat label="Played" value={formatDuration(s.startedAt, s.endedAt)} />
            <Stat label="Nuyen" value={signed(s.nuyen, '¥')} tone={s.nuyen > 0 ? 'accent' : undefined} />
            <Stat label="Karma" value={signed(s.karma)} tone={s.karma > 0 ? 'accent' : undefined} />
            {detailed && (
              <>
                <Stat label="Physical" value={s.damage.physical} tone={s.damage.physical ? 'danger' : undefined} />
                <Stat label="Stun" value={s.damage.stun} tone={s.damage.stun ? 'danger' : undefined} />
                <Stat
                  label="Edge used"
                  value={s.edgeStart !== null && s.edgeEnd !== null ? Math.max(0, s.edgeStart - s.edgeEnd) : '–'}
                />
              </>
            )}
          </div>

          {s.entries.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Money & karma</h4>
              <ul className="grid gap-1">
                {s.entries.map((e, i) => (
                  <li key={i} className="flex gap-2 rounded-md bg-bg/50 px-2 py-1">
                    <span className="min-w-0 flex-1 truncate">
                      {e.note || <span className="text-muted">No note</span>}
                    </span>
                    {e.nuyen !== 0 && (
                      <span className={e.nuyen > 0 ? 'text-accent' : 'text-danger'}>{signed(e.nuyen, '¥')}</span>
                    )}
                    {e.karma !== 0 && (
                      <span className={e.karma > 0 ? 'text-amber' : 'text-danger'}>{signed(e.karma)} karma</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.rolls.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">
                Rolls · {s.rolls.length}
              </h4>
              <ul className="grid gap-1">
                {notable.map((r, i) => (
                  <li key={`best-${i}`} className="flex gap-2 rounded-md bg-bg/50 px-2 py-1">
                    <span className="flex-1">{r.label}</span>
                    <span className="text-muted">{r.pool} dice</span>
                    <span className="font-semibold text-accent">{r.hits} hits</span>
                  </li>
                ))}
                {glitches.map((r, i) => (
                  <li key={`glitch-${i}`} className="flex gap-2 rounded-md bg-danger/10 px-2 py-1">
                    <span className="flex-1">{r.label}</span>
                    <span className="font-semibold text-danger">{r.criticalGlitch ? 'Critical glitch' : 'Glitch'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold tracking-wider text-muted uppercase">Notes</span>
            <textarea
              {...noAutofillField}
              className="input min-h-28 w-full"
              placeholder="What happened? Add notes here any time."
              value={s.notes}
              onChange={(e) => {
                const notes = e.target.value
                update((c) => updateSessionRecord(c, s.id, { notes }))
              }}
            />
          </label>

          <div className="flex justify-between gap-2 text-xs text-muted">
            <span>
              {new Date(s.startedAt).toLocaleString()} – {new Date(s.endedAt).toLocaleTimeString()}
            </span>
            <button
              className="flex items-center gap-1 hover:text-danger"
              onClick={() => {
                if (confirm(`Remove "${s.title || 'this session'}" from the log? Money and karma are not changed.`)) {
                  update((c) => deleteSessionRecord(c, s.id))
                }
              }}
            >
              <Trash2 className="size-3.5" /> Remove from log
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
