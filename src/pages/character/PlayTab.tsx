import {
  Coins,
  Crosshair,
  Dices,
  Flag,
  HeartPulse,
  Minus,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router'
import { RollResult } from '../../components/Dice'
import { noAutofill } from '../../components/noAutofill'
import { MonitorTrack, Stat } from '../../components/sheetParts'
import { NumberInput, Section } from '../../components/ui'
import type { Character } from '../../model/character'
import { computeDerived, ownedSkillPools, weaponPool } from '../../rules/sr6/derived'
import { formatInitiative, formatPool } from '../../rules/sr6/format'
import {
  addLedgerEntry,
  ammoCapacity,
  endSession,
  removeLedgerEntry,
  rollPool,
  sessionEntries,
  startSession,
  type Roll,
} from '../../rules/sr6/play'
import type { CharacterContext } from './CharacterPage'

const MAX_EDGE = 7

interface QuickPool {
  label: string
  pool: number
  /** Initiative rolls add the score to the dice. */
  initiativeScore?: number
}

/** The at-the-table view: damage, Edge, ammo, dice and money, wrapped in a session. */
export function PlayTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  const session = character.play.session
  return session ? (
    <ActiveSession character={character} update={update} />
  ) : (
    <NoSession character={character} update={update} />
  )
}

function NoSession({ character, update }: CharacterContext) {
  const [title, setTitle] = useState(`Session ${character.sessions.length + 1}`)
  return (
    <div className="grid gap-4">
      <section className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-neon/15 blur-3xl" />
        <h2 className="font-display text-2xl">Ready for a run?</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Start a session when you sit down to play. You get a play screen for damage, Edge, ammo, dice and money. When
          you end the session, everything is saved and a summary goes into the log below.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            {...noAutofill}
            className="input min-w-0 flex-1 py-2 sm:max-w-xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Session name"
          />
          <button className="btn btn-primary px-4 py-2" onClick={() => update((c) => startSession(c, title.trim()))}>
            <Play className="size-4" /> Start session
          </button>
        </div>
      </section>
      <SessionLog character={character} />
      <LedgerList update={update} entries={character.ledger} title="All money & karma changes" />
    </div>
  )
}

function ActiveSession({ character, update }: CharacterContext) {
  const derived = computeDerived(character)
  const wounds = derived.woundModifier
  const session = character.play.session!
  const [roll, setRoll] = useState<{ quick: QuickPool; result: Roll } | null>(null)
  const [ending, setEnding] = useState(false)
  const edge = character.play.edge ?? derived.attributes.edge

  const doRoll = (quick: QuickPool) =>
    setRoll({
      quick,
      result: rollPool(quick.initiativeScore !== undefined ? quick.pool : formatPool(quick.pool, wounds)),
    })

  const setEdge = (value: number) =>
    update((c) => ({ ...c, play: { ...c.play, edge: Math.max(0, Math.min(MAX_EDGE, value)) } }))

  const pools: QuickPool[] = [
    { label: 'Initiative', pool: derived.initiative.dice, initiativeScore: derived.initiative.score },
    { label: 'Defense', pool: derived.pools.defense },
    { label: 'Damage resistance', pool: derived.pools.damageResistance },
    ...character.weapons.flatMap((w) => {
      const p = weaponPool(character, w).pool
      return p === null ? [] : [{ label: w.name || 'Weapon', pool: p }]
    }),
    ...ownedSkillPools(character).flatMap((s) => (s.pool === null ? [] : [{ label: s.skill.name, pool: s.pool }])),
    ...(derived.magic?.spellcasting ? [{ label: 'Spellcasting', pool: derived.magic.spellcasting }] : []),
    ...(derived.magic?.drainResistance ? [{ label: 'Drain', pool: derived.magic.drainResistance }] : []),
    ...(derived.resonance?.tasking ? [{ label: 'Tasking', pool: derived.resonance.tasking }] : []),
    ...(derived.resonance ? [{ label: 'Fading', pool: derived.resonance.fadingResistance }] : []),
    { label: 'Composure', pool: derived.pools.composure },
    { label: 'Judge Intentions', pool: derived.pools.judgeIntentions },
    { label: 'Memory', pool: derived.pools.memory },
  ]

  return (
    <div className="grid gap-4 pb-48 sm:pb-8 lg:grid-cols-2">
      <section className="card flex flex-wrap items-center gap-3 border-accent/30 p-3 lg:col-span-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <div className="mr-auto min-w-0">
          <div className="truncate font-display text-lg">{session.title || 'Session'}</div>
          <div className="text-xs text-muted">Started {new Date(session.startedAt).toLocaleString()}</div>
        </div>
        <button className="btn" onClick={() => setEnding(true)}>
          <Flag className="size-4" /> End session
        </button>
      </section>

      <Section title="Status" icon={<HeartPulse className="size-4" />} className="lg:row-span-2">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="Initiative" value={formatInitiative(derived.initiative)} />
          <Stat label="Defense" value={derived.defenseRating} />
          <Stat label="Wounds" value={wounds === 0 ? '—' : wounds} tone={wounds < 0 ? 'danger' : undefined} />
        </div>
        <div className="grid gap-4">
          <MonitorTrack
            size="large"
            label="Physical"
            monitor={derived.physicalMonitor}
            onChange={(n) => update((c) => ({ ...c, damage: { ...c.damage, physical: n } }))}
          />
          <MonitorTrack
            size="large"
            label="Stun"
            monitor={derived.stunMonitor}
            onChange={(n) => update((c) => ({ ...c, damage: { ...c.damage, stun: n } }))}
          />
          {derived.physicalMonitor.filled >= derived.physicalMonitor.boxes && (
            <MonitorTrack
              size="large"
              label="Overflow"
              monitor={derived.overflow}
              showModifiers={false}
              onChange={(n) => update((c) => ({ ...c, damage: { ...c.damage, overflow: n } }))}
            />
          )}
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="flex items-center gap-1 text-muted">
              <Sparkles className="size-3.5" /> Edge
            </span>
            <button className="text-muted hover:text-fg" onClick={() => setEdge(derived.attributes.edge)}>
              Reset to {derived.attributes.edge}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn size-10 p-0" onClick={() => setEdge(edge - 1)} aria-label="Spend Edge">
              <Minus className="size-4" />
            </button>
            <div className="flex flex-1 justify-center gap-1.5">
              {Array.from({ length: MAX_EDGE }, (_, i) => (
                <button
                  key={i}
                  aria-label={`Set Edge to ${i + 1}`}
                  onClick={() => setEdge(i + 1 === edge ? i : i + 1)}
                  className={`size-6 rotate-45 rounded-sm border transition-all ${
                    i < edge
                      ? 'border-amber bg-amber/80 shadow-[0_0_10px_-2px_var(--color-amber)]'
                      : 'border-line bg-bg'
                  }`}
                />
              ))}
            </div>
            <button className="btn size-10 p-0" onClick={() => setEdge(edge + 1)} aria-label="Gain Edge">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </Section>

      <Section title="Roll dice" icon={<Dices className="size-4" />}>
        <p className="mb-3 text-xs text-muted">
          Tap a pool to roll it.{wounds < 0 && ` Your wound modifier (${wounds}) is already included.`}
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {pools.map((p, i) => (
            <button
              key={`${p.label}-${i}`}
              onClick={() => doRoll(p)}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg/60 px-2.5 py-2 text-left text-sm hover:border-accent/60"
            >
              <span className="truncate">{p.label}</span>
              <span className="shrink-0 font-display text-base font-semibold text-accent tabular-nums">
                {p.initiativeScore !== undefined ? `${p.initiativeScore}+${p.pool}D6` : formatPool(p.pool, wounds)}
              </span>
            </button>
          ))}
        </div>
        <CustomRoll onRoll={(pool) => setRoll({ quick: { label: 'Custom roll', pool }, result: rollPool(pool) })} />
      </Section>

      {character.weapons.some((w) => ammoCapacity(w) > 0) && (
        <Section title="Ammo" icon={<Crosshair className="size-4" />}>
          <ul className="grid gap-2">
            {character.weapons
              .filter((w) => ammoCapacity(w) > 0)
              .map((w) => {
                const capacity = ammoCapacity(w)
                const loaded = character.play.ammo[w.id] ?? capacity
                const setAmmo = (n: number) =>
                  update((c) => ({
                    ...c,
                    play: { ...c.play, ammo: { ...c.play.ammo, [w.id]: Math.max(0, Math.min(capacity, n)) } },
                  }))
                return (
                  <li key={w.id} className="flex items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{w.name || 'Weapon'}</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                        <div
                          className={`h-full rounded-full ${loaded === 0 ? 'bg-danger' : 'bg-accent'}`}
                          style={{ width: `${(loaded / capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-14 text-right font-display text-lg tabular-nums">
                      {loaded}
                      <span className="text-xs text-muted">/{capacity}</span>
                    </span>
                    <button
                      className="btn px-2"
                      onClick={() => setAmmo(loaded - 1)}
                      aria-label={`Fire one round from ${w.name}`}
                    >
                      −1
                    </button>
                    <button className="btn px-2" onClick={() => setAmmo(capacity)} aria-label={`Reload ${w.name}`}>
                      <RotateCcw className="size-4" />
                    </button>
                  </li>
                )
              })}
          </ul>
        </Section>
      )}

      <MoneySection character={character} update={update} />

      <Section title="Session notes" icon={<NotebookPen className="size-4" />}>
        <textarea
          className="input min-h-28 w-full"
          placeholder="Who you met, what you found, who owes you…"
          value={session.notes}
          onChange={(e) => {
            const notes = e.target.value
            update((c) => ({ ...c, play: { ...c.play, session: c.play.session && { ...c.play.session, notes } } }))
          }}
        />
      </Section>

      {roll && (
        <RollResult
          label={roll.quick.label}
          roll={roll.result}
          bonus={roll.quick.initiativeScore}
          onClose={() => setRoll(null)}
          onReroll={() => doRoll(roll.quick)}
        />
      )}
      {ending && <EndSessionDialog character={character} update={update} onClose={() => setEnding(false)} />}
    </div>
  )
}

function CustomRoll({ onRoll }: { onRoll: (pool: number) => void }) {
  const [pool, setPool] = useState(6)
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
      <span className="mr-auto text-muted">Any pool</span>
      <button className="btn size-9 p-0" onClick={() => setPool(Math.max(1, pool - 1))} aria-label="Fewer dice">
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center font-display text-lg tabular-nums">{pool}</span>
      <button className="btn size-9 p-0" onClick={() => setPool(pool + 1)} aria-label="More dice">
        <Plus className="size-4" />
      </button>
      <button className="btn btn-primary" onClick={() => onRoll(pool)}>
        <Dices className="size-4" /> Roll
      </button>
    </div>
  )
}

function MoneySection({ character, update }: CharacterContext) {
  const [nuyen, setNuyen] = useState(0)
  const [karma, setKarma] = useState(0)
  const [note, setNote] = useState('')
  const record = () => {
    if (!nuyen && !karma) return
    update((c) => addLedgerEntry(c, { nuyen, karma, note: note.trim() }))
    setNuyen(0)
    setKarma(0)
    setNote('')
  }
  return (
    <Section title="Nuyen & karma" icon={<Coins className="size-4" />}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label="Nuyen" value={`${character.nuyen.toLocaleString()}¥`} tone="accent" />
        <Stat
          label="Karma"
          value={character.karma.available}
          tone="accent"
          hint={`Career karma ${character.karma.career}`}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_2fr]">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Nuyen (− to spend)</span>
          <NumberInput value={nuyen} onChange={setNuyen} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Karma (− to spend)</span>
          <NumberInput value={karma} onChange={setKarma} />
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1 block text-[11px] text-muted">What for?</span>
          <input
            {...noAutofill}
            className="input w-full"
            placeholder="Paid by Mr. Johnson"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && record()}
          />
        </label>
      </div>
      <button className="btn btn-primary mt-2 w-full" onClick={record} disabled={!nuyen && !karma}>
        Record
      </button>
      <div className="mt-4">
        <LedgerList update={update} entries={sessionEntries(character)} title="This session" />
      </div>
    </Section>
  )
}

function LedgerList({
  update,
  entries,
  title,
}: {
  update: CharacterContext['update']
  entries: Character['ledger']
  title: string
}) {
  if (entries.length === 0) return null
  const sign = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString())
  return (
    <div>
      <h3 className="mb-1.5 text-xs tracking-wider text-muted uppercase">{title}</h3>
      <ul className="grid gap-1 text-sm">
        {[...entries].reverse().map((e) => (
          <li key={e.id} className="flex items-center gap-2 rounded-md bg-bg/50 px-2 py-1">
            <span className="min-w-0 flex-1 truncate">{e.note || <span className="text-muted">No note</span>}</span>
            {e.nuyen !== 0 && (
              <span className={`tabular-nums ${e.nuyen > 0 ? 'text-accent' : 'text-danger'}`}>{sign(e.nuyen)}¥</span>
            )}
            {e.karma !== 0 && (
              <span className={`tabular-nums ${e.karma > 0 ? 'text-amber' : 'text-danger'}`}>{sign(e.karma)} K</span>
            )}
            <button
              className="text-muted hover:text-danger"
              aria-label="Undo this entry"
              title="Undo"
              onClick={() => update((c) => removeLedgerEntry(c, e.id))}
            >
              <Undo2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SessionLog({ character }: { character: Character }) {
  if (character.sessions.length === 0) return null
  return (
    <Section title="Session log" icon={<NotebookPen className="size-4" />}>
      <ol className="grid gap-3">
        {[...character.sessions].reverse().map((s) => (
          <li key={s.id} className="rounded-lg border border-line bg-bg/40 p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">{s.title || 'Session'}</span>
              <span className="text-xs text-muted">{new Date(s.startedAt).toLocaleDateString()}</span>
              <span className="ml-auto text-xs tabular-nums">
                <span className={s.nuyen >= 0 ? 'text-accent' : 'text-danger'}>
                  {s.nuyen >= 0 ? '+' : ''}
                  {s.nuyen.toLocaleString()}¥
                </span>
                <span className="ml-2 text-amber">
                  {s.karma >= 0 ? '+' : ''}
                  {s.karma} karma
                </span>
              </span>
            </div>
            {s.notes && <p className="mt-1 whitespace-pre-wrap text-muted">{s.notes}</p>}
          </li>
        ))}
      </ol>
    </Section>
  )
}

const boxes = (n: number) => `${n} ${n === 1 ? 'box' : 'boxes'}`

function EndSessionDialog({ character, update, onClose }: CharacterContext & { onClose: () => void }) {
  const [clearStun, setClearStun] = useState(true)
  const [clearPhysical, setClearPhysical] = useState(false)
  const entries = sessionEntries(character)
  const nuyen = entries.reduce((s, e) => s + e.nuyen, 0)
  const karma = entries.reduce((s, e) => s + e.karma, 0)
  const line = (label: string, value: ReactNode) => (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="End session"
      >
        <h2 className="font-display text-xl">End {character.play.session?.title || 'session'}?</h2>
        <div className="mt-3 grid gap-1 text-sm">
          {line('Nuyen this session', `${nuyen >= 0 ? '+' : ''}${nuyen.toLocaleString()}¥`)}
          {line('Karma this session', `${karma >= 0 ? '+' : ''}${karma}`)}
          {line('Physical damage', boxes(character.damage.physical))}
          {line('Stun damage', boxes(character.damage.stun))}
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={clearStun}
              onChange={(e) => setClearStun(e.target.checked)}
            />
            Recover all Stun damage
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={clearPhysical}
              onChange={(e) => setClearPhysical(e.target.checked)}
            />
            Heal all Physical damage (downtime between runs)
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">
          Everything else (Edge, ammo, money and karma) is kept as it is now. The session goes into the log.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Keep playing
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              update((c) => endSession(c, { clearStun, clearPhysical }))
              onClose()
            }}
          >
            <Flag className="size-4" /> End session
          </button>
        </div>
      </div>
    </div>
  )
}
