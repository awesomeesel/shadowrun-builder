import { guessBook } from '../books/catalog'
import { EXTRACTOR_VERSION, extractBook } from '../books/extract'
import { pageText } from '../books/layout'
import { closeBook, destroyPdf, openBook, openPdf, pageLayout } from '../books/pdf'
import { db, type Book, type BookPageLayout, type BookPageText, type CatalogEntry } from './db'

/** Store a PDF in the library and start indexing its text in the background. */
export async function addBook(file: File): Promise<Book> {
  const doc = await openPdf(file)
  let pdfTitle = ''
  try {
    const { info } = await doc.getMetadata()
    pdfTitle = String((info as { Title?: unknown }).Title ?? '')
  } catch {
    // Missing metadata is fine; fall back to the file name.
  }
  const pageLabels = await doc.getPageLabels().catch(() => null)
  const known = guessBook(file.name, pdfTitle)

  const book: Book = {
    id: crypto.randomUUID(),
    code: known?.code ?? '',
    title: known?.title ?? (pdfTitle || file.name.replace(/\.pdf$/i, '')),
    fileName: file.name,
    size: file.size,
    addedAt: new Date().toISOString(),
    pageCount: doc.numPages,
    pageLabels,
    pageOffset: 0,
    indexedPages: 0,
    extractedVersion: 0,
  }
  await destroyPdf(doc)

  // Ask the browser not to evict large files under storage pressure.
  await navigator.storage?.persist?.().catch(() => false)

  await db.transaction('rw', db.books, db.bookFiles, async () => {
    await db.books.add(book)
    await db.bookFiles.add({ id: book.id, blob: file })
  })
  void indexBook(book.id)
  return book
}

export async function updateBook(id: string, changes: Partial<Pick<Book, 'code' | 'title' | 'pageOffset'>>) {
  await db.books.update(id, changes)
}

export async function deleteBook(id: string) {
  indexing.delete(id)
  closeBook(id)
  await db.transaction('rw', [db.books, db.bookFiles, db.bookText, db.bookPages, db.catalog], async () => {
    await db.books.delete(id)
    await db.bookFiles.delete(id)
    await db.bookText.where('bookId').equals(id).delete()
    await db.bookPages.where('bookId').equals(id).delete()
    await db.catalog.where('bookId').equals(id).delete()
  })
}

const indexing = new Set<string>()

/**
 * Read every page's positioned text (for search and the catalog), resuming
 * where a previous run stopped, then build the catalog of rules items.
 */
export async function indexBook(id: string) {
  if (indexing.has(id)) return
  indexing.add(id)
  try {
    const book = await db.books.get(id)
    if (!book) return
    if (book.indexedPages < book.pageCount) {
      const doc = await openBook(id)
      const BATCH = 10
      for (let start = book.indexedPages + 1; start <= book.pageCount; start += BATCH) {
        if (!indexing.has(id)) return // book was deleted
        const layouts: BookPageLayout[] = []
        const texts: BookPageText[] = []
        for (let page = start; page < start + BATCH && page <= book.pageCount; page++) {
          const layout = await pageLayout(doc, page)
          layouts.push({ bookId: id, page, ...layout })
          texts.push({ bookId: id, page, text: pageText(layout) })
        }
        await db.transaction('rw', db.books, db.bookText, db.bookPages, async () => {
          if (!(await db.books.get(id))) return
          await db.bookPages.bulkPut(layouts)
          await db.bookText.bulkPut(texts)
          await db.books.update(id, { indexedPages: layouts[layouts.length - 1].page })
        })
      }
    }
    await buildCatalog(id)
  } finally {
    indexing.delete(id)
  }
}

/** Recognise weapons, gear, qualities, spells and more in a fully indexed book. */
export async function buildCatalog(id: string) {
  const book = await db.books.get(id)
  if (!book || book.indexedPages < book.pageCount || book.extractedVersion === EXTRACTOR_VERSION) return
  const pages = await db.bookPages.where('bookId').equals(id).sortBy('page')
  const entries: CatalogEntry[] = extractBook(pages).map((entry, i) => ({ ...entry, id: `${id}:${i}`, bookId: id }))
  await db.transaction('rw', db.books, db.catalog, async () => {
    if (!(await db.books.get(id))) return
    await db.catalog.where('bookId').equals(id).delete()
    await db.catalog.bulkPut(entries)
    await db.books.update(id, { extractedVersion: EXTRACTOR_VERSION })
  })
}

/** Finish indexing or rebuild catalogs for books left incomplete or built by an older extractor. */
export async function resumeIndexing() {
  const books = await db.books.toArray()
  for (const book of books) {
    if (book.indexedPages < book.pageCount || book.extractedVersion !== EXTRACTOR_VERSION) await indexBook(book.id)
  }
}

export interface SearchHit {
  book: Book
  page: number
  snippet: string
}

/** Case-insensitive text search across all indexed books. */
export async function searchBooks(query: string, limit = 50): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  const books = new Map((await db.books.toArray()).map((b) => [b.id, b]))
  const hits: SearchHit[] = []
  await db.bookText.each((row) => {
    if (hits.length >= limit) return
    const index = row.text.toLowerCase().indexOf(needle)
    const book = books.get(row.bookId)
    if (index === -1 || !book) return
    const start = Math.max(0, index - 60)
    const end = Math.min(row.text.length, index + needle.length + 80)
    const snippet = (start > 0 ? '…' : '') + row.text.slice(start, end).replace(/\s+/g, ' ') + (end < row.text.length ? '…' : '')
    hits.push({ book, page: row.page, snippet })
  })
  return hits
}

/** Find the library book a reference points to, by code or title. */
export function findBook(books: Book[], ref: string): Book | undefined {
  const wanted = ref.trim().toLowerCase()
  return (
    books.find((b) => b.code.toLowerCase() === wanted) ?? books.find((b) => b.title.toLowerCase() === wanted)
  )
}
