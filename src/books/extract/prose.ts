import { bodyHeight, contentItems, readingOrder, type Line, type PageLayout, type PdfItem } from '../layout'
import type { ExtractedEntry } from './types'

/** Headings are set at least this much larger than body text. */
const HEADING_EXTRA = 1.2
const SPELL_CATEGORIES = /\b(combat|detection|health|illusion|manipulation)\b/i

interface Block {
  name: string
  page: number
  lines: Line[]
}

function isHeading(line: Line, body: number): boolean {
  return (
    line.h >= body + HEADING_EXTRA &&
    line.text.length <= 50 &&
    /[a-z]/i.test(line.text) &&
    !/[.:,]$/.test(line.text) &&
    !/^\d/.test(line.text)
  )
}

/** Split the book into blocks, each starting at a heading, following columns and pages in reading order. */
function blocks(pages: PageLayout[]): Block[] {
  const result: Block[] = []
  let current: Block | null = null
  pages.forEach((page, index) => {
    const body = bodyHeight(contentItems(page))
    for (const line of readingOrder(page)) {
      if (isHeading(line, body)) {
        current = { name: line.text, page: index + 1, lines: [] }
        result.push(current)
      } else if (current) {
        current.lines.push(line)
      }
    }
  })
  return result
}

/** Read qualities, adept powers, spells and complex forms from the book's running text. */
export function extractProse(pages: PageLayout[]): ExtractedEntry[] {
  const entries: ExtractedEntry[] = []
  // Spell chapters group spells under headings like "Detection Spells".
  let spellSection = ''
  for (const block of blocks(pages)) {
    const section = block.name.match(SPELL_CATEGORIES)
    if (section && /spells/i.test(block.name)) spellSection = section[1].toLowerCase()
    const entry = quality(block) ?? adeptPower(block) ?? spell(block, spellSection) ?? complexForm(block)
    if (entry) entries.push(entry)
  }
  return entries
}

/** "Built Tough (1 to 4)" → name "Built Tough", 4 levels. */
function splitLevels(name: string): { name: string; maxLevel: number | null } {
  const alone = name.match(/\s*\((\d+)\s*(?:to|–|-)\s*(\d+)\)\s*$/)
  if (alone) return { name: name.replace(alone[0], '').trim(), maxLevel: parseInt(alone[2], 10) }
  // "Addiction (Substance, 1 to 6)" → "Addiction (Substance)"
  const inside = name.match(/,\s*(\d+)\s*(?:to|–|-)\s*(\d+)\)\s*$/)
  if (inside) return { name: name.replace(inside[0], ')').trim(), maxLevel: parseInt(inside[2], 10) }
  return { name, maxLevel: null }
}

/** "5 Karma per level (max 10 levels)" → 10. */
function maxLevelFrom(text: string): number | null {
  const match = text.match(/max(?:imum)?\.?\s*(?:of\s*)?(\d+)\s*levels?/i)
  return match ? parseInt(match[1], 10) : null
}

/** The text after a "Label:" prefix (with an optional bullet), plus continuation lines. */
function field(block: Block, label: RegExp): string | null {
  for (const line of block.lines.slice(0, 12)) {
    const match = line.text.match(new RegExp(`^(?:•\\s*)?${label.source}:\\s*(.+)$`, 'i'))
    if (match) return match[1].trim()
  }
  return null
}

function quality(block: Block): ExtractedEntry | null {
  const cost = field(block, /Cost/)
  const bonus = field(block, /Bonus/)
  const text = cost ?? bonus
  if (!text || !/karma/i.test(text)) return null
  // Qualities always describe their effect; metavariants and other karma purchases don't.
  if (!block.lines.some((l) => /^(?:•\s*)?Game Effect:/i.test(l.text))) return null
  const karma = text.match(/\d+/)
  const { name, maxLevel } = splitLevels(block.name)
  return {
    kind: 'quality',
    page: block.page,
    name,
    category: bonus ? 'Negative qualities' : 'Positive qualities',
    positive: !bonus,
    karma: karma ? parseInt(karma[0], 10) : 0,
    perLevel: /per level|per rank/i.test(text),
    maxLevel: maxLevel ?? maxLevelFrom(text),
    costText: text,
  }
}

function adeptPower(block: Block): ExtractedEntry | null {
  const cost = field(block, /Cost/)
  const pp = cost?.match(/^([\d.]+)\s*PP\b(.*)$/i)
  if (!cost || !pp) return null
  const { name, maxLevel } = splitLevels(block.name)
  return {
    kind: 'adeptPower',
    page: block.page,
    name,
    category: 'Adept powers',
    powerPoints: parseFloat(pp[1]),
    perLevel: /per level/i.test(pp[2]),
    maxLevel,
    activation: field(block, /Activation/) ?? '',
  }
}

/** Values in a small stat table, matched to the header label each value is centred under. */
function miniTable(block: Block, headerTest: RegExp): Record<string, string> | null {
  const index = block.lines.findIndex((l) => headerTest.test(l.text))
  const values = block.lines[index + 1]
  if (index === -1 || index > 4 || !values) return null
  const header = block.lines[index].items
  const middle = (i: PdfItem) => i[0] + i[4] / 2
  const result: Record<string, string[]> = {}
  for (const item of values.items) {
    let best = header[0]
    for (const h of header) if (Math.abs(middle(h) - middle(item)) < Math.abs(middle(best) - middle(item))) best = h
    ;(result[best[3].trim().toUpperCase()] ??= []).push(item[3])
  }
  return Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.join(' ').trim()]))
}

function spell(block: Block, section: string): ExtractedEntry | null {
  // Critter powers share the layout but have no drain (DV) column.
  const stats = miniTable(block, /\bRANGE\b.*\bDURATION\b.*\bDV\b/)
  if (!stats) return null
  // Combat spells name their kind on the line under the heading, e.g. "(Direct Combat)".
  const kind = block.lines[0]?.text.match(/^\((.+)\)$/)?.[1] ?? ''
  const spellCategory = (kind.match(SPELL_CATEGORIES)?.[1] ?? section).toLowerCase()
  if (!spellCategory) return null
  return {
    kind: 'spell',
    page: block.page,
    name: block.name,
    category: kind || spellCategory.charAt(0).toUpperCase() + spellCategory.slice(1),
    spellCategory,
    range: stats.RANGE ?? '',
    type: stats.TYPE ?? '',
    duration: stats.DURATION ?? '',
    drain: stats.DV ?? stats.DRAIN ?? '',
    damage: stats.DAMAGE ?? '',
  }
}

function complexForm(block: Block): ExtractedEntry | null {
  const stats = miniTable(block, /\bFADE\b.*\bDURATION\b/)
  if (!stats) return null
  const fading = Object.entries(stats).find(([k]) => k.startsWith('FADE'))?.[1] ?? ''
  return {
    kind: 'complexForm',
    page: block.page,
    name: block.name,
    category: 'Complex forms',
    fading,
    duration: stats.DURATION ?? '',
  }
}
