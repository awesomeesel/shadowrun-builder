/**
 * Everything the app itself says about the rules, in one list for the rules search at
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
