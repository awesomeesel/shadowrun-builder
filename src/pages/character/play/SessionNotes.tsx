import { Clock } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { noAutofillField } from '../../../components/noAutofill'

/**
 * The session's notes, oldest first like a diary. It opens scrolled to the
 * newest line, and follows along when a line is added from elsewhere (the
 * quick note in the session bar, or "Add the time"), but not while you're
 * scrolled up reading and typing.
 */
export function SessionNotes({
  notes,
  onChange,
  onAddTime,
}: {
  notes: string
  onChange: (notes: string) => void
  onAddTime: () => void
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  // After "Add the time": put the cursor after the new timestamp, ready to type.
  const typeAtEnd = useRef(false)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    if (typeAtEnd.current) {
      typeAtEnd.current = false
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    } else if (document.activeElement === el) {
      // Typing here: the browser keeps the cursor in view.
      return
    }
    el.scrollTop = el.scrollHeight
  }, [notes])

  return (
    <>
      <textarea
        {...noAutofillField}
        ref={box}
        className="input min-h-64 w-full"
        placeholder="Who you met, what you found, who owes you…"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        className="btn mt-2 text-xs"
        onClick={() => {
          typeAtEnd.current = true
          onAddTime()
        }}
      >
        <Clock className="size-3.5" /> Add the time
      </button>
    </>
  )
}
