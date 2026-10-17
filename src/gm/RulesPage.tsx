import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { pdfPageToPrinted } from '../books/pages'
import { SourceLink } from '../components/SourceLink'
import { noAutofill } from '../components/noAutofill'
import { searchBooks, type SearchHit } from '../db/books'
import { db } from '../db/db'
import { RULES_REFERENCE } from '../rules/sr6/reference'

/** Quick rules lookup: short summaries with page numbers, plus a search through the rulebooks in the library. */
export function RulesPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const hasBooks = useLiveQuery(async () => (await db.books.count()) > 0)
  const needle = query.trim().toLowerCase()

  const sections = useMemo(() => {
    if (!needle) return RULES_REFERENCE
    return RULES_REFERENCE.map((s) => ({
      ...s,
      entries: s.entries.filter((e) => `${s.title} ${e.title} ${e.lines.join(' ')}`.toLowerCase().includes(needle)),
    })).filter((s) => s.entries.length > 0)
  }, [needle])

  useEffect(() => {
    if (needle.length < 3 || !hasBooks) return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchBooks(needle, 30).then((result) => !cancelled && setHits(result))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [needle, hasBooks])
  const bookHits = needle.length >= 3 ? hits : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-8">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="mb-2 flex items-center gap-3">
          <button
            className="text-muted hover:text-fg"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="mr-auto font-display text-2xl font-semibold">Rules reference</h1>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
          <input
            {...noAutofill}
            className="input w-full pl-8"
            placeholder="Search: initiative, cover, burning, drain…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </label>
        {!needle && (
          <nav className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {RULES_REFERENCE.map((s) => (
              <a
                key={s.id}
                href={`#rules-${s.id}`}
                className="chip hover:border-accent/60"
                onClick={(e) => jump(e, s.id)}
              >
                {s.title}
              </a>
            ))}
          </nav>
        )}
      </header>

      <p className="mb-4 text-xs text-muted">
        Short summaries to keep the game moving. Page numbers are Core Rulebook pages; check the book for the full rule.
      </p>

      {sections.map((s) => (
        <section key={s.id} id={`rules-${s.id}`} className="mb-6 scroll-mt-40">
          <h2 className="mb-2 font-display text-xl text-accent">{s.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.entries.map((e) => (
              <article key={e.title} className="card p-3 text-sm">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{e.title}</h3>
                  <SourceLink source={{ book: 'CRB', page: e.page }} />
                </div>
                <ul className="grid gap-1 text-muted">
                  {e.lines.map((line) => (
                    <li key={line} className="text-fg/90">
                      {line}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
      {needle && sections.length === 0 && <p className="mb-6 text-sm text-muted">Nothing in the summaries.</p>}

      {needle.length >= 3 && (
        <section className="mb-6">
          <h2 className="mb-2 font-display text-xl">In your books</h2>
          {!hasBooks ? (
            <p className="text-sm text-muted">
              Add rulebook PDFs in the{' '}
              <Link to="/library" className="text-accent hover:underline">
                Library
              </Link>{' '}
              to search their full text here.
            </p>
          ) : bookHits === null ? (
            <p className="text-sm text-muted">Searching…</p>
          ) : bookHits.length === 0 ? (
            <p className="text-sm text-muted">No pages mention “{query.trim()}”.</p>
          ) : (
            <ul className="grid gap-1.5">
              {bookHits.map((h) => (
                <li key={`${h.book.id}-${h.page}`}>
                  <Link
                    to={`/book/${h.book.id}?pdf=${h.page}`}
                    className="card block p-2.5 text-sm hover:border-accent/60"
                  >
                    <span className="mr-2 text-xs text-accent">
                      {h.book.code} {pdfPageToPrinted(h.book, h.page)}
                    </span>
                    <span className="text-muted">{h.snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

/** Hash routing owns the URL fragment, so scroll to the section instead of following the link. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault()
  document.getElementById(`rules-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
