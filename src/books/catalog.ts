export interface KnownBook {
  /** Short code used in page references, e.g. 'CRB' in "CRB 245". */
  code: string
  title: string
  /** Lowercase fragments that identify the book in a file name or PDF title. */
  match: string[]
}

export const KNOWN_BOOKS: KnownBook[] = [
  { code: 'CRB', title: 'Core Rulebook', match: ['core rule', 'core-rule', 'corerule', 'core_rule', 'sixth world core'] },
  { code: 'FS', title: 'Firing Squad', match: ['firing squad', 'firing-squad', 'firingsquad', 'firing_squad'] },
  { code: 'SW', title: 'Street Wyrd', match: ['street wyrd', 'street-wyrd', 'streetwyrd', 'street_wyrd'] },
  { code: 'HS', title: 'Hack & Slash', match: ['hack & slash', 'hack and slash', 'hack-and-slash', 'hack_slash', 'hackslash', 'hack-slash'] },
  { code: 'DC', title: 'Double Clutch', match: ['double clutch', 'double-clutch', 'doubleclutch', 'double_clutch'] },
  { code: 'BS', title: 'Body Shop', match: ['body shop', 'body-shop', 'bodyshop', 'body_shop'] },
  { code: 'SWC', title: 'Sixth World Companion', match: ['companion'] },
  { code: 'PP', title: 'Power Plays', match: ['power plays', 'power-plays', 'powerplays', 'power_plays'] },
]

/** Guess which book a PDF is from its file name and embedded title. */
export function guessBook(fileName: string, pdfTitle = ''): KnownBook | undefined {
  const haystack = `${fileName} ${pdfTitle}`.toLowerCase()
  return KNOWN_BOOKS.find((book) => book.match.some((m) => haystack.includes(m)))
}
