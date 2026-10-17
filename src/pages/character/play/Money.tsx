import { Coins, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { noAutofill } from '../../../components/noAutofill'
import { Stat } from '../../../components/sheetParts'
import { NumberInput, Section } from '../../../components/ui'
import type { Character } from '../../../model/character'
import { addLedgerEntry, removeLedgerEntry, sessionEntries } from '../../../rules/sr6/play'
import type { CharacterContext } from '../CharacterPage'

export function MoneySection({ character, update }: CharacterContext) {
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
