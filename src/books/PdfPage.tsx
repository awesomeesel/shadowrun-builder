import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { openBook } from './pdf'

/** One page of a book in the library, drawn at the given width (times zoom). */
export function PdfPage({
  bookId,
  page,
  width,
  zoom = 1,
}: {
  bookId: string
  page: number
  width: number
  zoom?: number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')

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
    const el = canvas.current
    if (!doc || !el || width <= 0) return
    let task: RenderTask | undefined
    let cancelled = false
    void doc.getPage(Math.min(Math.max(1, page), doc.numPages)).then((p) => {
      if (cancelled) return
      const ratio = window.devicePixelRatio || 1
      const scale = (width / p.getViewport({ scale: 1 }).width) * zoom
      const viewport = p.getViewport({ scale: scale * ratio })
      el.width = viewport.width
      el.height = viewport.height
      el.style.width = `${viewport.width / ratio}px`
      el.style.height = `${viewport.height / ratio}px`
      task = p.render({ canvas: el, viewport })
      task.promise.catch(() => {}) // cancelled renders reject
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, width, zoom])

  if (error) return <p className="p-4 text-sm text-danger">{error}</p>
  return <canvas ref={canvas} className="block bg-white" />
}
