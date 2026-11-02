import { Minus, Phone, Plus, StickyNote, Users } from 'lucide-react'
import { useState } from 'react'
import { HelpButton } from '../../../components/Help'
import { noAutofill } from '../../../components/noAutofill'
import { Section } from '../../../components/ui'
import type { Character } from '../../../model/character'
import { addContactNote, contactPool, favorsText } from '../../../rules/sr6/contacts'
import type { HelpEntry } from '../../../rules/sr6/help'
import type { Update } from '../CharacterPage'
import type { QuickPool } from './types'

const ASKING: HelpEntry = {
  title: 'Asking a contact',
  text: 'The GM rolls the contact’s Connection twice over to see what they know. You roll Influence + Charisma with their Loyalty added: each hit is one level of what they know, shared for free. More than that costs, usually about 100¥ a level. Favors work the same way: the better they like you, the more they’ll do.',
  page: 52,
}

/** Contacts at the table: ask them, keep track of favors, and jot down what they said. */
export function ContactsSection({
  character,
  update,
  onRoll,
}: {
  character: Character
  update: Update
  onRoll: (quick: QuickPool) => void
}) {
  const [noting, setNoting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  if (character.contacts.length === 0) return null

  const change = (id: string, fn: (c: Character['contacts'][number]) => Character['contacts'][number]) =>
    update((c) => ({ ...c, contacts: c.contacts.map((x) => (x.id === id ? fn(x) : x)) }))
  const saveNote = (id: string) => {
    if (note.trim()) change(id, (x) => ({ ...x, notes: addContactNote(x.notes, note) }))
    setNote('')
    setNoting(null)
  }

  return (
    <Section title="Contacts" icon={<Users className="size-4" />} aside={<HelpButton entry={ASKING} />}>
      <ul className="grid gap-2">
        {character.contacts.map((contact) => {
          const pool = contactPool(character, contact)
          const lastNote = contact.notes.trim().split('\n').at(-1)
          return (
            <li key={contact.id} className="rounded-lg border border-line bg-bg/40 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{contact.name || 'Unnamed contact'}</span>
                {contact.role && <span className="text-xs text-muted">{contact.role}</span>}
                <span className="ml-auto text-xs text-muted" title="Connection / Loyalty">
                  C{contact.connection} · L{contact.loyalty}
                </span>
              </div>
              {lastNote && (
                <p className="mt-0.5 truncate text-xs text-muted" title={contact.notes}>
                  {lastNote}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="btn px-2.5 py-1 text-xs"
                  onClick={() =>
                    onRoll({
                      label: `Ask ${contact.name || 'a contact'}`,
                      pool,
                      info: 'Each hit: one level of what they know, for free. More costs about 100¥ a level. The GM rolls their Connection + Connection for what they know.',
                      help: ASKING,
                    })
                  }
                  title="Influence + Charisma + their Loyalty"
                >
                  <Phone className="size-3.5" /> Ask · {pool}
                </button>
                <span className="flex items-center gap-1 text-xs">
                  <button
                    className="btn size-7 p-0"
                    onClick={() => change(contact.id, (x) => ({ ...x, favors: x.favors - 1 }))}
                    aria-label={`You owe ${contact.name} one more`}
                    title="You owe them one more"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span
                    className={`min-w-28 text-center ${contact.favors > 0 ? 'text-accent' : contact.favors < 0 ? 'text-amber' : 'text-muted'}`}
                  >
                    {favorsText(contact.favors)}
                  </span>
                  <button
                    className="btn size-7 p-0"
                    onClick={() => change(contact.id, (x) => ({ ...x, favors: x.favors + 1 }))}
                    aria-label={`${contact.name} owes you one more`}
                    title="They owe you one more"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </span>
                <button
                  className="ml-auto text-xs text-muted hover:text-fg"
                  onClick={() => {
                    setNoting(noting === contact.id ? null : contact.id)
                    setNote('')
                  }}
                >
                  <StickyNote className="inline size-3.5" /> Note
                </button>
              </div>
              {noting === contact.id && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveNote(contact.id)
                  }}
                >
                  <input
                    {...noAutofill}
                    className="input min-w-0 flex-1 py-1"
                    placeholder="What they told you, what it cost…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoFocus
                  />
                  <button className="btn px-2.5 py-1 text-xs" disabled={!note.trim()}>
                    Add
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
