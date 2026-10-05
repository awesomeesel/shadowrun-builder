import { noAutofill } from './noAutofill'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { formatSourceRef, parseSourceRef } from '../books/pages'
import { findBook } from '../db/books'
import { db } from '../db/db'
import type { SourceRef } from '../model/character'

/** A page reference like "CRB 245" that opens the page when the book is in the library. */
export function SourceLink({ source, className = '' }: { source: SourceRef; className?: string }) {
  const books = useLiveQuery(() => db.books.toArray())
  const book = books && findBook(books, source.book)
  const label = formatSourceRef(source)

  if (!book) {
    return (
      <span
        className={`text-xs text-muted ${className}`}
        title={`Add ${source.book} to your library to open this page`}
      >
        {label}
      </span>
    )
  }
  return (
    <Link
      to={`/book/${book.id}?page=${source.page}`}
      className={`text-xs text-accent hover:underline ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  )
}

/** Text field for a page reference; accepts "CRB 245", "crb p.245" and similar. */
export function SourceInput({
  value,
  onChange,
}: {
  value: SourceRef | undefined
  onChange: (value: SourceRef | undefined) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? (value ? formatSourceRef(value) : '')
  const invalid = draft !== null && draft.trim() !== '' && !parseSourceRef(draft)
  return (
    <div className="flex items-center gap-2">
      <input
        {...noAutofill}
        className={`input w-full ${invalid ? 'border-danger' : ''}`}
        placeholder="CRB 245"
        value={text}
        onChange={(e) => {
          setDraft(e.target.value)
          if (e.target.value.trim() === '') onChange(undefined)
          else {
            const parsed = parseSourceRef(e.target.value)
            if (parsed) onChange(parsed)
          }
        }}
        onBlur={() => setDraft(null)}
      />
      {value && !invalid && <SourceLink source={value} className="shrink-0" />}
    </div>
  )
}
