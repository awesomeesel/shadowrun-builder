/**
 * Ranked search over everything the rules lookup knows: the app's own rule
 * summaries, items from the books (spells, qualities, gear…) and the books'
 * sections. Scoring is BM25 (the ranking behind most search engines) with a
 * bonus for matches in titles and for the whole phrase, after reducing words
 * to a common stem so "covered", "covering" and "cover" match.
 */

export type SearchKind = 'rule' | 'item' | 'section'

export interface SearchDoc {
  id: string
  kind: SearchKind
  /** Badge text: "Status", "Spell", "Book"… */
  label: string
  title: string
  /** Where it is: book code and headings, or the rule's group. */
  path: string[]
  bookId?: string
  /** PDF page. */
  page?: number
  /** Printed page (or the PDF's own page label), for display. */
  printedPage?: number | string
  /** Book code or "CRB" for the app's summaries. */
  source?: string
  /** Paragraphs or rule lines. */
  lines: string[]
}

export interface SearchResult {
  doc: SearchDoc
  score: number
}

/** Light English stemming: plurals and -ing/-ed endings. Enough for rules text, without a dictionary. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']s$/, '')
  if (w.length <= 3) return w
  if (w.endsWith('sses')) w = w.slice(0, -2)
  else if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`
  else if (/(s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2)
  else if (/[^su]s$/.test(w)) w = w.slice(0, -1)
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3)
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2)
  // running → runn → run, stopped → stopp → stop
  if (/([bdfgmnprt])\1$/.test(w)) w = w.slice(0, -1)
  return w
}

const WORD = /[a-z0-9]+(?:[’'][a-z]+)?/g

export function terms(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).map(stem).filter((w) => w.length > 1)
}

/** BM25 settings: how fast repeated words stop adding (k1), and how much long sections are evened out (b). */
const K1 = 1.2
const B = 0.75
/** A query word in the title counts this much on top of the text. */
const TITLE_WEIGHT = 2.5

interface Indexed {
  doc: SearchDoc
  title: Set<string>
  titleText: string
  body: Map<string, number>
  length: number
}

export class SearchIndex {
  private items: Indexed[] = []
  private df = new Map<string, number>()
  private avgLength = 1

  /** Build from documents, yielding to the page now and then so it stays responsive. */
  static async build(docs: SearchDoc[]): Promise<SearchIndex> {
    const index = new SearchIndex()
    let total = 0
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      const title = terms(doc.title)
      const body = new Map<string, number>()
      let length = 0
      for (const line of doc.lines) {
        for (const t of terms(line)) {
          body.set(t, (body.get(t) ?? 0) + 1)
          length++
        }
      }
      for (const t of new Set([...title, ...body.keys()])) index.df.set(t, (index.df.get(t) ?? 0) + 1)
      index.items.push({ doc, title: new Set(title), titleText: title.join(' '), body, length })
      total += length
      if (i % 400 === 399) await new Promise((r) => setTimeout(r, 0))
    }
    index.avgLength = Math.max(1, total / Math.max(1, docs.length))
    return index
  }

  get size() {
    return this.items.length
  }

  /** The query's words, each with the stems it may match (the last word also matches longer words while typing). */
  private groups(query: string): { stems: Map<string, number> }[] {
    const raw = query.toLowerCase().match(WORD) ?? []
    const typing = !/\s$/.test(query)
    return raw
      .map((word, i) => {
        const stems = new Map<string, number>([[stem(word), 1]])
        if (typing && i === raw.length - 1 && word.length >= 2) {
          // "cov" is surely part of a longer word; "cover" probably isn't, so "covert" counts for little.
          const weight = this.df.has(stem(word)) ? 0.3 : 0.8
          let added = 0
          for (const t of this.df.keys()) {
            if (t.startsWith(word) && !stems.has(t)) {
              stems.set(t, weight)
              if (++added >= 40) break
            }
          }
        }
        return { stems }
      })
      .filter((g) => [...g.stems.keys()].some((s) => s.length > 1))
  }

  private idf(t: string) {
    const n = this.df.get(t) ?? 0
    return Math.log(1 + (this.items.length - n + 0.5) / (n + 0.5))
  }

  search(query: string, keep: (doc: SearchDoc) => boolean = () => true, limit = 40): SearchResult[] {
    const groups = this.groups(query)
    if (groups.length === 0) return []
    const phrase = terms(query).join(' ')
    const score = (item: Indexed, all: boolean) => {
      let total = 0
      let matched = 0
      for (const g of groups) {
        let best = 0
        for (const [t, weight] of g.stems) {
          const tf = item.body.get(t) ?? 0
          const inTitle = item.title.has(t)
          if (!tf && !inTitle) continue
          const text = (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * item.length) / this.avgLength))
          best = Math.max(best, this.idf(t) * weight * (text + (inTitle ? TITLE_WEIGHT : 0)))
        }
        if (best > 0) matched++
        total += best
      }
      if (all && matched < groups.length) return 0
      if (matched === 0) return 0
      // The whole query as the title, at its start, or inside it.
      if (phrase && item.titleText === phrase) total += 6
      else if (phrase && item.titleText.startsWith(phrase)) total += 3
      else if (groups.length > 1 && item.titleText.includes(phrase)) total += 3
      return total
    }
    const run = (all: boolean) =>
      this.items
        .filter((item) => keep(item.doc))
        .map((item) => ({ doc: item.doc, score: score(item, all) }))
        .filter((r) => r.score > 0)
    // Every word if anything has them all; otherwise the best partial matches.
    let results = run(true)
    if (results.length === 0 && groups.length > 1) results = run(false)
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /** Stems that count as a hit for highlighting. */
  matchStems(query: string): Set<string> {
    return new Set(this.groups(query).flatMap((g) => [...g.stems.keys()]))
  }
}

export interface Piece {
  text: string
  hit: boolean
}

/** Split text into pieces, marking the words that match the query. */
export function highlight(text: string, stems: Set<string>): Piece[] {
  const pieces: Piece[] = []
  for (const part of text.match(/[A-Za-z0-9]+(?:[’'][A-Za-z]+)?|[^A-Za-z0-9]+/g) ?? []) {
    const hit = /[A-Za-z0-9]/.test(part) && stems.has(stem(part))
    const last = pieces[pieces.length - 1]
    if (last && last.hit === hit) last.text += part
    else pieces.push({ text: part, hit })
  }
  return pieces
}

/** The line that matches the most query words, cut to about `size` characters around the first match. */
export function snippet(lines: string[], stems: Set<string>, size = 170): string {
  let best = ''
  let bestCount = -1
  for (const line of lines) {
    const count = new Set(terms(line).filter((t) => stems.has(t))).size
    if (count > bestCount) {
      best = line
      bestCount = count
    }
  }
  if (best.length <= size) return best
  const words = best.split(' ')
  const first = words.findIndex((w) => stems.has(stem(w.replace(/[^A-Za-z0-9’']/g, ''))))
  let start = 0
  let length = 0
  for (let i = Math.max(0, first - 8); i < words.length; i++) {
    if (i === Math.max(0, first - 8)) start = i
    length += words[i].length + 1
    if (length > size) return `${start > 0 ? '…' : ''}${words.slice(start, i).join(' ')}…`
  }
  return `${start > 0 ? '…' : ''}${words.slice(start).join(' ')}`
}
