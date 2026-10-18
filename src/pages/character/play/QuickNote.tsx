import { CornerDownLeft, NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { noAutofill } from '../../../components/noAutofill'

/**
 * A one-line note box at the top of the session, for jotting things down
 * mid-scene without scrolling. Each note goes into the session notes with
 * the time; the full notes are further down the page.
 */
export function QuickNote({ notes, onAdd }: { notes: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const lines = notes.split('\n').filter((l) => l.trim())
  const last = lines.at(-1)
  const add = () => {
    const note = text.trim()
    if (!note) return
    onAdd(note)
    setText('')
  }
  const showAll = () => document.querySelector('[data-jump="Session notes"]')?.scrollIntoView({ behavior: 'smooth' })
  return (
    <div className="basis-full">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className="relative min-w-0 flex-1">
          <NotebookPen className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <input
            {...noAutofill}
            className="input w-full py-2 pl-8"
            placeholder="Quick note: a name, a clue…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Quick note"
            enterKeyHint="done"
          />
        </label>
        <button className="btn px-3" disabled={!text.trim()} aria-label="Add note" title="Add to the session notes">
          <CornerDownLeft className="size-4" />
        </button>
      </form>
      {last && (
        <div className="mt-1.5 flex items-baseline gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-muted" title={last}>
            {last}
          </span>
          <button className="shrink-0 text-accent hover:underline" onClick={showAll}>
            All notes ({lines.length})
          </button>
        </div>
      )}
    </div>
  )
}
