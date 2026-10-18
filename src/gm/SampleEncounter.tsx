import { useLiveQuery } from 'dexie-react-hooks'
import { Shuffle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { entrySummary } from '../books/toCharacter'
import { noAutofill } from '../components/noAutofill'
import { db } from '../db/db'
import type { NpcEntry } from '../rules/sr6/npc'
import { gruntTemplates, sampleEncounter, suggestedCounts } from './samples'

/** What each Professional Rating means, after the book's headings (p. 203–211). */
const RATINGS = [
  'Thugs and mobs',
  'Gangers and mob muscle',
  'Major street gangs',
  'Beat cops and basic corporate security',
  'Organized crime',
  'Police and corporate SWAT',
  'High-threat response teams',
  'Elite corporate security',
  'Special forces',
  'Top-tier special forces',
  'Elite special forces',
]

/** A ready-made fight from the books' sample grunts at a chosen Professional Rating. */
export function SampleEncounterDialog({
  campaignId,
  runners,
  onClose,
}: {
  campaignId?: string
  /** How many runners the group has, to size the opposition. */
  runners: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const entries = useLiveQuery(async () => (await db.catalog.where('kind').equals('npc').toArray()) as NpcEntry[])
  const available = useMemo(() => RATINGS.map((_, r) => gruntTemplates(entries ?? [], r).length), [entries])
  const [rating, setRating] = useState(3)
  const templates = useMemo(() => gruntTemplates(entries ?? [], rating), [entries, rating])
  // Your changes for the rating shown; otherwise the suggestion.
  const [edits, setEdits] = useState<{ rating: number; counts?: number[]; name?: string }>({ rating })
  const mine = edits.rating === rating ? edits : { rating }
  const counts = mine.counts ?? suggestedCounts(templates, runners)
  const name = mine.name ?? (templates[0] ? `${templates[0].name} squad` : '')
  const setCounts = (next: number[]) => setEdits({ ...mine, counts: next })
  const setName = (next: string) => setEdits({ ...mine, name: next })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = counts.reduce((a, b) => a + b, 0)
  const create = async () => {
    const encounter = {
      ...sampleEncounter(
        name.trim() || `Professional Rating ${rating}`,
        templates.map((npc, i) => ({ npc, count: counts[i] ?? 0 })),
      ),
      ...(campaignId ? { campaignId } : {}),
    }
    await db.encounters.add(encounter)
    navigate(`/gm/${encounter.id}`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sample encounter"
      >
        <div className="mb-3 flex items-center gap-2">
          <Shuffle className="size-5 text-accent" />
          <h2 className="mr-auto font-display text-xl">Sample encounter</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {entries && entries.length === 0 ? (
          <p className="text-sm text-muted">
            This uses the sample grunts in your rulebooks. Add your PDFs in the{' '}
            <Link to="/library" className="text-accent hover:underline">
              Library
            </Link>{' '}
            first.
          </p>
        ) : (
          <div className="grid gap-4 text-sm">
            <div>
              <div className="mb-1 text-xs text-muted">How tough? (Professional Rating)</div>
              <div className="flex flex-wrap gap-1.5">
                {RATINGS.map((_, r) => (
                  <button
                    key={r}
                    disabled={available[r] === 0}
                    className={`chip min-w-9 cursor-pointer justify-center disabled:opacity-40 ${rating === r ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                    onClick={() => setRating(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{RATINGS[rating]}. Higher ratings fight harder and run later.</p>
            </div>
            {templates.length === 0 ? (
              <p className="text-muted">No sample grunts at this rating in your books.</p>
            ) : (
              <>
                <ul className="grid gap-1.5">
                  {templates.map((t, i) => (
                    <li
                      key={`${t.name}-${t.page}`}
                      className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          {t.name}{' '}
                          <span className="text-xs text-muted">{i === 0 ? 'rank and file' : 'lieutenant'}</span>
                        </div>
                        <div className="truncate text-xs text-muted">{entrySummary(t)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn size-7 p-0"
                          onClick={() => setCounts(counts.map((c, j) => (j === i ? Math.max(0, c - 1) : c)))}
                          aria-label={`Fewer ${t.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center tabular-nums">{counts[i] ?? 0}</span>
                        <button
                          className="btn size-7 p-0"
                          onClick={() => setCounts(counts.map((c, j) => (j === i ? c + 1 : c)))}
                          aria-label={`More ${t.name}`}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  Suggested for {runners} {runners === 1 ? 'runner' : 'runners'}: one more grunt than runners, and a
                  lieutenant. Several of one kind fight as a group, sharing initiative and Edge.
                </p>
                <label>
                  <div className="mb-1 text-xs text-muted">Name</div>
                  <input
                    {...noAutofill}
                    className="input w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="btn btn-primary justify-self-start"
                  disabled={total === 0}
                  onClick={() => void create()}
                >
                  <Shuffle className="size-4" /> Make encounter ({total})
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
