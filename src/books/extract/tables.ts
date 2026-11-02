import { contentItems, groupLines, makeLine, type Line, type PageLayout, type PdfItem } from '../layout'
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
      // Same start, or (for a label centred under a wider one, like "SLOTS" under "ACTIVE PROGRAM") inside it.
      const near =
        columns.find((c) => Math.abs(c.x - item[0]) <= COLUMN_SLACK) ??
        columns.find((c) => item[0] >= c.x && item[0] + item[4] <= c.end + COLUMN_SLACK)
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
    // Single-vehicle stat blocks are read by vehicleBlocks below.
    if (/^HAND/.test(columns[0].header)) continue
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
  return [...entries, ...vehicleBlocks(lines, pageNumber)]
}

/** Labels of a single-vehicle stat block. */
const VEHICLE_LABEL = /^(HAND|ACC|ACCEL|SPD|INT|TOP|BODY?|ARM|ARMOR|PILOT|SENS|SENSOR|SEATS?|AVAIL|COST)$/

/** Some books set several labels as one piece of text ("BODY ARM PILOT SENS"); split it where each word would sit. */
function splitMergedLabels(items: PdfItem[]): PdfItem[] {
  return items.flatMap((item): PdfItem[] => {
    const words = item[3].trim().split(/\s+/)
    if (words.length < 2 || !words.every((w) => VEHICLE_LABEL.test(w))) return [item]
    const perChar = item[4] / item[3].length
    let x = item[0]
    return words.map((word) => {
      const piece: PdfItem = [x, item[1], item[2], word, word.length * perChar]
      x += (word.length + 1) * perChar
      return piece
    })
  })
}

/**
 * Single vehicles' stat blocks (Double Clutch): the name and "(medium wheeled
 * drone)" above a HAND / ACC / SPD INT / … / COST header, one row of numbers
 * below. Blocks often sit beside a column of text, so only the strip of page
 * under the header is read.
 */
function vehicleBlocks(lines: Line[], page: number): ExtractedEntry[] {
  const entries: ExtractedEntry[] = []
  for (let h = 0; h < lines.length; h++) {
    const hand = lines[h].items.find((it) => /^HAND\b/.test(it[3].trim()))
    if (!hand) continue
    // The header's own labels, left to right from HAND, stopping at the first thing that isn't one.
    const labels: PdfItem[] = []
    for (const it of splitMergedLabels(lines[h].items.filter((i) => i[0] >= hand[0] - 2).sort((a, b) => a[0] - b[0]))) {
      if (!VEHICLE_LABEL.test(it[3].trim())) break
      labels.push(it)
    }
    if (!labels.some((l) => /^COST$/.test(l[3].trim())) || labels.length < 6) continue
    const last = labels[labels.length - 1]
    const left = hand[0] - 15
    const right = last[0] + last[4] + 20
    const strip = (line: Line | undefined) => {
      const items = line?.items.filter((it) => it[0] >= left && it[0] <= right) ?? []
      return items.length ? makeLine(splitMergedLabels(items)) : undefined
    }
    const header = makeLine(labels)
    const statColumns = mergeStackedHeaders(header, strip(lines[h - 1]), strip(lines[h + 1]))
    // A blank name column in front, so the numbers line up under their labels.
    const columns = [{ header: '', x: left - 100, end: left - 100 }, ...statColumns]

    let values: string[] | null = null
    for (let i = h + 1; i < lines.length && lines[i].y > header.y - 30; i++) {
      const line = strip(lines[i])
      if (!line || line.items.every((it) => HEADER_WORD.test(it[3].trim()))) continue
      const c = cells(columns, line)
      if (c.slice(1).filter(Boolean).length >= 4) values = c
      break
    }
    if (!values) continue

    // The name: up to four short lines straight above, ending at shadowtalk ("> Kane") or a sentence.
    const parts: string[] = []
    let y = header.y
    for (let i = h - 1; i >= 0 && parts.length < 4; i--) {
      const line = strip(lines[i])
      if (!line) continue
      if (line.y - y > 30 || line.text.length > 60 || /^>|>\s|[.!?:]$/.test(line.text)) break
      y = line.y
      // Stacked labels like "SPD TOP" belong to the header.
      if (line.items.every((it) => VEHICLE_LABEL.test(it[3].trim()))) continue
      parts.unshift(line.text)
    }
    const text = parts.join(' ').replace(/\s+/g, ' ').trim()
    const type = text.match(/\(([^)]+)\)\s*$/)
    const name = type ? text.slice(0, type.index).trim() : text
    if (!/[A-Za-z]{2}/.test(name)) continue
    values[0] = name
    const entry = toEntry(columns, values, page, titleCase(type?.[1] ?? 'Vehicles'))
    // Two blocks set side by side can leave one without its numbers; skip it rather than list it empty.
    if (entry?.kind === 'vehicle' && (entry.handling || entry.body)) entries.push(entry)
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

  // Cyberjack tables shorten the header to "ESS".
  if (has(/^ESS(ENCE)?$/)) {
    return {
      ...base,
      kind: 'augmentation',
      rating: parseRatingRange(col(/^RATING$/)) ?? split.rating,
      essence: parseScaled(col(/^ESS(ENCE)?$/)),
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
  // Double Clutch shortens the labels: ACC, SPD INT, TOP SPD, BOD, ARM, SENS.
  // Without Body it's an upgrade table (e.g. secondary propulsion), not vehicles.
  if (has(/^ACC(EL)?$/) && has(/^BODY?$/)) {
    return {
      ...base,
      kind: 'vehicle',
      drone: /DRONE/.test(first) || /drone/i.test(category),
      handling: col(/^HAND/),
      acceleration: col(/^ACC(EL)?$/),
      speedInterval: col(/^(SPEED|SPD)/),
      topSpeed: col(/^TOP (SPEED|SPD)$/),
      body: parseInt0(col(/^BODY?$/)),
      armor: parseInt0(col(/^ARM(OR)?$/)),
      pilot: parseInt0(col(/^PILOT$/)),
      sensor: parseInt0(col(/^SENS(OR)?$/)),
      seats: col(/^SEAT/),
    }
  }
  // Accessories and tags also list a Device Rating, but only real devices have Matrix attributes.
  if (has(/^DEVICE RATING$/) && (has(/^ATTRIBUTES/) || has(/^DATA PROCESSING$/) || has(/^FIREWALL$/))) {
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
      programSlots: parseInt0(col(/PROGRAM SLOTS$/)),
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
