import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Dices, Plus, Send, Skull, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import { db } from '../db/db'
import type { Character } from '../model/character'
import { gmSends } from '../share/messages'
import { Waiting } from './Campaigns'
import { SendDialog } from './SendDialog'
import { StatusSchema, type Encounter, type Participant } from '../model/encounter'
import { effectiveInitiative, woundModifier, type CombatantStats } from '../rules/sr6/encounter'
import { STATUSES, STATUS_BY_NAME, statusLabel } from '../rules/sr6/statuses'

const KIND_LABEL: Record<Participant['kind'], string> = {
  npc: 'NPC',
  spirit: 'Spirit',
  runner: 'Runner',
  custom: 'Enemy',
}

/** One combatant on the action screen. */
export function ParticipantCard({
  participant: p,
  stats,
  active,
  groupEdge,
  character,
  live = false,
  update,
  onRoll,
}: {
  participant: Participant
  stats: CombatantStats
  active: boolean
  groupEdge?: number
  character?: Character
  /** A runner shared by their player: damage and Edge come from the player's sheet and can't be changed here. */
  live?: boolean
  update: (change: (e: Encounter) => Encounter) => Promise<void>
  onRoll: (label: string, pool: number, info?: string, initiativeScore?: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [addingStatus, setAddingStatus] = useState(false)
  const change = (fn: (x: Participant) => Participant) =>
    void update((e) => ({ ...e, participants: e.participants.map((x) => (x.id === p.id ? fn(x) : x)) }))

  const fromSheet = live && !!character
  const damage = fromSheet ? character.damage : p.damage
  const wounds = woundModifier({ ...p, damage }, stats)
  const shared = stats.isGrunt && !!p.group
  const edge = fromSheet ? (character.play.edge ?? stats.edge) : shared ? (groupEdge ?? 0) : p.edge
  // A runner's statuses from their own sheet: shown read-only, and counted for initiative.
  const playerStatuses = stats.sheetStatuses
  const initiative = effectiveInitiative(p, stats)
  const statusShift = initiative !== null && p.initiative !== null ? initiative - p.initiative : 0
  // Grunts and spirits have one track; the Stun boxes go on it too.
  const single = stats.monitor.stun === null
  const filled = damage.physical + damage.stun
  const down = single ? filled >= stats.monitor.physical : damage.physical >= stats.monitor.physical
  const unconscious = !single && stats.monitor.stun !== null && damage.stun >= stats.monitor.stun

  const setEdge = (value: number) =>
    shared
      ? void update((e) => ({ ...e, groupEdge: { ...e.groupEdge, [p.group]: Math.max(0, value) } }))
      : change((x) => ({ ...x, edge: Math.max(0, value) }))

  return (
    <li
      className={`card overflow-hidden transition-colors ${
        active ? 'border-accent shadow-[0_0_24px_-10px_var(--color-accent)]' : ''
      } ${p.out ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3">
        <label className="flex w-14 shrink-0 flex-col items-center" title="Initiative total">
          <input
            {...noAutofill}
            type="number"
            inputMode="numeric"
            className={`input w-14 px-1 py-1 text-center font-display text-2xl tabular-nums ${active ? 'text-accent' : ''}`}
            value={p.initiative ?? ''}
            placeholder="–"
            onChange={(e) => {
              const value = e.target.value === '' ? null : parseInt(e.target.value, 10)
              change((x) => ({ ...x, initiative: Number.isFinite(value) ? value : null }))
            }}
            aria-label={`${p.name} initiative`}
          />
          {statusShift !== 0 && (
            <span className="text-[10px] text-amber" title="Changed by statuses">
              {statusShift > 0 ? '+' : ''}
              {statusShift} → {initiative}
            </span>
          )}
        </label>

        <div className="min-w-0 flex-1 basis-48">
          <div className="flex items-center gap-2">
            <input
              {...noAutofill}
              className="min-w-0 flex-1 truncate bg-transparent font-display text-lg font-semibold outline-none focus:text-accent"
              value={p.name}
              onChange={(e) => {
                const name = e.target.value
                change((x) => ({ ...x, name }))
              }}
              aria-label="Name"
            />
            {active && <span className="chip border-accent bg-accent/15 text-xs text-accent">Acting</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted">
            <span>{KIND_LABEL[p.kind]}</span>
            {p.group && <span>Group: {p.group}</span>}
            <span title="Defense Rating">
              Defense Rating <span className="text-fg">{stats.defenseRating}</span>
            </span>
            <span title="Initiative Score + dice">
              Initiative{' '}
              <span className="text-fg">
                {stats.initiative.score} + {stats.initiative.dice}D6
              </span>
            </span>
            {wounds < 0 && <span className="text-danger">Wounds {wounds}</span>}
            {down && <span className="text-danger">{single ? 'Down' : 'Dying'}</span>}
            {unconscious && !down && <span className="text-danger">Unconscious</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Pips
            label="Major"
            left={p.majorLeft}
            total={stats.majors}
            onChange={(majorLeft) => change((x) => ({ ...x, majorLeft }))}
          />
          <Pips
            label="Minor"
            left={p.minorLeft}
            total={stats.minors}
            onChange={(minorLeft) => change((x) => ({ ...x, minorLeft }))}
          />
          <div
            className="flex items-center gap-1"
            title={fromSheet ? 'From the player’s sheet' : shared ? `Shared by ${p.group}` : undefined}
          >
            <span className="text-muted">{shared ? 'Group Edge' : 'Edge'}</span>
            {fromSheet ? (
              <span className="w-4 text-center font-display text-base tabular-nums text-amber">{edge}</span>
            ) : (
              <>
                <button
                  className="btn size-6 p-0"
                  onClick={() => setEdge(edge - 1)}
                  disabled={edge <= 0}
                  aria-label="Spend Edge"
                >
                  −
                </button>
                <span className="w-4 text-center font-display text-base tabular-nums text-amber">{edge}</span>
                <button className="btn size-6 p-0" onClick={() => setEdge(edge + 1)} aria-label="Gain Edge">
                  +
                </button>
              </>
            )}
          </div>
          <button
            className="btn px-2 py-1 text-xs"
            onClick={() => change((x) => ({ ...x, out: !x.out }))}
            title={p.out ? 'Back in the fight' : 'Out of the fight: down, fled or surrendered'}
          >
            {p.out ? <Undo2 className="size-3.5" /> : <Skull className="size-3.5" />}
            {p.out ? 'Back in' : 'Out'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-t border-line/60 px-3 py-2.5 sm:grid-cols-2">
        {fromSheet && p.characterId && <LiveRunnerBar sheetId={p.characterId.slice('shared:'.length)} />}
        <Track
          label={single ? 'Condition' : 'Physical'}
          boxes={stats.monitor.physical}
          filled={single ? filled : damage.physical}
          readOnly={fromSheet}
          step={stats.woundStep}
          onChange={(n) =>
            change((x) => ({ ...x, damage: single ? { physical: n, stun: 0 } : { ...x.damage, physical: n } }))
          }
        />
        {!single && stats.monitor.stun !== null && (
          <Track
            label="Stun"
            boxes={stats.monitor.stun}
            filled={damage.stun}
            readOnly={fromSheet}
            step={stats.woundStep}
            onChange={(n) => change((x) => ({ ...x, damage: { ...x.damage, stun: n } }))}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 px-3 py-2">
        {playerStatuses.map((s) => {
          const def = STATUS_BY_NAME.get(s.name.toLowerCase())
          return (
            <span
              key={`player-${s.id}`}
              className="chip gap-1 border-amber/30 text-xs text-amber/90"
              title={`On the player’s sheet${def ? `: ${def.effect}` : ''}`}
            >
              {statusLabel(s)}
              {s.rounds !== null && <span className="text-muted">· {s.rounds} rd</span>}
              <span className="text-[10px] text-muted">player</span>
            </span>
          )
        })}
        {p.statuses.map((s) => {
          const def = STATUS_BY_NAME.get(s.name.toLowerCase())
          return (
            <span
              key={s.id}
              className="chip gap-1 border-amber/50 text-xs text-amber"
              title={def ? `${def.effect} (CRB ${def.page})` : undefined}
            >
              {statusLabel(s)}
              {s.rounds !== null && <span className="text-muted">· {s.rounds} rd</span>}
              <button
                className="hover:text-fg"
                onClick={() => change((x) => ({ ...x, statuses: x.statuses.filter((y) => y.id !== s.id) }))}
                aria-label={`Remove ${statusLabel(s)}`}
              >
                <X className="size-3" />
              </button>
            </span>
          )
        })}
        {addingStatus ? (
          <StatusForm
            onAdd={(status) => {
              change((x) => ({ ...x, statuses: [...x.statuses, status] }))
              setAddingStatus(false)
            }}
            onCancel={() => setAddingStatus(false)}
          />
        ) : (
          <button
            className="chip cursor-pointer text-xs text-muted hover:text-fg"
            onClick={() => setAddingStatus(true)}
          >
            <Plus className="size-3" /> Status
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 px-3 py-2">
        <button
          className="chip cursor-pointer text-xs hover:border-accent/60"
          onClick={() => onRoll('Initiative', stats.initiative.dice, undefined, stats.initiative.score)}
          title="Roll initiative for this one"
        >
          <Dices className="size-3" /> Initiative
        </button>
        {stats.pools.map((pool) => {
          const dice = Math.max(0, pool.pool + (pool.ignoreWounds ? 0 : wounds))
          return (
            <button
              key={pool.label}
              className="chip cursor-pointer text-xs hover:border-accent/60"
              onClick={() => onRoll(pool.label, dice, pool.info)}
              title={pool.info}
            >
              {pool.label} <span className="font-semibold text-accent tabular-nums">{dice}</span>
            </button>
          )
        })}
        <button
          className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-fg"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          Details <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="grid gap-2 border-t border-line/60 bg-bg/40 px-3 py-3 text-sm">
          {stats.extras.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {p.npc && <NpcDetails npc={p.npc} />}
          {p.kind === 'runner' && character && (
            <p className="text-muted">
              Linked to{' '}
              <Link
                to={
                  live && p.characterId
                    ? `/gm/sheet/${encodeURIComponent(p.characterId.slice('shared:'.length))}`
                    : `/character/${character.id}/play`
                }
                className="text-accent hover:underline"
              >
                {character.name}
              </Link>
              .{' '}
              {live
                ? 'Damage and Edge are live from the player.'
                : 'Damage here is the GM’s copy; the player tracks their own sheet.'}
            </p>
          )}
          <textarea
            {...noAutofillField}
            className="input min-h-16 w-full"
            placeholder="Notes: tactics, what they carry, who they report to…"
            value={p.notes}
            onChange={(e) => {
              const notes = e.target.value
              change((x) => ({ ...x, notes }))
            }}
          />
          <button
            className="btn justify-self-start text-xs text-danger"
            onClick={() =>
              void update((e) => ({
                ...e,
                participants: e.participants.filter((x) => x.id !== p.id),
                activeId: e.activeId === p.id ? null : e.activeId,
              }))
            }
          >
            <Trash2 className="size-3.5" /> Remove from the encounter
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * For a runner shared live: their damage comes from the player, and the GM can
 * send damage, a status or Edge for the player to accept.
 */
function LiveRunnerBar({ sheetId }: { sheetId: string }) {
  const [sending, setSending] = useState(false)
  const data = useLiveQuery(async () => {
    const sheet = await db.sharedSheets.get(sheetId)
    const campaign = sheet && (await db.campaigns.get(sheet.roomId))
    const waiting = sheet
      ? await db.outbox
          .where('roomId')
          .equals(sheet.roomId)
          .filter((m) => m.to === sheet.sheetId)
          .toArray()
      : []
    return { sheet, campaign, waiting }
  }, [sheetId])
  const canSend = data?.campaign && data.sheet && gmSends(data.campaign).damage
  return (
    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
      <p className="mr-auto text-xs text-accent">Live from the player’s sheet; they mark their own damage.</p>
      {canSend && (
        <button
          className="btn px-2 py-1 text-xs"
          onClick={() => setSending(true)}
          title="Send damage, a status or Edge; the player accepts it"
        >
          <Send className="size-3.5" /> Send…
        </button>
      )}
      {data && data.waiting.length > 0 && <Waiting items={data.waiting} />}
      {sending && data?.campaign && data.sheet && (
        <SendDialog
          campaign={data.campaign}
          sheet={data.sheet}
          kinds={['damage', 'status', 'edge']}
          onClose={() => setSending(false)}
        />
      )}
    </div>
  )
}

/** Action pips: tap a filled one to use it, an empty one to give it back. */
function Pips({
  label,
  left,
  total,
  onChange,
}: {
  label: string
  left: number
  total: number
  onChange: (left: number) => void
}) {
  return (
    <div className="flex items-center gap-1" title={`${label} actions left this round`}>
      <span className="text-muted">{label}</span>
      {Array.from({ length: Math.max(total, left) }, (_, i) => {
        const available = i < left
        return (
          <button
            key={i}
            className={`size-4 rounded-full border ${available ? 'border-accent bg-accent' : 'border-line bg-bg'}`}
            onClick={() => onChange(available ? left - 1 : left + 1)}
            aria-label={available ? `Use a ${label} action` : `Give back a ${label} action`}
          />
        )
      })}
    </div>
  )
}

/** A damage track with wound modifier marks every `step` boxes. */
function Track({
  label,
  boxes,
  filled,
  step,
  readOnly = false,
  onChange,
}: {
  label: string
  boxes: number
  filled: number
  step: number
  readOnly?: boolean
  onChange: (filled: number) => void
}) {
  const shown = Math.min(filled, boxes)
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {shown} / {boxes}
          {filled > boxes && <span className="text-danger"> +{filled - boxes} overflow</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: boxes }, (_, i) => {
          const n = i + 1
          const isFilled = n <= shown
          const endsStep = n % step === 0
          return (
            <button
              key={n}
              aria-label={`${label} box ${n}`}
              disabled={readOnly}
              onClick={() => onChange(n === shown ? n - 1 : n)}
              className={`size-6 rounded border text-[9px] font-semibold transition-colors ${
                isFilled ? 'border-danger bg-danger/80 text-bg' : 'border-line bg-bg hover:border-accent/60'
              } ${endsStep ? 'mr-1.5' : ''}`}
            >
              {isFilled ? '✕' : endsStep ? `-${n / step}` : ''}
            </button>
          )
        })}
        {!readOnly && (
          <button
            className="ml-1 size-6 rounded border border-line text-xs text-muted hover:text-fg"
            onClick={() => onChange(filled + 1)}
            title="Add a box past the end (overflow)"
            aria-label={`${label}: one more box`}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}

function StatusForm({
  onAdd,
  onCancel,
}: {
  onAdd: (status: ReturnType<typeof StatusSchema.parse>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(STATUSES[0].name)
  const [value, setValue] = useState(1)
  const [rounds, setRounds] = useState('')
  const def = STATUS_BY_NAME.get(name.toLowerCase())
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <select
        {...noAutofillField}
        className="input py-1 text-xs"
        value={name}
        onChange={(e) => setName(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s.name}>{s.name}</option>
        ))}
      </select>
      {def?.value && (
        <input
          {...noAutofill}
          type="number"
          min={1}
          max={def.value === 'level' ? 4 : 20}
          className="input w-14 py-1 text-xs"
          value={value}
          onChange={(e) => setValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
          aria-label={def.value === 'level' ? 'Level' : 'Number'}
        />
      )}
      <input
        {...noAutofill}
        type="number"
        min={1}
        className="input w-20 py-1 text-xs"
        placeholder="rounds"
        value={rounds}
        onChange={(e) => setRounds(e.target.value)}
        aria-label="Rounds (empty: until removed)"
        title="Rounds it lasts; leave empty for until removed"
      />
      <button
        className="btn btn-primary px-2 py-1 text-xs"
        onClick={() =>
          onAdd(
            StatusSchema.parse({
              name,
              value: def?.value ? value : 0,
              rounds: rounds ? Math.max(1, parseInt(rounds, 10) || 1) : null,
            }),
          )
        }
      >
        Add
      </button>
      <button className="text-muted hover:text-fg" onClick={onCancel} aria-label="Cancel">
        <X className="size-4" />
      </button>
      {def && <span className="basis-full text-muted">{def.effect}</span>}
    </div>
  )
}

const ATTRIBUTE_ORDER: [string, string][] = [
  ['body', 'Body'],
  ['agility', 'Agility'],
  ['reaction', 'Reaction'],
  ['strength', 'Strength'],
  ['willpower', 'Willpower'],
  ['logic', 'Logic'],
  ['intuition', 'Intuition'],
  ['charisma', 'Charisma'],
  ['edge', 'Edge'],
  ['magic', 'Magic'],
  ['resonance', 'Resonance'],
  ['essence', 'Essence'],
]

/** The book stat block, with a link to the page when the book is in the library. */
function NpcDetails({ npc }: { npc: NonNullable<Participant['npc']> }) {
  const bookId = (npc as { bookId?: string }).bookId
  const fields: [string, string][] = [
    ['Skills', npc.skills],
    ['Knowledge', npc.knowledge],
    ['Weapons', npc.weapons],
    ['Spells', npc.spells],
    ['Powers', npc.powers],
    ['Weaknesses', npc.weaknesses],
    ['Augmentations', npc.augmentations],
    ['Gear', npc.gear],
    ['Movement', npc.move],
    ['Notes', npc.notes],
  ]
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {ATTRIBUTE_ORDER.filter(([key]) => npc.attributes[key]).map(([key, label]) => {
          const a = npc.attributes[key]
          return (
            <span key={key} className="chip text-xs">
              {label}{' '}
              <span className="font-semibold text-fg tabular-nums">
                {a.base}
                {a.augmented !== a.base && `(${a.augmented})`}
              </span>
            </span>
          )
        })}
      </div>
      {fields
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <p key={label}>
            <span className="text-muted">{label}:</span> {value}
          </p>
        ))}
      <p className="text-xs text-muted">
        {npc.category}
        {npc.professionalRating !== null && ` · Professional Rating ${npc.professionalRating}`}
        {bookId && (
          <>
            {' · '}
            <Link to={`/book/${bookId}?pdf=${npc.page}`} className="text-accent hover:underline" target="_blank">
              Open the stat block
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
