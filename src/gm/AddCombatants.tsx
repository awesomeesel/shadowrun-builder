import { useLiveQuery } from 'dexie-react-hooks'
import { Search, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { entrySummary } from '../books/toCharacter'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import { db } from '../db/db'
import { CharacterSchema, migrateCharacter } from '../model/character'
import { ParticipantSchema, type Encounter } from '../model/encounter'
import { SPIRIT_TYPES } from '../rules/sr6/companions'
import { addNpcs } from '../rules/sr6/encounter'
import { latestSheets } from '../share/campaigns'
import type { NpcEntry } from '../rules/sr6/npc'
import { Counter } from '../pages/character/play/RollStep'

type Tab = 'books' | 'spirit' | 'runner' | 'custom'

/** Add enemies from the books, spirits, the runners, or a quick custom enemy. */
export function AddCombatants({
  campaignId,
  update,
  onClose,
}: {
  campaignId?: string
  update: (change: (e: Encounter) => Encounter) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('books')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const add = (change: (e: Encounter) => Encounter) => update(change)
  const tabs: [Tab, string][] = [
    ['books', 'From the books'],
    ['spirit', 'Spirit'],
    ['runner', 'Runner'],
    ['custom', 'Quick enemy'],
  ]
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden border-line bg-surface sm:max-h-[90vh] sm:rounded-xl sm:border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add to the encounter"
      >
        <div className="flex items-center gap-2 border-b border-line p-4">
          <UserPlus className="size-5 text-accent" />
          <h2 className="mr-auto font-display text-xl">Add to the encounter</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              className={`chip cursor-pointer ${tab === id ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'books' && <FromBooks add={add} />}
          {tab === 'spirit' && <SpiritForm add={add} />}
          {tab === 'runner' && <RunnerForm add={add} campaignId={campaignId} />}
          {tab === 'custom' && <CustomForm add={add} />}
        </div>
        <div className="flex justify-end border-t border-line p-3">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

type Add = (change: (e: Encounter) => Encounter) => void

function FromBooks({ add }: { add: Add }) {
  const entries = useLiveQuery(() => db.catalog.where('kind').equals('npc').toArray())
  const [query, setQuery] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [added, setAdded] = useState<string[]>([])
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = (entries ?? []).filter(
      (e) => !needle || `${e.name} ${e.category}`.toLowerCase().includes(needle),
    ) as (NpcEntry & { id: string })[]
    const byCategory = new Map<string, (NpcEntry & { id: string })[]>()
    for (const e of list) byCategory.set(e.category || 'Other', [...(byCategory.get(e.category || 'Other') ?? []), e])
    return [...byCategory.entries()]
  }, [entries, query])

  if (entries && entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No stat blocks yet. Add your rulebook PDFs in the{' '}
        <Link to="/library" className="text-accent hover:underline">
          Library
        </Link>{' '}
        and grunts, critters and contacts show up here.
      </p>
    )
  }
  return (
    <div>
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
        <input
          {...noAutofill}
          className="input w-full pl-8"
          placeholder="Search: Lone Star, ganger, ghoul, Professional Rating 3…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      {groups.map(([category, list]) => (
        <section key={category} className="mb-4">
          <h3 className="mb-1.5 text-xs tracking-wider text-muted uppercase">{category}</h3>
          <ul className="grid gap-1.5">
            {list.map((e) => {
              const count = counts[e.id] ?? 1
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{e.name}</div>
                    <div className="truncate text-xs text-muted">{entrySummary(e)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn size-7 p-0"
                      onClick={() => setCounts({ ...counts, [e.id]: Math.max(1, count - 1) })}
                      aria-label="Fewer"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{count}</span>
                    <button
                      className="btn size-7 p-0"
                      onClick={() => setCounts({ ...counts, [e.id]: count + 1 })}
                      aria-label="More"
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="btn btn-primary px-2.5 py-1 text-xs"
                    onClick={() => {
                      add((enc) => addNpcs(enc, e, count))
                      setAdded([...added, `${count} × ${e.name}`])
                    }}
                  >
                    Add
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {added.length > 0 && <p className="text-xs text-accent">Added: {added.join(', ')}</p>}
    </div>
  )
}

function SpiritForm({ add }: { add: Add }) {
  const [type, setType] = useState('fire')
  const [force, setForce] = useState(4)
  const [count, setCount] = useState(1)
  const [done, setDone] = useState('')
  const name = `${SPIRIT_TYPES[type as keyof typeof SPIRIT_TYPES].name} spirit (Force ${force})`
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap items-end gap-5">
        <label>
          <div className="mb-1 text-xs text-muted">Type</div>
          <select {...noAutofillField} className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(SPIRIT_TYPES).map(([id, s]) => (
              <option key={id} value={id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Counter label="Force" value={force} min={1} max={12} onChange={setForce} />
        <Counter label="How many" value={count} min={1} max={10} onChange={setCount} />
      </div>
      <button
        className="btn btn-primary justify-self-start"
        onClick={() => {
          add((enc) => ({
            ...enc,
            participants: [
              ...enc.participants,
              ...Array.from({ length: count }, (_, i) =>
                ParticipantSchema.parse({
                  kind: 'spirit',
                  name: count > 1 ? `${name} ${i + 1}` : name,
                  spirit: { type, force },
                }),
              ),
            ],
          }))
          setDone(`Added ${count} × ${name}.`)
        }}
      >
        Add {count > 1 ? `${count} spirits` : 'spirit'}
      </button>
      {done && <p className="text-xs text-accent">{done}</p>}
    </div>
  )
}

function RunnerForm({ add, campaignId }: { add: Add; campaignId?: string }) {
  const characters = useLiveQuery(async () =>
    (await db.characters.toArray()).flatMap((raw) => {
      const parsed = CharacterSchema.safeParse(migrateCharacter(raw))
      return parsed.success && parsed.data.mode === 'free' ? [parsed.data] : []
    }),
  )
  // This campaign's runners first, then any others shared with this device.
  const shared = useLiveQuery(async () => {
    const all = await db.sharedSheets.toArray()
    const own = all.filter((s) => s.roomId === campaignId)
    return own.length ? latestSheets(own) : latestSheets(all)
  }, [campaignId])
  const [name, setName] = useState('')
  const [done, setDone] = useState<string[]>([])
  const addRunner = (runnerName: string, characterId?: string) => {
    add((enc) => ({
      ...enc,
      participants: [...enc.participants, ParticipantSchema.parse({ kind: 'runner', name: runnerName, characterId })],
    }))
    setDone([...done, runnerName])
  }
  return (
    <div className="grid gap-4 text-sm">
      <p className="text-muted">
        Players roll their own initiative and tell you the total; type it on their card. Shared runners and runners
        saved on this device bring their Defense Rating, damage tracks and weapons along.
      </p>
      {shared && shared.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted">Shared by players (live damage and Edge)</div>
          <div className="flex flex-wrap gap-1.5">
            {shared.map((s) => (
              <button
                key={s.id}
                className="chip cursor-pointer border-accent/40 hover:border-accent"
                onClick={() => addRunner(s.character.name, `shared:${s.id}`)}
              >
                + {s.character.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {characters && characters.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted">From this device</div>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((c) => (
              <button
                key={c.id}
                className="chip cursor-pointer hover:border-accent/60"
                onClick={() => addRunner(c.name, c.id)}
              >
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-1 text-xs text-muted">Or just a name</div>
        <div className="flex gap-2">
          <input
            {...noAutofill}
            className="input min-w-0 flex-1"
            placeholder="Runner's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              addRunner(name.trim())
              setName('')
            }}
          >
            Add
          </button>
        </div>
      </div>
      {done.length > 0 && <p className="text-xs text-accent">Added: {done.join(', ')}</p>}
    </div>
  )
}

function CustomForm({ add }: { add: Add }) {
  const [name, setName] = useState('Thug')
  const [stats, setStats] = useState({ initiativeScore: 6, initiativeDice: 1, defenseRating: 4, monitor: 10, pool: 7 })
  const [count, setCount] = useState(1)
  const [done, setDone] = useState('')
  const set = (key: keyof typeof stats) => (value: number) => setStats({ ...stats, [key]: value })
  return (
    <div className="grid gap-4 text-sm">
      <label className="block">
        <div className="mb-1 text-xs text-muted">Name</div>
        <input {...noAutofill} className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-5">
        <Counter
          label="Initiative score"
          value={stats.initiativeScore}
          min={1}
          max={30}
          onChange={set('initiativeScore')}
        />
        <Counter
          label="Initiative dice"
          value={stats.initiativeDice}
          min={1}
          max={5}
          onChange={set('initiativeDice')}
        />
        <Counter label="Defense Rating" value={stats.defenseRating} min={0} max={30} onChange={set('defenseRating')} />
        <Counter label="Damage boxes" value={stats.monitor} min={1} max={30} onChange={set('monitor')} />
        <Counter label="Attack dice" value={stats.pool} min={0} max={40} onChange={set('pool')} />
        <Counter label="How many" value={count} min={1} max={20} onChange={setCount} />
      </div>
      <button
        className="btn btn-primary justify-self-start"
        disabled={!name.trim()}
        onClick={() => {
          const group = count > 1 ? name.trim() : ''
          add((enc) => ({
            ...enc,
            participants: [
              ...enc.participants,
              ...Array.from({ length: count }, (_, i) =>
                ParticipantSchema.parse({
                  kind: 'custom',
                  name: count > 1 ? `${name.trim()} ${i + 1}` : name.trim(),
                  group,
                  custom: stats,
                }),
              ),
            ],
          }))
          setDone(`Added ${count} × ${name.trim()}.`)
        }}
      >
        Add
      </button>
      {done && <p className="text-xs text-accent">{done}</p>}
    </div>
  )
}
