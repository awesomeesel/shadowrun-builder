/**
 * Headings to look for when linking a build step to its rules. A page matches
 * when one of its lines is exactly the heading, which skips tables of contents
 * (where headings are followed by dots and page numbers). Most topics are
 * searched from the priority table onwards, since words like "Skills" also
 * head earlier chapters.
 */
const ANCHOR = ['priority table']

export const RULES_HEADINGS = {
  concept: { headings: ['History', 'Select Character'], afterAnchor: false },
  priorities: { headings: ANCHOR, afterAnchor: false },
  attributes: { headings: ['metatype attributes table'], afterAnchor: false },
  skills: { headings: ['Skill', 'Skills'], afterAnchor: true },
  magic: { headings: ['Magic/Resonance'], afterAnchor: true },
  qualities: { headings: ['Select Qualities'], afterAnchor: true },
  gear: { headings: ['Buy Gear'], afterAnchor: true },
  contacts: { headings: ['Contacts'], afterAnchor: true },
  finishing: { headings: ['Finishing Steps'], afterAnchor: true },
} as const

export type RulesTopic = keyof typeof RULES_HEADINGS

export interface PageText {
  page: number
  text: string
}

/** First page (1-based) at or after `from` whose text has one of the headings as a whole line. */
export function findHeadingPage(pageTexts: PageText[], headings: readonly string[], from = 1): number | null {
  const wanted = headings.map((h) => h.toLowerCase())
  for (const { page, text } of [...pageTexts].sort((a, b) => a.page - b.page)) {
    if (page < from) continue
    const lines = text.split('\n').map((l) => l.trim().toLowerCase())
    if (lines.some((l) => wanted.includes(l))) return page
  }
  return null
}

/** PDF page for each creation topic in one book, or null when the book doesn't cover it. */
export function findRulesPages(pageTexts: PageText[]): Record<RulesTopic, number | null> {
  const anchor = findHeadingPage(pageTexts, ANCHOR)
  const result = {} as Record<RulesTopic, number | null>
  for (const [topic, { headings, afterAnchor }] of Object.entries(RULES_HEADINGS) as [
    RulesTopic,
    (typeof RULES_HEADINGS)[RulesTopic],
  ][]) {
    if (afterAnchor && anchor === null) result[topic] = null
    else result[topic] = findHeadingPage(pageTexts, headings, afterAnchor ? anchor! - 1 : 1)
  }
  return result
}
