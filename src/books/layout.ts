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

/** Where the columns split when the page gives no clearer answer. */
const DEFAULT_SPLIT = 0.46

/**
 * The x position between the two text columns: the middle of the gap nearest
 * the page centre that the fewest text fragments cross (headings or tables
 * spanning both columns may cross it). Falls back to 46% of the width when
 * there is no clear gutter.
 */
export function columnSplit(page: PageLayout, items = contentItems(page)): number {
  const from = Math.floor(page.width * 0.38)
  const to = Math.ceil(page.width * 0.62)
  const crossings = new Uint16Array(to - from)
  for (const [x, , , , w] of items) {
    for (let px = Math.max(from, Math.floor(x)); px < Math.min(to, Math.ceil(x + w)); px++) crossings[px - from]++
  }
  const fewest = Math.min(...crossings)
  // Gaps between table columns can be wider than the gutter, so take the gap nearest the centre.
  const centre = page.width / 2
  let best: number | null = null
  let run = -1
  for (let i = 0; i <= crossings.length; i++) {
    if (i < crossings.length && crossings[i] === fewest) {
      if (run === -1) run = i
    } else if (run !== -1) {
      const middle = from + (run + i) / 2
      if (i - run >= 6 && (best === null || Math.abs(middle - centre) < Math.abs(best - centre))) best = middle
      run = -1
    }
  }
  // A real gutter is crossed by little text (headings or tables spanning both columns).
  const clear = best !== null && fewest <= Math.max(2, items.length * 0.03)
  return clear ? best! : page.width * DEFAULT_SPLIT
}

/**
 * Body text in reading order: the left column top to bottom, then the right
 * column. Footer lines are dropped.
 */
export function readingOrder(page: PageLayout): Line[] {
  const body = contentItems(page)
  const split = columnSplit(page, body)
  return [...groupLines(body.filter((i) => i[0] < split)), ...groupLines(body.filter((i) => i[0] >= split))]
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

/** Plain text of a page in reading order, for search. */
export function pageText(page: PageLayout): string {
  return readingOrder(page)
    .map((l) => l.text)
    .join('\n')
}
