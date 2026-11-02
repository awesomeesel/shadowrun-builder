import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { pdfPageToPrinted } from '../books/pages'
import { PdfPage } from '../books/PdfPage'
import { searchBooks, type SearchHit } from '../db/books'
import { db, type CatalogEntry } from '../db/db'
import { searchQuickRules } from '../rules/sr6/quickRules'
import { noAutofill } from './noAutofill'

/**
 * Rules lookup that slides in over whatever you're doing (the Play tab, an
 * encounter), so checking a rule mid-fight doesn't mean leaving the page.
 * The search, the page you were reading and whether it's open survive closing
 * it and switching pages.
 */
interface PanelState {
  open: boolean
  query: string
  /** A book page being read in the panel. */
  page: { bookId: string; page: number } | null
  zoom: number
}

let state: PanelState = { open: false, query: '', page: null, zoom: 1 }
const listeners = new Set<() => void>()
function set(change: Partial<PanelState>) {
  state = { ...state, ...change }
  listeners.forEach((l) => l())
}
function usePanel(): PanelState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

const KIND_LABEL: Record<string, string> = {
  quality: 'Quality',
  spell: 'Spell',
  adeptPower: 'Adept power',
  complexForm: 'Complex form',
  weapon: 'Weapon',
  armor: 'Armor',
  augmentation: 'Augmentation',
  gear: 'Gear',
  vehicle: 'Vehicle',
  matrixDevice: 'Matrix device',
  npc: 'Stat block',
}

/** The floating Rules button, the "/" shortcut, and the panel itself. */
export function RulesLauncher() {
  const panel = usePanel()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        set({ open: true })
      } else if (e.key === 'Escape' && state.open) {
        set({ open: false })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <>
      {!panel.open && (
        <button
          className="btn fixed right-4 bottom-4 z-30 rounded-full border-accent/60 bg-surface px-4 py-2.5 shadow-lg print:hidden"
          onClick={() => set({ open: true })}
          title="Look up a rule without leaving the page (shortcut: /)"
        >
          <Search className="size-4 text-accent" /> Rules
        </button>
      )}
      {panel.open && createPortal(<Panel panel={panel} />, document.body)}
    </>
  )
}

function Panel({ panel }: { panel: PanelState }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    // No backdrop: on a wide screen the page stays usable beside it.
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-bg shadow-2xl sm:w-[30rem]"
      aria-label="Rules lookup"
    >
      {panel.page ? <PageView panel={panel} width={width} /> : <Results query={panel.query} />}
      <div ref={box} className="h-0 w-full" />
    </aside>
  )
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-line p-3">
      {children}
      <button className="text-muted hover:text-fg" onClick={() => set({ open: false })} aria-label="Close rules">
        <X className="size-5" />
      </button>
    </div>
  )
}

function Results({ query }: { query: string }) {
  const needle = query.trim()
  const rules = searchQuickRules(needle).slice(0, 30)
  const hasBooks = useLiveQuery(async () => (await db.books.count()) > 0)
  const books = useLiveQuery(() => db.books.toArray())
  const [hits, setHits] = useState<{ query: string; items: SearchHit[] } | null>(null)
  const items = useLiveQuery(async () => {
    if (needle.length < 3) return []
    const lower = needle.toLowerCase()
    return (await db.catalog
      .filter((e) => e.name.toLowerCase().includes(lower))
      .limit(12)
      .toArray()) as CatalogEntry[]
  }, [needle])

  useEffect(() => {
    if (needle.length < 3 || !hasBooks) return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchBooks(needle, 25).then((items) => !cancelled && setHits({ query: needle, items }))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [needle, hasBooks])
  const pageHits = hits?.query === needle ? hits.items : null
  const bookCode = (id: string) => books?.find((b) => b.id === id)?.code || 'Book'
  const printed = (id: string, page: number) => {
    const book = books?.find((b) => b.id === id)
    return book ? pdfPageToPrinted(book, page) : page
  }

  return (
    <>
      <Header>
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
          <input
            {...noAutofill}
            className="input w-full pl-8"
            placeholder="Cover, burning, drain, called shot…"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            autoFocus
            enterKeyHint="search"
            aria-label="Search the rules"
          />
        </label>
      </Header>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {!needle && (
          <p className="text-muted">
            Type what you’re wondering about. You’ll get the app’s short summaries first, then items and pages from the
            books in your Library. Tap a page to read it here; close this and you’re right where you were.
          </p>
        )}
        {rules.length > 0 && (
          <ul className="mb-4 grid gap-2">
            {rules.map((r) => (
              <li key={`${r.group}|${r.title}`} className="card p-3">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-xs text-muted">{r.group}</span>
                  {r.page && <span className="ml-auto text-xs text-accent">CRB {r.page}</span>}
                </div>
                {r.lines.map((line) => (
                  <p key={line} className="text-fg/90">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
        {needle && rules.length === 0 && <p className="mb-4 text-muted">Nothing in the app’s summaries.</p>}

        {needle.length >= 3 && items && items.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-1.5 text-xs tracking-wider text-muted uppercase">In your books</h3>
            <ul className="grid gap-1">
              {items.map((e) => (
                <li key={e.id}>
                  <button
                    className="flex w-full items-baseline gap-2 rounded-lg border border-line px-2.5 py-1.5 text-left hover:border-accent/60"
                    onClick={() => set({ page: { bookId: e.bookId, page: e.page } })}
                  >
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="shrink-0 text-xs text-muted">{KIND_LABEL[e.kind] ?? e.kind}</span>
                    <span className="shrink-0 text-xs text-accent">
                      {bookCode(e.bookId)} {printed(e.bookId, e.page)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {needle.length >= 3 && (
          <section>
            <h3 className="mb-1.5 text-xs tracking-wider text-muted uppercase">Pages that mention it</h3>
            {!hasBooks ? (
              <p className="text-muted">Add your rulebook PDFs in the Library to search their full text here.</p>
            ) : pageHits === null ? (
              <p className="text-muted">Searching…</p>
            ) : pageHits.length === 0 ? (
              <p className="text-muted">No pages mention “{needle}”.</p>
            ) : (
              <ul className="grid gap-1.5">
                {pageHits.map((h) => (
                  <li key={`${h.book.id}-${h.page}`}>
                    <button
                      className="w-full rounded-lg border border-line p-2.5 text-left hover:border-accent/60"
                      onClick={() => set({ page: { bookId: h.book.id, page: h.page } })}
                    >
                      <span className="mr-2 text-xs text-accent">
                        {h.book.code || 'Book'} {pdfPageToPrinted(h.book, h.page)}
                      </span>
                      <span className="text-muted">{h.snippet}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  )
}

function PageView({ panel, width }: { panel: PanelState; width: number }) {
  const view = panel.page!
  const book = useLiveQuery(() => db.books.get(view.bookId), [view.bookId])
  const go = (page: number) => set({ page: { ...view, page: Math.min(Math.max(1, page), book?.pageCount ?? page) } })
  return (
    <>
      <Header>
        <button className="btn px-2 py-1 text-xs" onClick={() => set({ page: null })}>
          <ArrowLeft className="size-4" /> Results
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-xs text-muted">
          {book ? `${book.code || book.title} ${pdfPageToPrinted(book, view.page)}` : ''}
        </span>
      </Header>
      <div className="flex items-center gap-1 border-b border-line px-3 py-1.5">
        <button className="btn size-8 p-0" onClick={() => go(view.page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <button className="btn size-8 p-0" onClick={() => go(view.page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-auto" />
        <button
          className="btn size-8 p-0"
          onClick={() => set({ zoom: Math.max(1, panel.zoom - 0.5) })}
          disabled={panel.zoom <= 1}
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <button
          className="btn size-8 p-0"
          onClick={() => set({ zoom: Math.min(3, panel.zoom + 0.5) })}
          disabled={panel.zoom >= 3}
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <Link
          to={`/book/${view.bookId}?pdf=${view.page}`}
          className="btn ml-1 px-2 py-1 text-xs"
          onClick={() => set({ open: false })}
          title="Open the full book (leaves this page)"
        >
          <BookOpen className="size-4" /> <ExternalLink className="size-3" />
        </Link>
      </div>
      <div className="flex-1 overflow-auto bg-black/40">
        <PdfPage bookId={view.bookId} page={view.page} width={width} zoom={panel.zoom} />
      </div>
    </>
  )
}
