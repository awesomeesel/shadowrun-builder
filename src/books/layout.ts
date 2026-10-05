/**
 * Rebuilds lines, columns and reading order from positioned PDF text.
 *
 * PDF text comes out as loose fragments with coordinates. Rulebooks use two
 * text columns plus full-width tables, so plain extraction interleaves the
 * columns. These helpers put the fragments back together.
 */

/** One text fragment: [x, y, height, text, width]. y grows upwards, as in PDF space. */
export type PdfItem = [x: number, y: number, h: number, s: string, w: number]

export interface PageLayout {
  width: number
  items: PdfItem[]
}

export interface Line {
  y: number
  /** Tallest fragment in the line; headings are taller than body text. */
  h: number
  items: PdfItem[]
  text: string
}

/** Fragments closer than this vertically belong to the same line. */
const LINE_TOLERANCE = 2.5
/** Lines below this y are page footers (chapter names, page numbers). */
export const FOOTER_Y = 30
/** Page margins hold page numbers and the vertical book title. */
const MARGIN = 45

/** Fragments in the page body: no footer, no margin decorations. */
export function contentItems(page: PageLayout): PdfItem[] {
  return page.items.filter((i) => i[1] > FOOTER_Y && i[0] > MARGIN && i[0] < page.width - MARGIN)
}

export function makeLine(items: PdfItem[]): Line {
  const sorted = [...items].sort((a, b) => a[0] - b[0])
  return {
    y: Math.max(...sorted.map((i) => i[1])),
    h: Math.max(...sorted.map((i) => i[2])),
    items: sorted,
    text: joinText(sorted),
  }
}

/** Fragments that touch are one word split by kerning ("Hea" + "vy"); others get a space. */
function joinText(items: PdfItem[]): string {
  let text = ''
  for (let i = 0; i < items.length; i++) {
    const prev = items[i - 1]
    const touching = prev && items[i][0] - (prev[0] + prev[4]) < 0.8
    text += (i > 0 && !touching ? ' ' : '') + items[i][3]
  }
  return text.replace(/\s+/g, ' ').trim()
}

/** Group fragments into lines, top of the page first. */
export function groupLines(items: PdfItem[]): Line[] {
  const sorted = items.filter((i) => i[3].trim()).sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const groups: PdfItem[][] = []
  let current: PdfItem[] = []
  let currentY = Infinity
  for (const item of sorted) {
    if (current.length && Math.abs(currentY - item[1]) > LINE_TOLERANCE) {
      groups.push(current)
      current = []
    }
    if (!current.length) currentY = item[1]
    current.push(item)
  }
  if (current.length) groups.push(current)
  return groups.map(makeLine)
}

/** Where the right text column starts. Left-column words never begin this far right. */
export function columnSplit(width: number): number {
  return width * 0.46
}

/**
 * Body text in reading order: the left column top to bottom, then the right
 * column. Footer lines are dropped.
 */
export function readingOrder(page: PageLayout): Line[] {
  const split = columnSplit(page.width)
  const body = contentItems(page)
  return [
    ...groupLines(body.filter((i) => i[0] < split)),
    ...groupLines(body.filter((i) => i[0] >= split)),
  ]
}

/** The most common fragment height on the page: the body text size. */
export function bodyHeight(items: PdfItem[]): number {
  const counts = new Map<number, number>()
  for (const [, , h, s] of items) {
    const key = Math.round(h)
    counts.set(key, (counts.get(key) ?? 0) + s.length)
  }
  let best = 0
  let bestCount = -1
  for (const [h, count] of counts) {
    if (count > bestCount) {
      best = h
      bestCount = count
    }
  }
  return best
}

/** Footer text like "CHARACTER CREATION // QUALITIES", used to know which chapter a page is in. */
export function pageFooter(page: PageLayout): string {
  return groupLines(page.items.filter((i) => i[1] <= FOOTER_Y))
    .map((l) => l.text)
    .filter((t) => t.includes('//'))
    .join(' ')
}

/** Plain text of a page in reading order, for search. */
export function pageText(page: PageLayout): string {
  return readingOrder(page)
    .map((l) => l.text)
    .join('\n')
}
