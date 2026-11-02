import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Minus,
  Plus,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pdfPageToPrinted } from '../books/pages'
import { PdfPage } from '../books/PdfPage'
import { highlight, SearchIndex, snippet, type SearchDoc } from '../books/search'
import { db, type Book } from '../db/db'
import { QUICK_RULES } from '../rules/sr6/quickRules'
import { noAutofill } from './noAutofill'
import {
  closeRules,
  HAS_KEYBOARD,
  IS_MAC,
  openRules,
  SHORTCUT,
  set,
  state,
  usePanel,
  type Filter,
  type PanelState,
} from './rulesStore'

/**
 * Rules lookup that slides in over whatever you're doing (the Play tab, an
 * encounter), so checking a rule mid-fight doesn't mean leaving the page.
 * One ranked list covers the app's own summaries, items from the books and
 * the books' sections; tap one to read it in place. The search, the filter
 * and what you were reading survive closing it and switching pages.
 */
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

/** Badge for the app's own summaries, by where they come from. */
function ruleLabel(group: string): string {
  if (group === 'Statuses') return 'Status'
  if (group === 'Edge action') return 'Edge action'
  if (/edge/i.test(group)) return 'Edge'
  if (group === 'Skill') return 'Skill'
  if (group === 'Playing') return 'Tip'
  return 'Rule'
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rule', label: 'Rules' },
  { id: 'item', label: 'Items' },
  { id: 'section', label: 'Books' },
]

// ---- The index: built once per set of books, kept while the app is open ----

let built: { key: string; index: Promise<SearchIndex> } | null = null

async function buildIndex(books: Book[]): Promise<SearchIndex> {
  const code = new Map(books.map((b) => [b.id, b.code || b.title]))
  const byId = new Map(books.map((b) => [b.id, b]))
  const printed = (bookId: string, page: number) => {
    const book = byId.get(bookId)
    return book ? pdfPageToPrinted(book, page) : page
  }
  const docs: SearchDoc[] = QUICK_RULES.map((r, i) => ({
    id: `rule:${i}`,
    kind: 'rule',
    label: ruleLabel(r.group),
    title: r.title.replace(/\s+#$/, ''),
    path: [r.group],
    source: r.page ? 'CRB' : undefined,
    printedPage: r.page,
    lines: r.lines,
  }))
  const catalog = (await db.catalog.toArray()).filter((e) => byId.has(e.bookId))
  // Sections about a known item (a spell, a weapon) are labelled as that item. The same name can be
  // two things (Combat Sense is a spell and an adept power), so the page has to match too.
  const named = new Map<string, typeof catalog>()
  for (const e of catalog) {
    const key = `${e.bookId}|${e.name.toLowerCase()}`
    named.set(key, [...(named.get(key) ?? []), e])
  }
  const itemFor = (bookId: string, title: string, page: number) =>
    named.get(`${bookId}|${title.toLowerCase()}`)?.find((e) => Math.abs(e.page - page) <= 1)
  // A book reprinting a passage (e.g. in a tables appendix) shows up once.
  const seen = new Set<string>()
  const covered = new Set<string>()
  for (const s of await db.bookSections.toArray()) {
    if (!byId.has(s.bookId)) continue
    const title = s.path[s.path.length - 1]
    const key = `${title.toLowerCase()}|${s.text[0]?.slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    const item = itemFor(s.bookId, title, s.page)
    if (item) covered.add(item.id)
    docs.push({
      id: `section:${s.bookId}:${s.index}`,
      kind: item ? 'item' : 'section',
      label: item ? (KIND_LABEL[item.kind] ?? item.kind) : 'Book',
      title,
      path: [code.get(s.bookId) ?? '', ...s.path.slice(0, -1)],
      bookId: s.bookId,
      page: s.page,
      printedPage: printed(s.bookId, s.page),
      source: code.get(s.bookId),
      lines: s.text,
    })
  }
  for (const e of catalog) {
    // The book's own section about it says more; that one is shown instead.
    if (covered.has(e.id)) continue
    docs.push({
      id: `item:${e.id}`,
      kind: 'item',
      label: KIND_LABEL[e.kind] ?? e.kind,
      title: e.name,
      path: [code.get(e.bookId) ?? '', e.category],
      bookId: e.bookId,
      page: e.page,
      printedPage: printed(e.bookId, e.page),
      source: code.get(e.bookId),
      lines: [],
    })
  }
  return SearchIndex.build(docs)
}

/** The search index for the books in the library, built in the background on first use. */
function useSearchIndex(): { index: SearchIndex | null; books: Book[] } {
  const books = useLiveQuery(() => db.books.toArray())
  const [index, setIndex] = useState<{ key: string; index: SearchIndex } | null>(null)
  // Rebuilt when a book is added, removed or re-read.
  const key = books?.map((b) => `${b.id}:${b.extractedVersion ?? 0}:${b.code}`).join('|') ?? null
  useEffect(() => {
    if (key === null || !books) return
    if (built?.key !== key) built = { key, index: buildIndex(books.filter((b) => b.extractedVersion)) }
    let cancelled = false
    void built.index.then((i) => !cancelled && setIndex({ key, index: i }))
    return () => {
      cancelled = true
    }
  }, [key, books])
  return { index: index?.key === key ? index.index : null, books: books ?? [] }
}

// ---- The launcher ----

/** The rules page shows the search itself; there the shortcut just goes to the search box. */
const onRulesPage = () => location.hash.startsWith('#/rules')

/**
 * Mounted once for the whole app: the ⌘K / Ctrl+K shortcut and the panel.
 * Pages open it with openRules() or a RulesButton.
 */
export function RulesHost() {
  const panel = usePanel()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K on a Mac, Ctrl+K elsewhere, as in most apps' search. Works while typing too; again to close.
      const modifier = IS_MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
      if (modifier && !e.altKey && !e.shiftKey && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        if (onRulesPage()) document.querySelector<HTMLInputElement>('input[aria-label="Search the rules"]')?.focus()
        else if (state.open) closeRules()
        else openRules()
      } else if (e.key === 'Escape' && state.open) {
        closeRules()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return panel.open ? createPortal(<Panel />, document.body) : null
}

/** The floating Rules button for pages used at the table (a character, an encounter). */
export function RulesButton() {
  const panel = usePanel()
  if (panel.open) return null
  return (
    <button
      className="btn fixed right-4 bottom-4 z-30 rounded-full border-accent/60 bg-surface px-4 py-2.5 shadow-lg print:hidden"
      onClick={openRules}
      title={`Look up a rule without leaving the page (${IS_MAC ? '⌘K' : 'Ctrl+K'})`}
    >
      <Search className="size-4 text-accent" /> Rules
      {HAS_KEYBOARD && (
        <kbd className="ml-1 rounded border border-line px-1.5 py-px font-sans text-[11px] text-muted">{SHORTCUT}</kbd>
      )}
    </button>
  )
}

function Panel() {
  return (
    // No backdrop: on a wide screen the page stays usable beside it.
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-bg shadow-2xl sm:w-[30rem]"
      aria-label="Rules lookup"
    >
      <SearchView onClose={closeRules} />
    </aside>
  )
}

const CloseContext = createContext<(() => void) | undefined>(undefined)

/**
 * The search itself: results, a result being read, or a book page. Used in the
 * panel and on the rules page; `empty` is shown before anything is typed.
 */
export function SearchView({ onClose, empty }: { onClose?: () => void; empty?: React.ReactNode }) {
  const panel = usePanel()
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const { index, books } = useSearchIndex()
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <CloseContext.Provider value={onClose}>
      {panel.page ? (
        <PageView panel={panel} width={width} />
      ) : panel.selected ? (
        <Reader doc={panel.selected} index={index} query={panel.query} />
      ) : (
        <Results panel={panel} index={index} books={books} empty={empty} />
      )}
      <div ref={box} className="h-0 w-full" />
    </CloseContext.Provider>
  )
}

function Header({ children }: { children: React.ReactNode }) {
  const onClose = useContext(CloseContext)
  return (
    <div className="flex items-center gap-2 border-b border-line p-3">
      {children}
      {onClose && (
        <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close rules">
          <X className="size-5" />
        </button>
      )}
    </div>
  )
}

/** Text with the query's words marked. */
function Marked({ text, stems }: { text: string; stems: Set<string> }) {
  return (
    <>
      {highlight(text, stems).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-accent/25 px-0.5 text-fg">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

function Badge({ doc }: { doc: SearchDoc }) {
  const tone =
    doc.kind === 'rule'
      ? 'border-accent/50 text-accent'
      : doc.kind === 'item'
        ? 'border-amber/50 text-amber'
        : 'border-line text-muted'
  return (
    <span className={`shrink-0 rounded border px-1.5 py-px text-[10px] tracking-wide uppercase ${tone}`}>
      {doc.label}
    </span>
  )
}

/** "CRB 52 · Statuses › Status List" */
function whereText(doc: SearchDoc): string {
  const page = doc.source && doc.printedPage ? `${doc.source} ${doc.printedPage}` : ''
  const trail = doc.kind === 'rule' ? doc.path : doc.path.slice(1)
  // Long trails: the nearest headings say the most.
  const shown = trail.length > 2 ? ['…', ...trail.slice(-2)] : trail
  return [page, shown.filter(Boolean).join(' › ')].filter(Boolean).join(' · ')
}

function Results({
  panel,
  index,
  books,
  empty,
}: {
  panel: PanelState
  index: SearchIndex | null
  books: Book[]
  empty?: React.ReactNode
}) {
  const needle = panel.query.trim()
  const codes = books.filter((b) => b.extractedVersion).map((b) => b.code || b.title)
  const results =
    index && needle
      ? index.search(
          panel.query,
          (d) =>
            (panel.filter === 'all' || d.kind === panel.filter) &&
            (!panel.book || d.kind === 'rule' || d.source === panel.book),
          50,
        )
      : []
  const stems = index ? index.matchStems(panel.query) : new Set<string>()

  return (
    <>
      <Header>
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
          <input
            {...noAutofill}
            className="input w-full pl-8"
            placeholder="Cover, drain, called shot, reload…"
            value={panel.query}
            onChange={(e) => set({ query: e.target.value })}
            autoFocus
            enterKeyHint="search"
            aria-label="Search the rules"
          />
        </label>
      </Header>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2 text-xs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`chip cursor-pointer ${panel.filter === f.id ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
            onClick={() => set({ filter: f.id })}
          >
            {f.label}
          </button>
        ))}
        {codes.length > 1 && <span className="mx-1 border-l border-line" />}
        {codes.length > 1 &&
          codes.map((c) => (
            <button
              key={c}
              className={`chip cursor-pointer ${panel.book === c ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
              onClick={() => set({ book: panel.book === c ? null : c })}
              title={panel.book === c ? 'Show all books' : `Only ${c}`}
            >
              {c}
            </button>
          ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {!index ? (
          <p className="text-muted">Getting the books ready to search…</p>
        ) : !needle ? (
          (empty ?? (
            <p className="text-muted">
              Type what you’re wondering about. Best matches come first: the app’s short summaries, items from your
              books, and the sections of your books under their headings. Tap one to read it here; close this and you’re
              right where you were.
            </p>
          ))
        ) : results.length === 0 ? (
          <p className="text-muted">Nothing found for “{needle}”. Try another word, or fewer words.</p>
        ) : (
          <ul className="grid gap-1.5">
            {results.map(({ doc }) => {
              const line = snippet(doc.lines, stems, 150)
              return (
                <li key={doc.id}>
                  <button
                    className="w-full rounded-lg border border-line px-3 py-2 text-left hover:border-accent/60"
                    onClick={() => set({ selected: doc })}
                  >
                    <div className="flex items-center gap-2">
                      <Badge doc={doc} />
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        <Marked text={doc.title} stems={stems} />
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-accent/80">{whereText(doc)}</div>
                    {line && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted">
                        <Marked text={line} stems={stems} />
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

/** One result to read: the rule, or the book section's text, with the query's words marked. */
function Reader({ doc, index, query }: { doc: SearchDoc; index: SearchIndex | null; query: string }) {
  const stems = index ? index.matchStems(query) : new Set<string>()
  const body = useRef<HTMLDivElement>(null)
  // Start at the first match in a long section.
  useEffect(() => {
    body.current?.querySelector('mark')?.scrollIntoView({ block: 'center' })
  }, [doc.id])
  return (
    <>
      <Header>
        <button className="btn px-2 py-1 text-xs" onClick={() => set({ selected: null })}>
          <ArrowLeft className="size-4" /> Results
        </button>
        <span className="mx-auto" />
        {doc.bookId && doc.page && (
          <button
            className="btn px-2 py-1 text-xs"
            onClick={() => set({ page: { bookId: doc.bookId!, page: doc.page! } })}
          >
            <FileText className="size-4" /> See page
          </button>
        )}
      </Header>
      <div ref={body} className="flex-1 overflow-y-auto p-4 text-sm">
        <div className="mb-1 flex items-center gap-2">
          <Badge doc={doc} />
          <span className="text-xs text-accent/80">{whereText(doc)}</span>
        </div>
        <h2 className="mb-3 font-display text-xl leading-tight">
          <Marked text={doc.title} stems={stems} />
        </h2>
        {doc.lines.length ? (
          <div className="grid gap-2.5 leading-relaxed">
            {doc.lines.map((line, i) => (
              <p key={i}>
                <Marked text={line} stems={stems} />
              </p>
            ))}
          </div>
        ) : (
          <p className="text-muted">
            {doc.path[1] ? `${doc.path[1]}. ` : ''}See the page for its full description and stats.
          </p>
        )}
        {doc.kind === 'section' && (
          <p className="mt-4 text-xs text-muted">
            Text as read from your PDF; tables and boxes may come out jumbled. “See page” shows the real page.
          </p>
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
          <ArrowLeft className="size-4" /> {panel.selected ? 'Back' : 'Results'}
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
          className="btn h-8 px-2 text-xs"
          onClick={() => set({ full: 1 })}
          title="Show the page full screen (or click the page)"
        >
          <ZoomIn className="size-4" /> Full screen
        </button>
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
        {/* A plain link: the panel lives outside the router. */}
        <a
          href={`#/book/${view.bookId}?pdf=${view.page}`}
          className="btn ml-1 px-2 py-1 text-xs"
          onClick={closeRules}
          title="Open the full book (leaves this page)"
        >
          <BookOpen className="size-4" /> <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="flex-1 overflow-auto bg-black/40">
        <button
          className="block cursor-zoom-in"
          onClick={() => set({ full: 1 })}
          aria-label="Show the page full screen"
        >
          <PdfPage bookId={view.bookId} page={view.page} width={width} zoom={panel.zoom} />
        </button>
      </div>
      {panel.full > 0 &&
        createPortal(
          <FullPage
            view={view}
            level={panel.full}
            go={go}
            label={book ? `${book.code || book.title} ${pdfPageToPrinted(book, view.page)}` : ''}
          />,
          document.body,
        )}
    </>
  )
}

/** How much each click zooms in, relative to fitting the screen; the click after the last goes back to fit. */
const FULL_LEVELS = [1, 2]

/**
 * A book page over the whole screen: it starts fitted, each click zooms in a
 * step around the spot clicked, and Esc, ✕, the shrink button or a click
 * beside the page goes back to the small view.
 */
function FullPage({
  view,
  level,
  go,
  label,
}: {
  view: { bookId: string; page: number }
  level: number
  go: (page: number) => void
  label: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [aspect, setAspect] = useState(1.3)
  const pageBox = useRef<HTMLButtonElement>(null)
  // After the next zoom: the spot clicked, as a fraction of the page, and where it was on screen.
  const anchor = useRef<{ fx: number; fy: number; x: number; y: number } | null>(null)
  const close = () => set({ full: 0 })

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    // Capture, so Esc shrinks the page before the rules panel sees it (which would close the panel).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        close()
      } else if (e.key === 'ArrowRight') go(view.page + 1)
      else if (e.key === 'ArrowLeft') go(view.page - 1)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [go, view.page])

  // Fit the whole page on screen, below the toolbar.
  const bar = 52
  const fitWidth = Math.max(100, Math.min(size.w - 24, (size.h - bar - 24) / aspect))
  const zoom = FULL_LEVELS[Math.min(level, FULL_LEVELS.length) - 1]
  const width = Math.round(fitWidth * zoom)

  // The page box takes its new size at once (from the page's proportions), before the
  // page is redrawn, so the clicked spot can be scrolled back under the pointer right away.
  useLayoutEffect(() => {
    const el = scroller.current
    const box = pageBox.current
    const a = anchor.current
    if (!el || !box || !a) return
    anchor.current = null
    const area = el.getBoundingClientRect()
    const page = box.getBoundingClientRect()
    const left = page.left - area.left + el.scrollLeft
    const top = page.top - area.top + el.scrollTop
    el.scrollLeft = left + a.fx * page.width - a.x
    el.scrollTop = top + a.fy * page.height - a.y
  }, [width])

  const onPageClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const el = scroller.current
    if (!el) return
    const box = e.currentTarget.getBoundingClientRect()
    const area = el.getBoundingClientRect()
    anchor.current = {
      fx: (e.clientX - box.left) / box.width,
      fy: (e.clientY - box.top) / box.height,
      x: e.clientX - area.left,
      y: e.clientY - area.top,
    }
    set({ full: level >= FULL_LEVELS.length ? 1 : level + 1 })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-neutral-950"
      role="dialog"
      aria-label="Book page, full screen"
    >
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-3 text-white">
        <button className="btn size-9 p-0" onClick={() => go(view.page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-5" />
        </button>
        <button className="btn size-9 p-0" onClick={() => go(view.page + 1)} aria-label="Next page">
          <ChevronRight className="size-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-sm">
          {label}
          <span className="ml-2 hidden text-xs text-white/50 sm:inline">
            {level > 1 ? 'Click to fit the page' : 'Click to zoom in'} · Esc to go back
          </span>
        </span>
        <button className="btn h-9 px-3 text-xs" onClick={close} title="Back to the small page (Esc)">
          <ZoomOut className="size-4" /> Smaller
        </button>
        <button
          className="rounded-full p-1.5 text-white/80 hover:text-white"
          onClick={close}
          aria-label="Close full screen"
        >
          <X className="size-5" />
        </button>
      </div>
      {/* A click beside the page goes back too; on the page it zooms. */}
      <div ref={scroller} className="flex-1 overflow-auto" onClick={close}>
        <div className="flex min-h-full min-w-full items-center justify-center p-3" style={{ width: width + 24 }}>
          <button
            ref={pageBox}
            className={`block shrink-0 overflow-hidden ${level >= FULL_LEVELS.length ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            style={{ width, height: Math.round(width * aspect) }}
            onClick={onPageClick}
            aria-label={level >= FULL_LEVELS.length ? 'Fit the page to the screen' : 'Zoom in'}
          >
            <PdfPage bookId={view.bookId} page={view.page} width={width} onAspect={setAspect} />
          </button>
        </div>
      </div>
    </div>
  )
}
