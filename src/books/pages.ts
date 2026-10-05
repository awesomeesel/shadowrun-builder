import type { SourceRef } from '../model/character'

/** What's needed to translate between printed page numbers and PDF page indexes. */
export interface PageMapping {
  pageCount: number
  /** Page labels embedded in the PDF, if any (index 0 = PDF page 1). */
  pageLabels: string[] | null
  /** PDF page = printed page + offset. Used when the PDF has no usable labels. */
  pageOffset: number
}

/** True when the PDF's own labels are plain printed page numbers we can rely on. */
function hasNumericLabels(mapping: PageMapping): mapping is PageMapping & { pageLabels: string[] } {
  return !!mapping.pageLabels && mapping.pageLabels.some((label) => /^\d+$/.test(label))
}

/** 1-based PDF page for a printed page number, clamped to the document. */
export function printedToPdfPage(mapping: PageMapping, printed: number): number {
  if (hasNumericLabels(mapping)) {
    const index = mapping.pageLabels.indexOf(String(printed))
    if (index !== -1) return index + 1
  }
  return clamp(printed + mapping.pageOffset, 1, mapping.pageCount)
}

/** Printed page label for a 1-based PDF page, e.g. '245' or 'iv'. */
export function pdfPageToPrinted(mapping: PageMapping, pdfPage: number): string {
  if (hasNumericLabels(mapping)) return mapping.pageLabels[pdfPage - 1] ?? String(pdfPage)
  const printed = pdfPage - mapping.pageOffset
  return printed >= 1 ? String(printed) : `PDF ${pdfPage}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Parse "CRB 245", "crb p. 245", "SW245" or "Street Wyrd 12" style references. */
export function parseSourceRef(text: string): SourceRef | undefined {
  const match = text.trim().match(/^(.*?)[\s,]*(?:p(?:age|g)?\.?\s*)?(\d+)$/i)
  if (!match) return undefined
  const book = match[1].trim().toUpperCase()
  const page = parseInt(match[2], 10)
  if (!book || page < 1) return undefined
  return { book, page }
}

export function formatSourceRef(ref: SourceRef): string {
  return `${ref.book} ${ref.page}`
}
