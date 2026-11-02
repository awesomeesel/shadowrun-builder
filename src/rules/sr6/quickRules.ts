/**
 * Everything the app itself says about the rules, in one list to search at
 * the table: the rules reference (statuses included), Edge actions and other
 * Edge uses, and the help texts behind the ⓘ buttons. All in our own words,
 * with Core Rulebook pages.
 */
import { BURN_EDGE, EDGE_ACTIONS, OTHER_EDGE_USES, PLAY_HELP, SKILL_HELP } from './help'
import { RULES_REFERENCE } from './reference'

export interface QuickRule {
  /** Where it comes from: "Statuses", "Edge action", "Skill"… */
  group: string
  title: string
  lines: string[]
  /** Core Rulebook page, when there is one. */
  page?: number
}

export const QUICK_RULES: QuickRule[] = [
  ...RULES_REFERENCE.flatMap((s) =>
    s.entries.map((e) => ({ group: s.title, title: e.title, lines: e.lines, page: e.page })),
  ),
  ...EDGE_ACTIONS.map((a) => ({
    group: 'Edge action',
    title: `${a.name} (${a.cost} Edge)`,
    lines: [`With: ${a.with}.`, a.text],
    page: a.page,
  })),
  ...OTHER_EDGE_USES.map((u) => ({
    group: 'Edge',
    title: `${u.name} (${u.cost} Edge)`,
    lines: [u.text],
    page: u.page,
  })),
  ...BURN_EDGE.map((b) => ({ group: 'Burning Edge', title: b.name, lines: [b.text], page: 48 })),
  ...Object.values(PLAY_HELP).map((h) => ({ group: 'Playing', title: h.title, lines: [h.text], page: h.page })),
  ...Object.values(SKILL_HELP).map((h) => ({ group: 'Skill', title: h.title, lines: [h.text], page: h.page })),
]

/**
 * Rules matching every word of the query, best first: a title that starts
 * with it, then a title containing it, then one that only mentions it.
 */
export function searchQuickRules(query: string, rules: QuickRule[] = QUICK_RULES): QuickRule[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const phrase = words.join(' ')
  const scored: { rule: QuickRule; score: number }[] = []
  const seen = new Set<string>()
  for (const rule of rules) {
    const title = rule.title.toLowerCase()
    const all = `${title} ${rule.group.toLowerCase()} ${rule.lines.join(' ').toLowerCase()}`
    if (!words.every((w) => all.includes(w))) continue
    // The same text can be in two lists (a help text and a reference entry); show it once.
    const key = `${title}|${rule.lines[0]}`
    if (seen.has(key)) continue
    seen.add(key)
    const score = title.startsWith(phrase)
      ? 0
      : title.includes(phrase)
        ? 1
        : words.every((w) => title.includes(w))
          ? 2
          : 3
    scored.push({ rule, score })
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.rule)
}
