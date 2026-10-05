import { guessBook } from '../books/catalog'
import { closeBook, destroyPdf, openBook, openPdf, pageText } from '../books/pdf'
import { db, type Book, type BookPageText } from './db'

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
  await db.transaction('rw', db.books, db.bookFiles, db.bookText, async () => {
    await db.books.delete(id)
    await db.bookFiles.delete(id)
    await db.bookText.where('bookId').equals(id).delete()
  })
}

const indexing = new Set<string>()

/** Extract text page by page for search, resuming where a previous run stopped. */
export async function indexBook(id: string) {
  if (indexing.has(id)) return
  indexing.add(id)
  try {
    const book = await db.books.get(id)
    if (!book || book.indexedPages >= book.pageCount) return
    const doc = await openBook(id)
    const BATCH = 10
    for (let start = book.indexedPages + 1; start <= book.pageCount; start += BATCH) {
      if (!indexing.has(id)) return // book was deleted
      const pages: BookPageText[] = []
      for (let page = start; page < start + BATCH && page <= book.pageCount; page++) {
        pages.push({ bookId: id, page, text: await pageText(doc, page) })
      }
      await db.transaction('rw', db.books, db.bookText, async () => {
        if (!(await db.books.get(id))) return
        await db.bookText.bulkPut(pages)
        await db.books.update(id, { indexedPages: pages[pages.length - 1].page })
      })
    }
  } finally {
    indexing.delete(id)
  }
}

/** Resume indexing for any books that were interrupted (e.g. the tab was closed). */
export async function resumeIndexing() {
  const books = await db.books.toArray()
  for (const book of books) {
    if (book.indexedPages < book.pageCount) await indexBook(book.id)
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
