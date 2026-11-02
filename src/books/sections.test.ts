// Fixtures are invented text laid out like rulebook pages. Never paste real book text here.
import { describe, expect, it } from 'vitest'
import type { PageLayout, PdfItem } from './layout'
import { extractSections } from './sections'

const t = (x: number, y: number, s: string, h = 10): PdfItem => [x, y, h, s, s.length * 4.5]
const page = (items: PdfItem[]): PageLayout => ({ width: 612, items })
const blank = page([t(60, 700, 'Front matter, never searched for.')])
const body = (y: number, s: string) => t(60, y, s)

describe('book sections', () => {
  const chapter = page([
    t(60, 740, 'Funny Business', 24),
    t(60, 715, 'Pratfalls', 16),
    body(700, 'A pratfall is a deliberate tumble that'),
    body(688, 'makes people laugh, if done well.'),
    body(660, 'A second paragraph after a gap, with a hyphen-'),
    body(648, 'ated word joined back together again.'),
    t(60, 630, 'Banana Peels #', 13),
    body(615, 'They cost nothing and work every time.'),
    // A larger-type opening sentence is not a heading.
    t(60, 590, 'We talked about falling, so now', 13),
    body(575, 'let’s talk about getting back up.'),
    t(60, 560, 'Pies', 16),
    body(545, 'Cream pies, mostly, thrown at faces.'),
  ])
  const pages = [blank, blank, blank, blank, chapter]

  it('nests sections under their headings by size', () => {
    expect(extractSections(pages).map((s) => s.path)).toEqual([
      ['Funny Business', 'Pratfalls'],
      ['Funny Business', 'Pratfalls', 'Banana Peels'],
      ['Funny Business', 'Pies'],
    ])
  })

  it('keeps paragraphs, joins hyphenated words and skips front matter', () => {
    const [pratfalls, peels] = extractSections(pages)
    expect(pratfalls.page).toBe(5)
    expect(pratfalls.text).toEqual([
      'A pratfall is a deliberate tumble that makes people laugh, if done well.',
      'A second paragraph after a gap, with a hyphenated word joined back together again.',
    ])
    expect(peels.text.join(' ')).toContain('We talked about falling, so now')
  })

  it('skips contents pages', () => {
    const contents = page(
      Array.from({ length: 6 }, (_, i) => body(700 - i * 14, `Chapter ${i + 1} ............ ${10 + i}`)),
    )
    expect(extractSections([blank, blank, blank, blank, contents])).toEqual([])
  })
})
