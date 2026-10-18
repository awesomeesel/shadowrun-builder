import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Inbox, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { db, type InboxItem } from '../db/db'
import type { Character } from '../model/character'
import type { Update } from '../pages/character/CharacterPage'
import { DamageDialog } from '../pages/character/play/DamageDialog'
import { applyMessage, describeMessage, dismissMessage } from './messages'
import { timeAgo } from './timeAgo'

/**
 * Messages from the GM for this character: damage, statuses, Edge, rewards.
 * Nothing changes until the player accepts; declining just removes it.
 */
export function GmInbox({ character, update }: { character: Character; update: Update }) {
  const items = useLiveQuery(
    () =>
      db.inbox
        .where('characterId')
        .equals(character.id)
        .filter((i) => !i.handled)
        .sortBy('sentAt'),
    [character.id],
  )
  const [resisting, setResisting] = useState<InboxItem | null>(null)
  if (!items?.length) return null

  const accept = (item: InboxItem) => {
    const m = item.message
    if (m.kind === 'damage' && m.resist) {
      setResisting(item)
      return
    }
    update((c) => applyMessage(c, m))
    void dismissMessage(item)
  }

  return (
    <section className="mb-5 rounded-xl border border-accent/50 bg-accent/5 p-3 print:hidden" aria-label="From your GM">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg">
        <Inbox className="size-5 text-accent" /> From your GM
      </h2>
      <ul className="grid gap-2">
        {items.map((item) => {
          const m = item.message
          const resist = m.kind === 'damage' && m.resist
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-bg/50 p-2.5 text-sm">
              <div className="min-w-0 flex-1 basis-52">
                <div className="font-semibold">{describeMessage(m)}</div>
                <div className="text-xs text-muted">
                  {m.note && <span className="text-fg">{m.note} · </span>}
                  {item.campaignName} · {timeAgo(item.sentAt)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-primary px-2.5 py-1 text-xs" onClick={() => accept(item)}>
                  <Check className="size-3.5" /> {resist ? 'Roll to resist' : 'Accept'}
                </button>
                <button
                  className="btn px-2.5 py-1 text-xs"
                  onClick={() => void dismissMessage(item)}
                  title="Ignore it; nothing changes on your sheet"
                >
                  <X className="size-3.5" /> Decline
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {resisting &&
        resisting.message.kind === 'damage' &&
        createPortal(
          <DamageDialog
            character={character}
            update={update}
            initial={{ value: resisting.message.value, type: resisting.message.type }}
            onApplied={() => void dismissMessage(resisting)}
            onClose={() => setResisting(null)}
          />,
          document.body,
        )}
    </section>
  )
}
