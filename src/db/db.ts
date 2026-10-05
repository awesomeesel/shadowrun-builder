import Dexie, { type EntityTable } from 'dexie'
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

export const db = new Dexie('shadowrun-builder') as Dexie & {
  characters: EntityTable<Character, 'id'>
  books: EntityTable<Book, 'id'>
  bookFiles: EntityTable<BookFile, 'id'>
  bookText: Dexie.Table<BookPageText, [string, number]>
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
