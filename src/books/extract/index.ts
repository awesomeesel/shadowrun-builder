import type { PageLayout } from '../layout'
import { extractProse } from './prose'
import { extractTables } from './tables'
import type { ExtractedEntry } from './types'

/** Bump when extraction improves so stored catalogs are rebuilt from the saved page layouts. */
export const EXTRACTOR_VERSION = 5

/** Everything the app can recognise in a book: gear tables plus qualities, powers, spells and forms. */
export function extractBook(pages: PageLayout[]): ExtractedEntry[] {
  const entries = [...pages.flatMap((page, i) => extractTables(page, i + 1)), ...extractProse(pages)]
  // Books reprint some tables (e.g. commlinks in both the Matrix and gear chapters); keep the first copy.
  const seen = new Set<string>()
  return entries.filter((e) => {
    const { page: _page, category: _category, ...stats } = e
    const key = JSON.stringify({ ...stats, name: e.name.toLowerCase() })
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type { ExtractedEntry, EntryKind } from './types'
