import { bodyHeight, contentItems, readingOrder, type Line, type PageLayout } from '../layout'
import type { ExtractedEntry, NpcAttribute } from './types'

/** The attribute row of a stat block: "B A R S W L I C ESS", maybe with M, Rs or EDG. */
const ATTRIBUTE_HEADER = /^B\s+A\s+R\s+S\s+W\s+L\s+I\s+C\b/
const KEYS: Record<string, string> = {
  B: 'body',
  A: 'agility',
  R: 'reaction',
  S: 'strength',
  W: 'willpower',
  L: 'logic',
  I: 'intuition',
  C: 'charisma',
  M: 'magic',
  RS: 'resonance',
  'M/RS': 'magic',
  EDG: 'edge',
  ESS: 'essence',
}

/** Field labels in stat blocks and the entry field each one goes to. */
const FIELDS: [RegExp, keyof NpcFields][] = [
  [/^(?:Active )?Skills$/i, 'skills'],
  [/^Knowledge Skills$/i, 'knowledge'],
  [/^Gear$/i, 'gear'],
  [/^Augmentations$/i, 'augmentations'],
  [/^Weapons?$/i, 'weapons'],
  [/^Attacks?$/i, 'weapons'],
  [/^Spells$/i, 'spells'],
  [/^Complex Forms$/i, 'spells'],
  [/^(?:Powers(?:\/Qualities)?|Adept Powers|Qualities|Optional Powers)$/i, 'powers'],
  [/^Weaknesses$/i, 'weaknesses'],
  [/^Notes$/i, 'notes'],
  [/^Initiative(?:\/Actions)?$/i, 'initiativeText'],
  [/^Defense Rating$/i, 'defenseText'],
  [/^Condition Monitors?(?: \(P\/S\))?$/i, 'monitorText'],
]

type NpcFields = {
  skills: string
  knowledge: string
  gear: string
  augmentations: string
  weapons: string
  spells: string
  powers: string
  weaknesses: string
  notes: string
  initiativeText: string
  defenseText: string
  monitorText: string
}

interface Flat {
  line: Line
  page: number
  body: number
}

/** "5(7)" → base 5, augmented 7; "4.9" → 4.9. */
function value(text: string): NpcAttribute | null {
  const match = text.match(/^(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?$/)
  if (!match) return null
  const base = parseFloat(match[1])
  return { base, augmented: match[2] ? parseFloat(match[2]) : base }
}

/** "16/5" or "7 + 1D6" → score and initiative dice. */
function initiative(text: string): { score: number; dice: number } | null {
  const slash = text.match(/^(\d+)(?:\(\d+\))?\s*\/\s*(\d+)$/)
  if (slash) return { score: parseInt(slash[1], 10), dice: parseInt(slash[2], 10) }
  const plus = text.match(/(\d+)(?:\((\d+)\))?\s*\+\s*(\d+)D6/i)
  if (plus) return { score: parseInt(plus[2] ?? plus[1], 10), dice: parseInt(plus[3], 10) }
  return null
}

/** The augmented value if the book gives one: "9(11)" → 11. */
const effective = (text: string) => {
  const match = text.match(/(\d+)(?:\((\d+)\))?/)
  return match ? parseInt(match[2] ?? match[1], 10) : null
}

/**
 * Read non-player character stat blocks: grunts, lieutenants, prime runners,
 * sample contacts, critters and the sample characters. Spirits (written with
 * F for Force) are skipped; the app has their stats built in.
 */
export function extractNpcs(pages: PageLayout[]): ExtractedEntry[] {
  // Body text size for the whole book: pages full of stat blocks would otherwise
  // make the small stat text look like body text.
  const body = bodyHeight(pages.flatMap((page) => contentItems(page)))
  const flat: Flat[] = []
  pages.forEach((page, index) => {
    for (const line of readingOrder(page)) flat.push({ line, page: index + 1, body })
  })

  const entries: ExtractedEntry[] = []
  let section = ''
  let rating: number | null = null
  let lastRating = -10
  for (let i = 0; i < flat.length; i++) {
    const { line, body } = flat[i]
    // Big headings name the section ("Grunts", "Critters"); "Professional Rating 3" sets the rating.
    const pr = line.text.match(/^Professional Rating (\d+)\b/i)
    if (pr && line.h > body) {
      rating = parseInt(pr[1], 10)
      lastRating = i
    }
    if (line.h >= body + 2 && line.text.length < 40 && !pr) {
      section = line.text
      // "Professional Rating 3:" is often followed by its title on the next line; keep the rating then.
      if (i - lastRating > 2) rating = null
    }

    if (!ATTRIBUTE_HEADER.test(line.text)) continue
    const statSize = line.h
    const values = flat[i + 1]?.line.text.split(/\s+/) ?? []
    if (values.some((v) => /F/.test(v))) continue // a spirit, written in Force

    // The title sits just above, set larger than the stats but smaller than body text.
    const title: string[] = []
    let metatype = ''
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
      const above = flat[j].line
      // Titles are set clearly smaller than body text (body size is rounded to whole points).
      if (above.h <= statSize || above.h >= flat[j].body - 1 || /[.,;:]$/.test(above.text)) break
      const meta = above.text.match(/^metatype:\s*(.+)$/i)
      if (meta) metatype = meta[1].trim()
      else title.unshift(above.text)
    }
    // Sample characters put the metatype there and their name in the heading before it.
    if (title.length === 0) {
      for (let j = i - 1; j >= Math.max(0, i - 40); j--) {
        if (flat[j].line.h >= flat[j].body + 2) {
          title.push(flat[j].line.text)
          break
        }
      }
    }
    const raw = title.join(' ').replace(/\s+/g, ' ').trim()
    // Small-caps titles come out all lower or all upper case: "ghoul", "HUMANIS GOON".
    const name =
      raw === raw.toLowerCase() || raw === raw.toUpperCase()
        ? raw.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
        : raw
    const page = flat[i].page
    // Some titles carry the rating: "Spanky (Professional rating 2)".
    const titled = name.match(/\s*\(Professional rating (\d+)\)/i)
    const cleanName = (titled ? name.replace(titled[0], '') : name).replace(/^(.)/, (c) => c.toUpperCase())
    if (/[:]|^\(/.test(cleanName)) continue
    if (!name) continue

    const attributes: Record<string, NpcAttribute> = {}
    line.text.split(/\s+/).forEach((label, k) => {
      const key = KEYS[label.toUpperCase()]
      const parsed = value(values[k] ?? '')
      if (key && parsed) attributes[key] = parsed
    })
    if (!attributes.body || !attributes.agility) continue

    // The rest of the block: small text until the next title, heading or body paragraph.
    const fields: NpcFields = {
      skills: '',
      knowledge: '',
      gear: '',
      augmentations: '',
      weapons: '',
      spells: '',
      powers: '',
      weaknesses: '',
      notes: '',
      initiativeText: '',
      defenseText: '',
      monitorText: '',
    }
    let defenseRating: number | null = null
    let init: { score: number; dice: number } | null = null
    let actions = ''
    let monitor: { physical: number | null; stun: number | null } = { physical: null, stun: null }
    let move = ''
    let current: keyof NpcFields | null = null
    let end = i + 2
    for (let j = i + 2; j < flat.length && j < i + 60; j++) {
      const next = flat[j].line
      if (Math.abs(next.h - statSize) > 0.6 || ATTRIBUTE_HEADER.test(next.text)) break
      end = j
      // "DR I/ID AC CM MOVE" (critters leave out DR) with its values on the next line.
      if (/^(?:DR\s+)?I\/ID\s+AC\s+CM\s+MOVE$/.test(next.text)) {
        const labels = next.text.split(/\s+/)
        // "A1, I2" is one cell; glue it together before splitting on spaces.
        const cells = (flat[j + 1]?.line.text ?? '').replace(/A(\d+),\s*I(\d+)/, 'A$1,I$2').split(/\s+/)
        const cell = (label: string) => (labels.indexOf(label) >= 0 ? (cells[labels.indexOf(label)] ?? '') : '')
        if (cell('DR')) defenseRating = effective(cell('DR'))
        init = initiative(cell('I/ID')) ?? init
        actions = cell('AC').replace(',', ', ')
        const [p, st] = cell('CM')
          .split('/')
          .map((x) => parseInt(x, 10))
        monitor = { physical: Number.isFinite(p) ? p : null, stun: Number.isFinite(st) ? st : null }
        move = cell('MOVE')
        j++
        end = j
        current = null
        continue
      }
      const labelled = next.text.match(/^([A-Z][A-Za-z /()]+?):\s*(.*)$/)
      const field = labelled && FIELDS.find(([pattern]) => pattern.test(labelled[1].trim()))
      if (labelled && field) {
        current = field[1]
        fields[current] = `${fields[current] ? `${fields[current]} ` : ''}${labelled[2]}`.trim()
      } else if (current) {
        // Words split across lines with a hyphen ("Influ-" + "ence") are joined back together.
        const prev = fields[current]
        fields[current] =
          /[a-z]-$/.test(prev) && /^[a-z]/.test(next.text)
            ? prev.slice(0, -1) + next.text
            : `${prev} ${next.text}`.trim()
      }
    }
    if (fields.initiativeText) {
      init = initiative(fields.initiativeText) ?? init
      const acts = fields.initiativeText.match(/\/\s*(.+)$/)
      if (acts && !actions) actions = acts[1].trim()
    }
    if (fields.defenseText) defenseRating = effective(fields.defenseText) ?? defenseRating
    if (fields.monitorText) {
      const [p, s] = fields.monitorText.split('/').map((x) => parseInt(x, 10))
      monitor = { physical: Number.isFinite(p) ? p : null, stun: Number.isFinite(s) ? s : null }
    }
    i = end

    entries.push({
      kind: 'npc',
      page,
      // Sample characters share names like "Specialist"; their metatype tells them apart.
      name: metatype ? `${cleanName} (${metatype})` : cleanName,
      category: rating !== null || titled ? `Grunts (Professional Rating ${titled ? titled[1] : rating})` : section,
      professionalRating: titled ? parseInt(titled[1], 10) : rating,
      metatype,
      attributes,
      defenseRating,
      initiative: init,
      actions,
      monitor,
      move,
      skills: fields.skills,
      knowledge: fields.knowledge,
      gear: fields.gear,
      augmentations: fields.augmentations,
      weapons: fields.weapons,
      spells: fields.spells,
      powers: fields.powers,
      weaknesses: fields.weaknesses,
      notes: fields.notes,
    })
  }
  return entries
}
