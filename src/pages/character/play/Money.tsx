import { Coins, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { noAutofill } from '../../../components/noAutofill'
import { Stat } from '../../../components/sheetParts'
import { NumberInput, Section } from '../../../components/ui'
import { GearSchema, type Character } from '../../../model/character'
import { addLedgerEntry, removeLedgerEntry, sessionEntries } from '../../../rules/sr6/play'
import type { CharacterContext } from '../CharacterPage'

/** Everyday costs at the table, as a starting note. */
const PAY_FOR = ['Bribe', 'Taxi', 'Food and drink', 'Info from a contact', 'Medkit refill', 'Gear', 'Fixer’s cut']
const QUICK_AMOUNTS = [50, 100, 500, 1000, 5000]

export function MoneySection({ character, update }: CharacterContext) {
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [toGear, setToGear] = useState(false)
  const [karma, setKarma] = useState(0)
  const [karmaNote, setKarmaNote] = useState('')
  const reset = () => {
    setAmount(0)
    setNote('')
    setToGear(false)
  }
  const pay = () => {
    if (amount <= 0) return
    const what = note.trim()
    update((c) => {
      const paid = addLedgerEntry(c, { nuyen: -amount, note: what || 'Paid' })
      // Bought something to keep: it goes on the gear list with what it cost.
      return toGear && what ? { ...paid, gear: [...paid.gear, GearSchema.parse({ name: what, cost: amount })] } : paid
    })
    reset()
  }
  const receive = () => {
    if (amount <= 0) return
    update((c) => addLedgerEntry(c, { nuyen: amount, note: note.trim() || 'Got paid' }))
    reset()
  }
  const recordKarma = () => {
    if (!karma) return
    update((c) => addLedgerEntry(c, { karma, note: karmaNote.trim() }))
    setKarma(0)
    setKarmaNote('')
  }
  const short = amount > character.nuyen
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
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Nuyen</span>
          <NumberInput value={amount} min={0} onChange={setAmount} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">What for?</span>
          <input
            {...noAutofill}
            className="input w-full"
            placeholder="Bribe for the bouncer, the Johnson’s pay…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pay()}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((n) => (
          <button
            key={n}
            className="chip cursor-pointer text-muted hover:text-fg"
            onClick={() => setAmount(amount + n)}
          >
            +{n.toLocaleString()}¥
          </button>
        ))}
        {PAY_FOR.map((p) => (
          <button
            key={p}
            className={`chip cursor-pointer ${note === p ? 'border-accent text-accent' : 'text-muted hover:text-fg'}`}
            onClick={() => setNote(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={toGear}
          onChange={(e) => setToGear(e.target.checked)}
        />
        It’s something to keep: add it to my gear
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          className="btn btn-primary"
          onClick={pay}
          disabled={amount <= 0}
          title={short ? 'More than you have; you’d go into the red' : undefined}
        >
          Pay {amount > 0 && `${amount.toLocaleString()}¥`}
        </button>
        <button className="btn" onClick={receive} disabled={amount <= 0}>
          Got paid {amount > 0 && `${amount.toLocaleString()}¥`}
        </button>
      </div>
      {short && amount > 0 && (
        <p className="mt-1 text-xs text-amber">That’s more than the {character.nuyen.toLocaleString()}¥ you have.</p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <label className="w-28">
          <span className="mb-1 block text-[11px] text-muted">Karma (− to spend)</span>
          <NumberInput value={karma} onChange={setKarma} />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-[11px] text-muted">What for?</span>
          <input
            {...noAutofill}
            className="input w-full"
            placeholder="Awarded by the GM"
            value={karmaNote}
            onChange={(e) => setKarmaNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && recordKarma()}
          />
        </label>
        <button className="btn" onClick={recordKarma} disabled={!karma}>
          Record karma
        </button>
      </div>
      <div className="mt-4">
        <LedgerList update={update} entries={sessionEntries(character)} title="This session" />
      </div>
    </Section>
  )
}

export function LedgerList({
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
              <span className={`tabular-nums ${e.karma > 0 ? 'text-amber' : 'text-danger'}`}>
                {sign(e.karma)} karma
              </span>
            )}
            {e.purchase ? (
              <span className="text-xs text-muted" title="Bought in the Karma tab">
                spent
              </span>
            ) : (
              <button
                className="text-muted hover:text-danger"
                aria-label="Undo this entry"
                title="Undo"
                onClick={() => update((c) => removeLedgerEntry(c, e.id))}
              >
                <Undo2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
