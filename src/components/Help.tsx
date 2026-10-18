import { Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HelpEntry } from '../rules/sr6/help'
import { SourceLink } from './SourceLink'

/** A small ⓘ that opens a short explanation. Tap-friendly, so it works on phones (unlike a hover tooltip). */
export function HelpButton({ entry, className = '' }: { entry: HelpEntry | undefined; className?: string }) {
  const [open, setOpen] = useState(false)
  if (!entry) return null
  return (
    <>
      <button
        type="button"
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`What is ${entry.title}?`}
      >
        <Info className="size-3.5" />
      </button>
      {open && createPortal(<HelpSheet entry={entry} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function HelpSheet({ entry, onClose }: { entry: HelpEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md rounded-b-none p-4 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={entry.title}
      >
        <div className="mb-2 flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <h2 className="mr-auto font-display text-lg leading-tight">{entry.title}</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm leading-relaxed">{entry.text}</p>
        {entry.page && (
          <p className="mt-3 text-xs text-muted">
            Full rule: <SourceLink source={{ book: 'CRB', page: entry.page }} />
          </p>
        )}
      </div>
    </div>
  )
}
