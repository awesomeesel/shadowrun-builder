/**
 * Splits a book into sections at its headings, for search. Each section knows
 * its heading trail ("Statuses › Status List › Burning") and keeps its text in
 * paragraphs, so a search result can say where it is and be read in place.
 */
import { bodyHeight, contentItems, readingOrder, type Line, type PageLayout } from './layout'

export interface BookSection {
  /** 1-based PDF page where the section starts. */
  page: number
  /** Headings above it, outermost first, ending with its own. */
  path: string[]
  /** Paragraphs. */
  text: string[]
}

/** Headings are set at least this much larger than body text. */
const HEADING_EXTRA = 1.2

function isHeading(line: Line, body: number): boolean {
  const words = line.text.split(' ').length
  return (
    line.h >= body + HEADING_EXTRA &&
    line.text.length <= 60 &&
    words <= 9 &&
    /[a-z]/i.test(line.text) &&
    // Larger-type sentences (pull quotes, opening lines) aren't headings: they end in
    // punctuation or carry on after a comma ("the violence, so now").
    !/[.,:;-]$|\. |, [a-z]/.test(line.text) &&
    !/^notes?:/i.test(line.text) &&
    // A line that stops on "the", "to", "its"… is a sentence running on, not a heading.
    !/\b(the|a|an|to|of|and|with|its|is|are|was|that|for|in|on|or|but|as|by|be|it|through|from|into|at|when|if|than|who|which|their|his|her|your|our|they|we|you)$/i.test(
      line.text,
    ) &&
    !(/^[a-z]/.test(line.text) && words >= 8) &&
    !/^\d/.test(line.text) &&
    // Running heads like "// WARMTH OF THE MOUNTAINS //".
    !line.text.startsWith('//')
  )
}

/** Contents and index pages list topics with page numbers; they'd match everything. */
function isListingPage(lines: Line[]): boolean {
  const dotted = lines.filter((l) => /\.{4,}\s*\d+$/.test(l.text)).length
  const numbered = lines.filter((l) => /,\s*\d+(\s*[–-]\s*\d+)?$/.test(l.text)).length
  return dotted >= 4 || (lines.length > 20 && numbered / lines.length > 0.4)
}

/** Front matter (cover, credits, contents) sits in the first pages. */
const FRONT_PAGES = 4

export function extractSections(pages: PageLayout[]): BookSection[] {
  const sections: BookSection[] = []
  // The heading trail, with each heading's size: a heading closes those of its size or smaller.
  const trail: { h: number; text: string }[] = []
  let current: BookSection | null = null
  let lastHeading: { line: Line; page: number } | null = null
  let paragraph = ''
  let previous: Line | null = null

  const endParagraph = () => {
    if (current && paragraph.trim()) current.text.push(paragraph.trim())
    paragraph = ''
  }

  pages.forEach((page, index) => {
    const pageNumber = index + 1
    if (pageNumber <= FRONT_PAGES) return
    const lines = readingOrder(page)
    if (isListingPage(lines)) return
    const body = bodyHeight(contentItems(page))
    previous = null
    for (const line of lines) {
      if (isHeading(line, body)) {
        // A heading wrapped onto a second line straight below, in the same size.
        const wraps =
          current &&
          current.text.length === 0 &&
          !paragraph &&
          lastHeading?.page === pageNumber &&
          Math.abs(lastHeading.line.h - line.h) < 0.5 &&
          lastHeading.line.y - line.y > 0 &&
          lastHeading.line.y - line.y <= line.h * 1.6
        if (wraps && current && `${current.path[current.path.length - 1]} ${line.text}`.length <= 70) {
          const last = current.path.length - 1
          current.path[last] = `${current.path[last]} ${line.text}`
          trail[trail.length - 1].text = current.path[last]
          lastHeading = { line, page: pageNumber }
          continue
        }
        endParagraph()
        while (trail.length && trail[trail.length - 1].h <= line.h + 0.5) trail.pop()
        // "Burning #": the # stands for the status's number.
        trail.push({ h: line.h, text: line.text.replace(/\s+#$/, '') })
        current = { page: pageNumber, path: trail.map((t) => t.text), text: [] }
        sections.push(current)
        lastHeading = { line, page: pageNumber }
        previous = null
        continue
      }
      if (!current) continue
      // A new paragraph after a gap, a bullet, or a new column.
      const prev: Line | null = previous
      const gap = prev ? prev.y - line.y : 0
      if (prev && (gap > line.h * 1.7 || gap < 0 || /^[•●▪]/.test(line.text))) endParagraph()
      // Words split over two lines: "in-" + "clude".
      if (paragraph.endsWith('-') && /^[a-z]/.test(line.text)) paragraph = paragraph.slice(0, -1) + line.text
      else paragraph += (paragraph ? ' ' : '') + line.text
      previous = line
    }
    endParagraph()
  })
  return sections.filter((s) => s.text.length > 0)
}
