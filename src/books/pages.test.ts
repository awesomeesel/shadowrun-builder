import { describe, expect, it } from 'vitest'
import { guessBook } from './catalog'
import { parseSourceRef, pdfPageToPrinted, printedToPdfPage, type PageMapping } from './pages'

describe('page mapping', () => {
  const withOffset: PageMapping = { pageCount: 320, pageLabels: null, pageOffset: 2 }
  const labelled: PageMapping = {
    pageCount: 6,
    pageLabels: ['Cover', 'i', 'ii', '1', '2', '3'],
    pageOffset: 0,
  }

  it('uses the offset when the PDF has no labels', () => {
    expect(printedToPdfPage(withOffset, 245)).toBe(247)
    expect(pdfPageToPrinted(withOffset, 247)).toBe('245')
    expect(pdfPageToPrinted(withOffset, 1)).toBe('PDF 1')
  })

  it('clamps to the document', () => {
    expect(printedToPdfPage(withOffset, 999)).toBe(320)
  })

  it('prefers numeric page labels', () => {
    expect(printedToPdfPage(labelled, 2)).toBe(5)
    expect(pdfPageToPrinted(labelled, 2)).toBe('i')
  })

  it('falls back to the offset when a label is missing', () => {
    expect(printedToPdfPage(labelled, 4)).toBe(4)
  })

  it('ignores labels that are not page numbers', () => {
    const generic: PageMapping = { pageCount: 3, pageLabels: ['a', 'b', 'c'], pageOffset: 1 }
    expect(printedToPdfPage(generic, 1)).toBe(2)
  })
})

describe('parseSourceRef', () => {
  it.each([
    ['CRB 245', { book: 'CRB', page: 245 }],
    ['crb p. 245', { book: 'CRB', page: 245 }],
    ['SW245', { book: 'SW', page: 245 }],
    ['Firing Squad, pg 12', { book: 'FIRING SQUAD', page: 12 }],
  ])('parses %s', (text, expected) => {
    expect(parseSourceRef(text)).toEqual(expected)
  })

  it.each(['', '245', 'CRB', 'CRB 0'])('rejects %j', (text) => {
    expect(parseSourceRef(text)).toBeUndefined()
  })
})

describe('guessBook', () => {
  it('recognises common file names', () => {
    expect(guessBook('Shadowrun_6E_Core_Rulebook_City_Edition.pdf')?.code).toBe('CRB')
    expect(guessBook('CAT28007_Street_Wyrd.pdf')?.code).toBe('SW')
    expect(guessBook('download.pdf', 'Shadowrun Sixth World: Firing Squad')?.code).toBe('FS')
    expect(guessBook('random.pdf')).toBeUndefined()
  })
})
