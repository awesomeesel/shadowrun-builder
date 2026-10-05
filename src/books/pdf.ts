import type { PDFDocumentProxy } from 'pdfjs-dist'
import { db } from '../db/db'
import type { PageLayout, PdfItem } from './layout'

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

/** Positioned text of a page, for rebuilding lines, columns and tables. */
export async function pageLayout(doc: PDFDocumentProxy, pageNumber: number): Promise<PageLayout> {
  const page = await doc.getPage(pageNumber)
  const { width } = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  page.cleanup()
  const round = (n: number) => Math.round(n * 10) / 10
  const items: PdfItem[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    items.push([round(item.transform[4]), round(item.transform[5]), round(item.height), item.str, round(item.width)])
  }
  return { width, items }
}
