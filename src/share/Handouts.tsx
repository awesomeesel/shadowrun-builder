import { useLiveQuery } from 'dexie-react-hooks'
import { FileImage, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Section } from '../components/ui'
import { db, type Handout } from '../db/db'
import { timeAgo } from './timeAgo'

/** A handout full screen: the picture as large as it fits, and the text. */
export function HandoutViewer({
  handout,
  onClose,
}: {
  handout: Pick<Handout, 'title' | 'text' | 'image' | 'campaignName' | 'receivedAt'>
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 sm:p-6" onClick={onClose}>
      <div className="mb-2 flex items-start gap-3 text-white">
        <div className="mr-auto min-w-0">
          <div className="font-display text-xl">{handout.title || 'Handout'}</div>
          <div className="text-xs text-white/60">
            {handout.campaignName} · {timeAgo(handout.receivedAt)}
          </div>
        </div>
        <button className="rounded-full bg-white/10 p-1.5" onClick={onClose} aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      {handout.image && (
        <img
          src={handout.image}
          alt={handout.title}
          className="min-h-0 flex-1 object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {handout.text && (
        <p
          className="mx-auto mt-3 max-h-[40vh] max-w-2xl overflow-y-auto rounded-lg bg-white/10 p-3 whitespace-pre-wrap text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {handout.text}
        </p>
      )}
    </div>,
    document.body,
  )
}

/** Handouts the player kept from the GM, on the Play tab. */
export function HandoutsSection({ characterId }: { characterId: string }) {
  const handouts = useLiveQuery(
    async () => (await db.handouts.where('characterId').equals(characterId).sortBy('receivedAt')).reverse(),
    [characterId],
  )
  const [open, setOpen] = useState<Handout | null>(null)
  if (!handouts?.length) return null
  return (
    <Section title="Handouts" icon={<FileImage className="size-4" />} className="lg:col-span-2">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {handouts.map((h) => (
          <li key={h.id} className="relative overflow-hidden rounded-lg border border-line bg-bg/40">
            <button className="block w-full text-left" onClick={() => setOpen(h)}>
              {h.image ? (
                <img src={h.image} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <p className="line-clamp-4 aspect-video p-2 text-xs whitespace-pre-wrap text-muted">{h.text}</p>
              )}
              <div className="truncate px-2 py-1 text-sm font-semibold">{h.title || 'Handout'}</div>
            </button>
            <button
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white/80 hover:text-danger"
              onClick={() => {
                if (confirm(`Throw away "${h.title || 'this handout'}"?`)) void db.handouts.delete(h.id)
              }}
              aria-label="Delete handout"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {open && <HandoutViewer handout={open} onClose={() => setOpen(null)} />}
    </Section>
  )
}
