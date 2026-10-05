import type { PDFDocumentProxy } from 'pdfjs-dist'
import { db } from '../db/db'

type PdfJs = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<PdfJs> | undefined

/** Load pdf.js on first use so it isn't part of the main bundle. */
export function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })
  return pdfjsPromise
}

// pdf.js tears documents down through their loading task, so remember which task made each one.
const loadingTasks = new WeakMap<PDFDocumentProxy, { destroy(): Promise<void> }>()

export async function openPdf(data: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs()
  const task = pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) })
  const doc = await task.promise
  loadingTasks.set(doc, task)
  return doc
}

/** Free a document's worker and memory. */
export async function destroyPdf(doc: PDFDocumentProxy): Promise<void> {
  await loadingTasks.get(doc)?.destroy()
}

const openDocuments = new Map<string, Promise<PDFDocumentProxy>>()

/** Open a stored book, reusing the parsed document while the app is running. */
export function openBook(bookId: string): Promise<PDFDocumentProxy> {
  let doc = openDocuments.get(bookId)
  if (!doc) {
    doc = db.bookFiles.get(bookId).then((file) => {
      if (!file) throw new Error('Book file not found')
      return openPdf(file.blob)
    })
    doc.catch(() => openDocuments.delete(bookId))
    openDocuments.set(bookId, doc)
  }
  return doc
}

export function closeBook(bookId: string) {
  const doc = openDocuments.get(bookId)
  openDocuments.delete(bookId)
  void doc?.then(destroyPdf).catch(() => {})
}

export async function pageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  page.cleanup()
  return content.items
    .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
    .join('')
    .replace(/[ \t]+/g, ' ')
}
