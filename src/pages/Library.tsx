import { noAutofill } from '../components/noAutofill'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, CloudDownload, CloudUpload } from 'lucide-react'
import type { RemoteBook } from '../cloud/books'
import { downloadRemoteBook, remoteBooks, uploadBookToDrive, useCloud } from '../cloud/cloud'
import { useEffect, useRef, useState, type ComponentProps, type DragEvent } from 'react'
import { Link } from 'react-router'
import { KNOWN_BOOKS } from '../books/catalog'
import { EXTRACTOR_VERSION } from '../books/extract'
import { pdfPageToPrinted } from '../books/pages'
import { addBook, deleteBook, searchBooks, updateBook, type SearchHit } from '../db/books'
import { db, type Book } from '../db/db'

export function Library() {
  const books = useLiveQuery(() => db.books.toArray())
  const fileInput = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    setError(null)
    for (const file of Array.from(files)) {
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        setError(`${file.name} is not a PDF.`)
        continue
      }
      setAdding((a) => [...a, file.name])
      try {
        await addBook(file)
      } catch (e) {
        setError(`Could not read ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setAdding((a) => a.filter((n) => n !== file.name))
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files)
  }

  return (
    <div
      className="min-h-full"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 sm:px-8">
        <Link to="/" className="text-muted hover:text-fg" aria-label="Back to characters">
          ←
        </Link>
        <h1 className="mr-auto font-display text-xl tracking-wide text-accent">Rulebook library</h1>
        <button className="btn btn-primary" onClick={() => fileInput.current?.click()}>
          Add PDF
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8">
        <p className="text-sm text-muted">
          Add the Shadowrun 6 PDFs you own. They are stored only in this browser and are never uploaded. Page references
          like <span className="text-fg">CRB 245</span> open the right page, and you can search the text of every book.
        </p>

        {error && <div className="rounded border border-danger/50 bg-danger/10 px-4 py-3 text-sm">{error}</div>}

        {books && books.length > 0 && <SearchPanel />}
        <DriveBooksPanel />

        <ul className="grid gap-3">
          {adding.map((name) => (
            <li key={name} className="card p-4 text-sm text-muted">
              Reading {name}…
            </li>
          ))}
          {books?.map((book) => (
            <BookRow key={book.id} book={book} />
          ))}
        </ul>

        {books?.length === 0 && adding.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">
            No books yet. Click <span className="text-fg">Add PDF</span> or drop PDF files on this page.
          </div>
        )}
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center bg-bg/80 text-lg text-accent">
          <div className="rounded-lg border-2 border-dashed border-accent px-10 py-8">Drop PDFs to add them</div>
        </div>
      )}
    </div>
  )
}

function BookRow({ book }: { book: Book }) {
  const indexing = book.indexedPages < book.pageCount
  const catalogSize = useLiveQuery(() => db.catalog.where('bookId').equals(book.id).count(), [book.id])
  const status = indexing
    ? `reading pages ${Math.round((book.indexedPages / book.pageCount) * 100)}%`
    : book.extractedVersion !== EXTRACTOR_VERSION
      ? 'finding rules items…'
      : `${catalogSize ?? 0} rules items found`
  const codeTaken = useLiveQuery(
    () =>
      db.books
        .where('code')
        .equals(book.code)
        .count()
        .then((n) => book.code !== '' && n > 1),
    [book.code],
  )

  return (
    <li className="card grid gap-3 p-4 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
      <label className="block">
        <span className="mb-1 block text-[11px] text-muted">Code</span>
        <DraftInput
          className={`input w-full uppercase ${!book.code || codeTaken ? 'border-danger' : ''}`}
          list="known-book-codes"
          value={book.code}
          placeholder="CRB"
          title={codeTaken ? 'Another book uses this code' : 'Used in page references, e.g. CRB 245'}
          onCommit={(value) => void updateBook(book.id, { code: value.toUpperCase().trim() })}
        />
        <datalist id="known-book-codes">
          {KNOWN_BOOKS.map((k) => (
            <option key={k.code} value={k.code}>
              {k.title}
            </option>
          ))}
        </datalist>
      </label>
      <div className="min-w-0">
        <DraftInput
          className="input w-full font-semibold"
          value={book.title}
          onCommit={(title) => void updateBook(book.id, { title: title.trim() || book.fileName })}
          aria-label="Title"
        />
        <div className="mt-1 truncate text-xs text-muted" title={book.fileName}>
          {book.fileName} · {book.pageCount} pages · {(book.size / 1024 / 1024).toFixed(0)} MB
        </div>
        <div
          className={`mt-0.5 text-xs ${indexing || book.extractedVersion !== EXTRACTOR_VERSION ? 'text-muted' : 'text-accent'}`}
        >
          {status}
        </div>
        <BookDriveStatus book={book} />
      </div>
      <div className="flex gap-2">
        <Link className="btn" to={`/book/${book.id}`}>
          Open
        </Link>
        <button
          className="btn hover:border-danger hover:text-danger"
          onClick={() => {
            const where = book.driveFileId ? ' The copy in your Google Drive is kept.' : ''
            if (
              confirm(`Remove "${book.title}" from this device? The PDF file on your computer is not affected.${where}`)
            ) {
              void deleteBook(book.id)
            }
          }}
        >
          Remove
        </button>
      </div>
    </li>
  )
}

function SearchPanel() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchBooks(query).then((h) => !cancelled && setHits(h))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  return (
    <section>
      <input
        {...noAutofill}
        type="search"
        className="input w-full py-2 text-base"
        placeholder="Search all books, e.g. Ares Predator, Analytical Mind…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {hits && query.trim().length >= 2 && (
        <ul className="mt-2 grid gap-1">
          {hits.length === 0 && <li className="px-1 text-sm text-muted">No matches.</li>}
          {hits.map((hit) => (
            <li key={`${hit.book.id}-${hit.page}`}>
              <Link
                to={`/book/${hit.book.id}?pdf=${hit.page}`}
                className="block rounded px-3 py-2 text-sm hover:bg-surface"
              >
                <span className="mr-2 font-semibold text-accent">
                  {hit.book.code || hit.book.title} {pdfPageToPrinted(hit.book, hit.page)}
                </span>
                <Highlighted text={hit.snippet} query={query} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (index === -1) return <span className="text-muted">{text}</span>
  const end = index + query.trim().length
  return (
    <span className="text-muted">
      {text.slice(0, index)}
      <mark className="rounded-sm bg-accent/25 px-0.5 text-fg">{text.slice(index, end)}</mark>
      {text.slice(end)}
    </span>
  )
}

/** Text input that edits locally and saves on blur or Enter, so typing isn't slowed by storage round-trips. */
function DraftInput({
  value,
  onCommit,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft)
    setDraft(null)
  }
  return (
    <input
      {...noAutofill}
      {...props}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`

/** Upload button or "in Drive" note for one book, when Drive sync is connected. */
function BookDriveStatus({ book }: { book: Book }) {
  const cloud = useCloud()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (cloud.status === 'off' || cloud.status === 'disconnected') return null
  if (book.driveFileId) {
    return (
      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
        <Cloud className="size-3.5 text-accent" /> Saved in your Google Drive
      </div>
    )
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      <button
        className="btn px-2 py-1 text-xs"
        disabled={progress !== null}
        onClick={() => {
          setError(null)
          setProgress(0)
          uploadBookToDrive(book, setProgress)
            .catch((e) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setProgress(null))
        }}
      >
        <CloudUpload className="size-3.5" />
        {progress === null ? 'Save to Google Drive' : `Uploading ${percent(progress)}`}
      </button>
      {error && <span className="text-danger">{error}</span>}
    </div>
  )
}

/** Books saved in the user's Drive from another device, ready to download here. */
function DriveBooksPanel() {
  const cloud = useCloud()
  const [remote, setRemote] = useState<RemoteBook[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const connected = cloud.status !== 'off' && cloud.status !== 'disconnected'
  const localCount = useLiveQuery(() => db.books.count())

  const load = () => {
    setError(null)
    remoteBooks().then(setRemote, (e) => setError(e instanceof Error ? e.message : String(e)))
  }

  // Look automatically while the sign-in is fresh; otherwise wait for a click.
  useEffect(() => {
    if (connected && cloud.status === 'idle') load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, cloud.status === 'idle', localCount])

  if (!connected) return null
  const missing = remote?.filter((r) => !r.local) ?? []

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="mr-auto flex items-center gap-1.5 font-display text-sm tracking-widest text-accent uppercase">
          <Cloud className="size-4" /> Books in your Google Drive
        </h2>
        <button className="btn px-2 py-1 text-xs" onClick={load}>
          Check again
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {remote === null && !error && <p className="text-sm text-muted">Looking in your Drive…</p>}
      {remote && remote.length === 0 && (
        <p className="text-sm text-muted">
          No books saved yet. Use "Save to Google Drive" on a book above to use it on your other devices.
        </p>
      )}
      {remote && remote.length > 0 && missing.length === 0 && (
        <p className="text-sm text-muted">All {remote.length} books in your Drive are on this device.</p>
      )}
      {missing.length > 0 && (
        <ul className="grid gap-2">
          {missing.map((r) => {
            const p = progress[r.file.id]
            return (
              <li
                key={r.file.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-bg/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.title}</div>
                  <div className="truncate text-xs text-muted">
                    {r.code && `${r.code} · `}
                    {r.file.size ? `${Math.round(r.file.size / 1024 / 1024)} MB` : ''}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={p !== undefined}
                  onClick={() => {
                    setProgress((all) => ({ ...all, [r.file.id]: 0 }))
                    downloadRemoteBook(r, (f) => setProgress((all) => ({ ...all, [r.file.id]: f })))
                      .then(load, (e) => setError(e instanceof Error ? e.message : String(e)))
                      .finally(() =>
                        setProgress((all) => {
                          const next = { ...all }
                          delete next[r.file.id]
                          return next
                        }),
                      )
                  }}
                >
                  <CloudDownload className="size-4" />
                  {p === undefined ? 'Download to this device' : `Downloading ${percent(p)}`}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
