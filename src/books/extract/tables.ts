import { contentItems, groupLines, type Line, type PageLayout, type PdfItem } from '../layout'
import type { ExtractedEntry, RatingRange } from './types'
import { cleanName, parseAttackRatings, parseInt0, parseRatingRange, parseScaled } from './values'

interface Column {
  header: string
  x: number
  /** Right edge of the header text. */
  end: number
}

const center = (c: Column) => (c.x + c.end) / 2

/** Cells may start a little left of their header (centred or right-aligned values). */
const COLUMN_SLACK = 12
/** A larger vertical gap than this ends a table. */
const MAX_ROW_GAP = 22
/** A wrapped name fragment sits this close to its data row. */
const NAME_FRAGMENT_GAP = 7

const HEADER_WORD = /^[A-Z][A-Z0-9 /&().,-]*$/
const PRICE_HEADER = /^(COST|AVAIL|AVAILABILITY)\b/

/** A gear table header: several upper-case labels including a cost or availability column. */
export function isTableHeader(line: Line): boolean {
  if (line.items.length < 3) return false
  const words = line.items.map((i) => i[3].trim())
  return words.every((w) => HEADER_WORD.test(w)) && words.some((w) => PRICE_HEADER.test(w))
}

/** Header labels split over lines, like "HAND (ON/" above and "OFF ROAD)" below the main header row. */
function isStackedHeader(line: Line | undefined, header: Line): line is Line {
  return (
    !!line &&
    Math.abs(line.y - header.y) <= 7 &&
    line.items.every((i) => HEADER_WORD.test(i[3].trim())) &&
    !line.items.some((i) => PRICE_HEADER.test(i[3].trim()))
  )
}

function mergeStackedHeaders(header: Line, above: Line | undefined, below: Line | undefined): Column[] {
  const columns: Column[] = header.items.map((i) => ({ header: i[3].trim(), x: i[0], end: i[0] + i[4] }))
  for (const extra of [above, below]) {
    if (!isStackedHeader(extra, header)) continue
    for (const item of extra.items) {
      const near = columns.find((c) => Math.abs(c.x - item[0]) <= COLUMN_SLACK)
      if (near) {
        near.header = `${near.header} ${item[3].trim()}`
        near.x = Math.min(near.x, item[0])
        near.end = Math.max(near.end, item[0] + item[4])
      } else {
        columns.push({ header: item[3].trim(), x: item[0], end: item[0] + item[4] })
      }
    }
  }
  return columns.sort((a, b) => a.x - b.x)
}

/**
 * Names are left-aligned, so anything starting before the second column is a
 * name. Values are often centred under their header, so they go to the
 * header whose centre is nearest.
 */
function columnIndex(columns: Column[], item: PdfItem): number {
  if (columns.length < 2 || item[0] < columns[1].x - COLUMN_SLACK) return 0
  const middle = item[0] + item[4] / 2
  let best = 1
  for (let i = 2; i < columns.length; i++) {
    if (Math.abs(center(columns[i]) - middle) < Math.abs(center(columns[best]) - middle)) best = i
  }
  return best
}

function cells(columns: Column[], line: Line): string[] {
  const parts: string[][] = columns.map(() => [])
  for (const item of line.items) parts[columnIndex(columns, item)].push(item[3])
  return parts.map((p) => p.join(' ').replace(/\s+/g, ' ').trim())
}

interface Row {
  y: number
  cells: string[]
  /** The name column was empty, so the name wraps onto lines above/below. */
  wrapped: boolean
}

/** Read every gear table on a page. */
export function extractTables(page: PageLayout, pageNumber: number): ExtractedEntry[] {
  const lines = groupLines(contentItems(page))
  const entries: ExtractedEntry[] = []

  for (let h = 0; h < lines.length; h++) {
    const header = lines[h]
    if (!isTableHeader(header)) continue
    const columns = mergeStackedHeaders(header, lines[h - 1], lines[h + 1])
    const firstRow = isStackedHeader(lines[h + 1], header) ? h + 2 : h + 1
    const left = columns[0].x - 40
    const right = columns[columns.length - 1].x + 120

    // A short line just above the header names the section, e.g. "light pistols".
    const above = lines[h - 1] && isStackedHeader(lines[h - 1], header) ? lines[h - 2] : lines[h - 1]
    const section = above && above.y - header.y < 16 && isSectionLabel(above.text) ? above.text : ''
    const category = titleCase(section || columns[0].header)

    const rows: Row[] = []
    let pendingName: { text: string; y: number } | null = null
    let lastY = header.y
    for (let i = firstRow; i < lines.length; i++) {
      const line = lines[i]
      if (isTableHeader(line) || lastY - line.y > MAX_ROW_GAP) break
      const inTable = { ...line, items: line.items.filter((it) => it[0] >= left && it[0] <= right) }
      if (inTable.items.length === 0) continue
      const c = cells(columns, inTable)
      const dataColumns = c.slice(1).filter(Boolean).length

      if (dataColumns >= Math.min(2, columns.length - 1)) {
        const nameAbove = pendingName && pendingName.y - line.y <= NAME_FRAGMENT_GAP ? pendingName.text : ''
        if (!c[0]) c[0] = nameAbove
        rows.push({ y: line.y, cells: c, wrapped: !line.items.some((it) => columnIndex(columns, it) === 0) })
        pendingName = null
        lastY = line.y
      } else if (dataColumns === 0 && c[0].length < 40) {
        const last = rows[rows.length - 1]
        if (last?.wrapped && last.y - line.y <= NAME_FRAGMENT_GAP) {
          last.cells[0] = `${last.cells[0]} ${c[0]}`.trim()
          last.wrapped = false
        } else {
          pendingName = { text: c[0], y: line.y }
        }
        lastY = line.y
      } else {
        break // prose: the table has ended
      }
    }

    let previousName = ''
    for (const row of rows) {
      // "w/helmet" is a variant of the row above it.
      if (/^w\//i.test(row.cells[0]) && previousName) row.cells[0] = `${previousName} ${row.cells[0]}`
      else previousName = row.cells[0]
      const entry = toEntry(columns, row.cells, pageNumber, category)
      if (entry) entries.push(entry)
    }
  }
  return entries
}

/** Section labels above tables are short names like "light pistols", never sentences or numbers. */
function isSectionLabel(text: string): boolean {
  return text.length < 40 && !/\d|\.$/.test(text) && text.split(' ').length <= 5
}

function titleCase(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** "Datalock (rating 1–12)" → name "Datalock" and rating 1–12. */
function splitRating(text: string): { name: string; rating: RatingRange | null } {
  const match = text.match(/\s*\((?:rating\s*)?(\d+)\s*[–—-]\s*(\d+)\)/i)
  if (!match) return { name: text, rating: null }
  return {
    name: text.replace(match[0], '').trim(),
    rating: { min: parseInt(match[1], 10), max: parseInt(match[2], 10) },
  }
}

function toEntry(columns: Column[], c: string[], page: number, category: string): ExtractedEntry | null {
  const split = splitRating(cleanName(c[0]))
  // Some tables list one item by rating ("Rating 5"); name those rows after the table.
  const name = /^rating\b/i.test(split.name) ? `${category} ${split.name.toLowerCase()}` : split.name
  // Real names have letters; a leading damage value like "1P + special" is a spilled cell.
  if (!/[A-Za-z]{2}/.test(name) || /^\d+[PS]\b/.test(name) || name.length > 60) return null
  const col = (pattern: RegExp) => {
    const index = columns.findIndex((column, i) => i > 0 && pattern.test(column.header))
    return index === -1 ? '' : c[index]
  }
  const has = (pattern: RegExp) => columns.some((column, i) => i > 0 && pattern.test(column.header))
  const base = { page, name, category, availability: col(/^AVAIL/), cost: parseScaled(col(/^COST$/)) }
  const first = columns[0].header

  if (has(/^ESSENCE$/)) {
    return {
      ...base,
      kind: 'augmentation',
      rating: parseRatingRange(col(/^RATING$/)) ?? split.rating,
      essence: parseScaled(col(/^ESSENCE$/)),
      capacity: col(/^CAPACITY$/),
    }
  }
  if (has(/^ATTACK RATINGS?$/) && has(/^DV$/)) {
    return {
      ...base,
      kind: 'weapon',
      damage: col(/^DV$/).replace(/^DV\s*/, ''),
      modes: col(/^MODES?$/),
      attackRatings: parseAttackRatings(col(/^ATTACK RATINGS?$/)),
      ammo: col(/^AMMO$/),
    }
  }
  if (has(/^ACCEL$/)) {
    return {
      ...base,
      kind: 'vehicle',
      drone: /DRONE/.test(first) || /drone/i.test(category),
      handling: col(/^HAND/),
      acceleration: col(/^ACCEL$/),
      speedInterval: col(/^SPEED/),
      topSpeed: col(/^TOP SPEED$/),
      body: parseInt0(col(/^BODY$/)),
      armor: parseInt0(col(/^ARMOR$/)),
      pilot: parseInt0(col(/^PILOT$/)),
      sensor: parseInt0(col(/^SENSOR$/)),
      seats: col(/^SEAT/),
    }
  }
  if (has(/^DEVICE RATING$/)) {
    const attributeHeader = columns.find((column) => /^ATTRIBUTES/.test(column.header))?.header ?? ''
    const attributes = has(/^ATTRIBUTES/)
      ? col(/^ATTRIBUTES/)
      : [col(/^DATA PROCESSING$/), col(/^FIREWALL$/)].filter(Boolean).join('/')
    return {
      ...base,
      kind: 'matrixDevice',
      deviceRating: parseInt0(col(/^DEVICE RATING$/)),
      attributes,
      attributeNames: attributeHeader.match(/\(([^)]+)\)/)?.[1] ?? (attributes ? 'D/F' : ''),
    }
  }
  if (has(/^DEFENSE RATING$/)) {
    return {
      ...base,
      kind: 'armor',
      rating: parseRatingRange(col(/^RATING$/)) ?? split.rating,
      defense: parseInt0(col(/^DEFENSE RATING$/)),
      capacity: col(/^CAPACITY$/),
    }
  }
  return { ...base, kind: 'gear', rating: parseRatingRange(col(/^RATING$/)) ?? split.rating }
}
