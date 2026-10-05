/** Rulebook PDFs in the user's own Drive: upload from one device, download on another. */
import { addBook, updateBook } from '../db/books'
import { db, type Book } from '../db/db'
import type { Drive, DriveFile } from './drive'

export interface RemoteBook {
  file: DriveFile
  code: string
  title: string
  /** Already on this device. */
  local: Book | undefined
}

// Drive limits each appProperty (key + value) to 124 bytes.
const short = (text: string) => text.slice(0, 80)

export async function uploadBook(
  drive: Drive,
  folderId: string,
  book: Book,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const file = await db.bookFiles.get(book.id)
  if (!file) throw new Error(`The PDF for ${book.title} is missing on this device`)
  const uploaded = await drive.create(
    folderId,
    book.fileName,
    {
      app: 'shadowrun-builder',
      kind: 'book',
      code: short(book.code),
      title: short(book.title),
      pageOffset: String(book.pageOffset),
    },
    new Blob([file.blob], { type: 'application/pdf' }),
    onProgress,
  )
  await db.books.update(book.id, { driveFileId: uploaded.id })
}

export async function listRemoteBooks(drive: Drive, folderId: string): Promise<RemoteBook[]> {
  const books = await db.books.toArray()
  return (await drive.list(folderId))
    .filter((f) => f.appProperties.kind === 'book')
    .map((file) => ({
      file,
      code: file.appProperties.code ?? '',
      title: file.appProperties.title ?? file.name,
      // Match by Drive id, or by file name and size for books added separately on each device.
      local: books.find((b) => b.driveFileId === file.id || (b.fileName === file.name && b.size === file.size)),
    }))
}

/** Download a PDF from Drive and add it to the library here (it then gets indexed as usual). */
export async function downloadBook(
  drive: Drive,
  remote: RemoteBook,
  onProgress?: (fraction: number) => void,
): Promise<Book> {
  const blob = await drive.download(remote.file.id, onProgress)
  const book = await addBook(new File([blob], remote.file.name, { type: 'application/pdf' }))
  const pageOffset = Number(remote.file.appProperties.pageOffset) || 0
  await updateBook(book.id, { code: remote.code || book.code, title: remote.title || book.title, pageOffset })
  await db.books.update(book.id, { driveFileId: remote.file.id })
  return book
}
