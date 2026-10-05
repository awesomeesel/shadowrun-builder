import { useLiveQuery } from 'dexie-react-hooks'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { pdfPageToPrinted, printedToPdfPage } from '../books/pages'
import { openBook } from '../books/pdf'
import { updateBook } from '../db/books'
import { db } from '../db/db'

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

/**
 * Shows one page of a stored rulebook. The URL takes either `?page=` (printed
 * page number, as used in references) or `?pdf=` (1-based PDF page).
 */
export function BookViewer() {
  const { bookId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const book = useLiveQuery(() => db.books.get(bookId), [bookId], null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const pdfPage = book
    ? params.has('pdf')
      ? clampPage(Number(params.get('pdf')), book.pageCount)
      : params.has('page')
        ? printedToPdfPage(book, Number(params.get('page')))
        : 1
    : 1

  useEffect(() => {
    let cancelled = false
    openBook(bookId)
      .then((d) => !cancelled && setDoc(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [bookId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!doc || !canvas || containerWidth === 0) return
    let task: RenderTask | undefined
    let cancelled = false
    void doc.getPage(pdfPage).then((page) => {
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      const scale = (Math.min(containerWidth, 900) / base.width) * zoom
      const ratio = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: scale * ratio })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / ratio}px`
      canvas.style.height = `${viewport.height / ratio}px`
      task = page.render({ canvas, viewport })
      task.promise.catch(() => {}) // cancelled renders reject
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pdfPage, zoom, containerWidth])

  const goTo = (page: number) => {
    if (book) setParams({ pdf: String(clampPage(page, book.pageCount)) }, { replace: true })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') goTo(pdfPage + 1)
      if (e.key === 'ArrowLeft') goTo(pdfPage - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (book === undefined) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">This book is not in your library.</p>
        <Link to="/library" className="btn">
          Open library
        </Link>
      </div>
    )
  }

  const usesLabels = !!book?.pageLabels?.some((l) => /^\d+$/.test(l))

  function calibrate() {
    if (!book) return
    const answer = prompt('Which page number is printed on this page?')
    const printed = parseInt(answer ?? '', 10)
    if (!Number.isNaN(printed)) void updateBook(book.id, { pageOffset: pdfPage - printed })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-6">
        <button
          className="px-1 text-muted hover:text-fg"
          aria-label="Back"
          onClick={() => (history.length > 1 ? navigate(-1) : navigate('/library'))}
        >
          ←
        </button>
        <h1 className="mr-auto min-w-0 truncate text-sm font-semibold">
          {book ? `${book.code ? book.code + ' · ' : ''}${book.title}` : ''}
        </h1>
        {book && (
          <div className="flex items-center gap-1 text-sm">
            <button className="btn px-2" onClick={() => goTo(pdfPage - 1)} disabled={pdfPage <= 1} aria-label="Previous page">
              ‹
            </button>
            <PageInput
              key={pdfPage}
              label={pdfPageToPrinted(book, pdfPage)}
              onSubmit={(printed) => setParams({ page: String(printed) }, { replace: true })}
            />
            <button
              className="btn px-2"
              onClick={() => goTo(pdfPage + 1)}
              disabled={pdfPage >= book.pageCount}
              aria-label="Next page"
            >
              ›
            </button>
            <span className="ml-1 hidden text-xs text-muted sm:inline">
              PDF {pdfPage}/{book.pageCount}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button className="btn px-2" onClick={() => setZoom(stepZoom(zoom, -1))} aria-label="Zoom out">
            −
          </button>
          <span className="w-10 text-center text-xs text-muted">{Math.round(zoom * 100)}%</span>
          <button className="btn px-2" onClick={() => setZoom(stepZoom(zoom, 1))} aria-label="Zoom in">
            +
          </button>
        </div>
        {book && !usesLabels && (
          <button className="btn text-xs" onClick={calibrate} title="Make page references match this PDF">
            Set page number
          </button>
        )}
      </header>

      <div ref={containerRef} className="flex-1 overflow-auto bg-black/30 p-2 sm:p-4">
        {error ? (
          <p className="p-8 text-center text-danger">Could not open the PDF: {error}</p>
        ) : (
          <canvas ref={canvasRef} className="mx-auto block bg-white shadow-lg" />
        )}
      </div>
    </div>
  )
}

function PageInput({ label, onSubmit }: { label: string; onSubmit: (printed: number) => void }) {
  const [value, setValue] = useState(label)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const printed = parseInt(value, 10)
        if (!Number.isNaN(printed)) onSubmit(printed)
      }}
    >
      <input
        className="input w-16 py-1 text-center"
        aria-label="Page"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
    </form>
  )
}

function clampPage(page: number, pageCount: number) {
  return Number.isFinite(page) ? Math.min(pageCount, Math.max(1, Math.round(page))) : 1
}

function stepZoom(current: number, direction: 1 | -1) {
  const index = ZOOM_STEPS.indexOf(current)
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))]
}
