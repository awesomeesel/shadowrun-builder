import Dexie, { type EntityTable } from 'dexie'
import type { ExtractedEntry } from '../books/extract'
import type { PageLayout } from '../books/layout'
import type { PageMapping } from '../books/pages'
import type { Character } from '../model/character'

/** A rulebook PDF the user added. The file itself lives in `bookFiles`. */
export interface Book extends PageMapping {
  id: string
  /** Code used in page references, e.g. 'CRB'. */
  code: string
  title: string
  fileName: string
  size: number
  addedAt: string
  /** Pages whose text has been extracted for search; equals pageCount when done. */
  indexedPages: number
  /** EXTRACTOR_VERSION the catalog was last built with; 0 = not built. */
  extractedVersion?: number
}

export interface BookFile {
  id: string
  blob: Blob
}

export interface BookPageText {
  bookId: string
  /** 1-based PDF page. */
  page: number
  text: string
}

/** Positioned text of one page, kept so the catalog can be rebuilt without re-reading the PDF. */
export interface BookPageLayout extends PageLayout {
  bookId: string
  /** 1-based PDF page. */
  page: number
}

/** A rules item recognised in one of the user's books. */
export type CatalogEntry = ExtractedEntry & { id: string; bookId: string }

export const db = new Dexie('shadowrun-builder') as Dexie & {
  characters: EntityTable<Character, 'id'>
  books: EntityTable<Book, 'id'>
  bookFiles: EntityTable<BookFile, 'id'>
  bookText: Dexie.Table<BookPageText, [string, number]>
  bookPages: Dexie.Table<BookPageLayout, [string, number]>
  catalog: EntityTable<CatalogEntry, 'id'>
}

db.version(1).stores({
  characters: 'id, name, updatedAt',
})

// Book metadata and file blobs are separate tables so listing books doesn't load whole PDFs.
db.version(2).stores({
  books: 'id, code',
  bookFiles: 'id',
  bookText: '[bookId+page], bookId',
})

// Version 3 keeps text positions so tables and columns can be read; existing books are re-indexed.
db.version(3)
  .stores({
    bookPages: '[bookId+page], bookId',
    catalog: 'id, bookId, kind, name',
  })
  .upgrade(async (tx) => {
    await tx.table('bookText').clear()
    await tx
      .table('books')
      .toCollection()
      .modify((book: Book) => {
        book.indexedPages = 0
        book.extractedVersion = 0
      })
  })
