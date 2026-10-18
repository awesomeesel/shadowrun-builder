import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { entrySummary } from '../books/toCharacter'
import { castStatsSummary } from './castStats'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import { db, type Campaign, type CastMember } from '../db/db'
import type { NpcEntry } from '../rules/sr6/npc'
import { Counter } from '../pages/character/play/RollStep'
import { updateCampaign } from './store'

const ATTITUDES: { id: CastMember['attitude']; label: string; one: string; tone: string }[] = [
  { id: 'ally', label: 'Allies', one: 'Ally', tone: 'text-accent' },
  { id: 'neutral', label: 'Neutral', one: 'Neutral', tone: 'text-fg' },
  { id: 'enemy', label: 'Enemies', one: 'Enemy', tone: 'text-danger' },
]

/** The campaign's recurring people: who they are, how they feel about the runners, and stats if they fight. */
export function CastSection({ campaign }: { campaign: Campaign }) {
  const cast = campaign.cast ?? []
  const [editing, setEditing] = useState<CastMember | null>(null)
  const save = (member: CastMember) => {
    const next = cast.some((m) => m.id === member.id)
      ? cast.map((m) => (m.id === member.id ? member : m))
      : [...cast, member]
    void updateCampaign(campaign.id, { cast: next })
    setEditing(null)
  }
  const remove = (member: CastMember) => {
    if (confirm(`Remove ${member.name} from the cast?`))
      void updateCampaign(campaign.id, { cast: cast.filter((m) => m.id !== member.id) })
  }
  const blank = (): CastMember => ({
    id: crypto.randomUUID(),
    name: '',
    role: '',
    attitude: 'neutral',
    notes: '',
    updatedAt: new Date().toISOString(),
  })

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
          <UserRound className="size-5 text-accent" /> Cast
          <span className="text-xs font-normal text-muted">recurring people; players never see this</span>
        </h2>
        <button className="btn text-sm" onClick={() => setEditing(blank())}>
          <Plus className="size-4" /> Add someone
        </button>
      </div>
      {cast.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          Your fixer, the Johnson who keeps hiring them, the gang boss with a grudge. Keep them here with notes, and
          give the ones who might fight some stats, so they’re one tap away in an encounter.
        </div>
      ) : (
        <div className="grid gap-4">
          {ATTITUDES.map((a) => {
            const members = cast.filter((m) => m.attitude === a.id).sort((x, y) => x.name.localeCompare(y.name))
            if (members.length === 0) return null
            return (
              <div key={a.id}>
                <div className={`mb-1.5 text-xs tracking-wider uppercase ${a.tone}`}>{a.label}</div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {members.map((m) => (
                    <li key={m.id} className="card flex flex-col p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-lg leading-tight">{m.name || 'Unnamed'}</div>
                          {m.role && <div className="text-xs text-muted">{m.role}</div>}
                        </div>
                        <button
                          className="text-muted hover:text-fg"
                          onClick={() => setEditing(m)}
                          aria-label={`Edit ${m.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          className="text-muted hover:text-danger"
                          onClick={() => remove(m)}
                          aria-label={`Remove ${m.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {m.notes && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-muted">{m.notes}</p>}
                      <p className="mt-1.5 truncate text-xs text-muted" title={castStatsSummary(m)}>
                        {castStatsSummary(m)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
      {editing && <CastDialog member={editing} onSave={save} onClose={() => setEditing(null)} />}
    </section>
  )
}

type StatsMode = 'none' | 'book' | 'quick'

function CastDialog({
  member,
  onSave,
  onClose,
}: {
  member: CastMember
  onSave: (m: CastMember) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(member)
  const [mode, setMode] = useState<StatsMode>(member.npc ? 'book' : member.custom ? 'quick' : 'none')
  const custom = draft.custom ?? { initiativeScore: 8, initiativeDice: 1, defenseRating: 4, monitor: 10, pool: 8 }
  const setCustom = (key: keyof typeof custom) => (value: number) =>
    setDraft({ ...draft, custom: { ...custom, [key]: value } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () =>
    onSave({
      ...draft,
      name: draft.name.trim(),
      role: draft.role.trim(),
      npc: mode === 'book' ? draft.npc : undefined,
      custom: mode === 'quick' ? custom : undefined,
      updatedAt: new Date().toISOString(),
    })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        className="card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.name.trim()) save()
        }}
        aria-label="Cast member"
      >
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto font-display text-xl">
            {member.name ? `Edit ${member.name}` : 'Add someone to the cast'}
          </h2>
          <button type="button" className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <div className="mb-1 text-xs text-muted">Name</div>
              <input
                {...noAutofill}
                className="input w-full"
                placeholder="Mr. Chen “The Ledger”"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                autoFocus
              />
            </label>
            <label>
              <div className="mb-1 text-xs text-muted">Who they are</div>
              <input
                {...noAutofill}
                className="input w-full"
                placeholder="Fixer, Mr. Johnson, gang boss…"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              />
            </label>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">Towards the runners</div>
            <div className="flex gap-1.5">
              {ATTITUDES.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className={`chip cursor-pointer ${draft.attitude === a.id ? `border-current bg-bg ${a.tone}` : 'text-muted'}`}
                  onClick={() => setDraft({ ...draft, attitude: a.id })}
                >
                  {a.one}
                </button>
              ))}
            </div>
          </div>
          <label>
            <div className="mb-1 text-xs text-muted">Notes</div>
            <textarea
              {...noAutofillField}
              className="input field-sizing-content min-h-20 w-full"
              placeholder="What they want, what they know, how to reach them, what they owe…"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          <div>
            <div className="mb-1 text-xs text-muted">Stats, if they might fight</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(
                [
                  ['none', 'None'],
                  ['book', 'From the books'],
                  ['quick', 'Quick numbers'],
                ] as [StatsMode, string][]
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={`chip cursor-pointer ${mode === id ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'book' && <StatBlockPicker picked={draft.npc} onPick={(npc) => setDraft({ ...draft, npc })} />}
            {mode === 'quick' && (
              <div className="flex flex-wrap gap-4">
                <Counter
                  label="Initiative score"
                  value={custom.initiativeScore}
                  min={1}
                  max={30}
                  onChange={setCustom('initiativeScore')}
                />
                <Counter
                  label="Initiative dice"
                  value={custom.initiativeDice}
                  min={1}
                  max={5}
                  onChange={setCustom('initiativeDice')}
                />
                <Counter
                  label="Defense Rating"
                  value={custom.defenseRating}
                  min={0}
                  max={30}
                  onChange={setCustom('defenseRating')}
                />
                <Counter label="Damage boxes" value={custom.monitor} min={1} max={30} onChange={setCustom('monitor')} />
                <Counter label="Attack dice" value={custom.pool} min={0} max={40} onChange={setCustom('pool')} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!draft.name.trim() || (mode === 'book' && !draft.npc)}>
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

/** Search the stat blocks from the user's books and pick one. */
function StatBlockPicker({ picked, onPick }: { picked?: NpcEntry; onPick: (npc: NpcEntry) => void }) {
  const entries = useLiveQuery(() => db.catalog.where('kind').equals('npc').toArray())
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ((entries ?? []) as NpcEntry[])
      .filter((e) => !needle || `${e.name} ${e.category}`.toLowerCase().includes(needle))
      .slice(0, 40)
  }, [entries, query])

  if (entries && entries.length === 0) {
    return (
      <p className="text-xs text-muted">
        No stat blocks yet. Add your rulebooks in the{' '}
        <Link to="/library" className="text-accent hover:underline">
          Library
        </Link>
        , or use quick numbers.
      </p>
    )
  }
  return (
    <div className="grid gap-2">
      {picked && (
        <p className="rounded bg-accent/10 px-2 py-1 text-xs">
          Using <b>{picked.name}</b> · {entrySummary(picked)}
        </p>
      )}
      <label className="relative block">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
        <input
          {...noAutofill}
          className="input w-full pl-8"
          placeholder="Search: fixer, Lone Star, ganger, mage…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ul className="grid max-h-56 gap-1 overflow-y-auto">
        {list.map((e) => (
          <li key={`${e.name}-${e.page}`}>
            <button
              type="button"
              className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-sm hover:border-accent/60 ${
                picked?.name === e.name && picked.page === e.page ? 'border-accent' : 'border-line'
              }`}
              onClick={() => onPick(e)}
            >
              <div className="truncate">{e.name}</div>
              <div className="truncate text-xs text-muted">
                {e.category} · {entrySummary(e)}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
