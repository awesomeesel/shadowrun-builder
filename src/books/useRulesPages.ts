import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Book } from '../db/db'
import { findRulesPages, type RulesTopic } from './rulesPages'

export type RulesPages = Partial<Record<RulesTopic, { book: Book; page: number }>>

// Finding headings reads every page's text, so remember the result per fully indexed book.
const cache = new Map<string, Record<RulesTopic, number | null>>()

async function pagesFor(book: Book) {
  const cached = cache.get(book.id)
  if (cached) return cached
  const texts = await db.bookText.where('bookId').equals(book.id).toArray()
  const result = findRulesPages(texts)
  if (book.indexedPages >= book.pageCount) cache.set(book.id, result)
  return result
}

/** Where each character creation topic is explained in the user's books, preferring the Core Rulebook. */
export function useRulesPages(): RulesPages {
  return (
    useLiveQuery(async () => {
      const books = (await db.books.toArray()).sort((a, b) => Number(b.code === 'CRB') - Number(a.code === 'CRB'))
      const result: RulesPages = {}
      for (const book of books) {
        const pages = await pagesFor(book)
        for (const [topic, page] of Object.entries(pages) as [RulesTopic, number | null][]) {
          if (page !== null && !result[topic]) result[topic] = { book, page }
        }
      }
      return result
    }) ?? {}
  )
}
