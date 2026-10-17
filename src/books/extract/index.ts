import type { PageLayout } from '../layout'
import { extractNpcs } from './npc'
import { extractProse } from './prose'
import { extractTables } from './tables'
import type { ExtractedEntry } from './types'

/** Bump when extraction improves so stored catalogs are rebuilt from the saved page layouts. */
export const EXTRACTOR_VERSION = 8

/** Everything the app can recognise in a book: gear tables, qualities, powers, spells, forms and NPC stat blocks. */
export function extractBook(pages: PageLayout[]): ExtractedEntry[] {
  const entries = [
    ...pages.flatMap((page, i) => extractTables(page, i + 1)),
    ...extractProse(pages),
    ...extractNpcs(pages),
  ]
  // Books reprint some tables (e.g. commlinks in both the Matrix and gear chapters), sometimes with
  // small differences; keep the first copy so the picker doesn't show the same item twice.
  const seen = new Set<string>()
  return entries.filter((e) => {
    const key = `${e.kind}|${e.category.toLowerCase()}|${e.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type { ExtractedEntry, EntryKind } from './types'
