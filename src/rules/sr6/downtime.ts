/**
 * Lifestyle and downtime between runs, in our own words.
 *
 * - Lifestyles are paid by the month, as far ahead as you like; without one
 *   paid for the month you're on the street (Core Rulebook pp. 56–57).
 * - Lowering Heat: lie low (−1 a month without runs, at most 3 a year), bribes
 *   (1,000¥ a point), or a law-enforcement or corp-security contact of
 *   Connection 3+ (−2, and their Loyalty drops by 1) (Core Rulebook pp. 236–237).
 * - Reputation: 1,000¥ × the new level (or × the current level's size while
 *   it's negative) plus 1 Karma, about two weeks each (Sixth World Companion p. 193).
 * - Working for the Man / the People, optional: a week turns 1 Karma into
 *   2,000¥, or 2,000¥ into 1 Karma (Sixth World Companion p. 153).
 * - Buying a favor from a contact: 1 Karma or 1,000¥ × Connection, one a week
 *   (Sixth World Companion p. 172).
 * - Optional: lifestyle changes natural healing dice (Sixth World Companion pp. 145–146).
 */
import { SessionRecordSchema, type Character, type Lifestyle } from '../../model/character'
import { formatDays } from './format'
import { addLedgerEntry } from './play'

export { formatDays }

/** A lifestyle month, in days. */
export const MONTH_DAYS = 30

/** The book's lifestyles and their monthly cost (Core Rulebook p. 57). */
export const LIFESTYLE_LEVELS = [
  { name: 'Street', cost: 0, healing: -2 },
  { name: 'Squatter', cost: 500, healing: -1 },
  { name: 'Low', cost: 2_000, healing: 0 },
  { name: 'Middle', cost: 5_000, healing: 2 },
  { name: 'High', cost: 10_000, healing: 4 },
  { name: 'Luxury', cost: 100_000, healing: 6 },
] as const

export const BRIBE_PER_HEAT = 1_000
export const CONTACT_HEAT = 2
/** Most Heat lying low takes off in one in-game year. */
export const LIE_LOW_PER_YEAR = 3
export const WORK_RATE = 2_000

/** Quick picks for how much time passes. */
export const DOWNTIME_LENGTHS = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
  { days: 60, label: '2 months' },
  { days: 90, label: '3 months' },
]

/** The book level a lifestyle is at, matched on its level or name; undefined for custom ones. */
export function lifestyleLevel(lifestyle: Pick<Lifestyle, 'level' | 'name'>) {
  const find = (text: string) => {
    const t = text.trim().toLowerCase()
    return LIFESTYLE_LEVELS.find((l) => l.name.toLowerCase() === t || (t === 'medium' && l.name === 'Middle'))
  }
  return find(lifestyle.level) ?? find(lifestyle.name)
}

/** A lifestyle that needs rent: not the free Street one. */
export function paysRent(lifestyle: Lifestyle): boolean {
  return lifestyle.cost > 0
}

/** Days of rent left, counting the part of this month already used. */
export function daysLeft(lifestyle: Lifestyle): number {
  return Math.max(0, lifestyle.monthsPaid * MONTH_DAYS - lifestyle.daysUsed)
}

/** The lifestyle the runner lives at: the best one with rent paid, or null (on the street). */
export function currentLifestyle(character: Character): Lifestyle | null {
  const paid = character.lifestyles.filter((l) => !paysRent(l) || daysLeft(l) > 0)
  return [...paid].sort((a, b) => b.cost - a.cost)[0] ?? null
}

/** Natural healing dice from where the runner lives (optional, SWC pp. 145–146); 0 when it can't be told. */
export function lifestyleHealingDice(character: Character): number {
  const current = currentLifestyle(character)
  if (!current) return character.lifestyles.length ? LIFESTYLE_LEVELS[0].healing : 0
  return lifestyleLevel(current)?.healing ?? 0
}

/** Days pass on one lifestyle. `ranOutAfter` is the day rent ran out, when it did. */
export function passDays(lifestyle: Lifestyle, days: number): { lifestyle: Lifestyle; ranOutAfter: number | null } {
  if (!paysRent(lifestyle) || days <= 0) return { lifestyle, ranOutAfter: null }
  const left = daysLeft(lifestyle)
  if (days >= left) {
    return {
      lifestyle: { ...lifestyle, monthsPaid: 0, daysUsed: 0 },
      ranOutAfter: lifestyle.monthsPaid > 0 || left > 0 ? left : 0,
    }
  }
  const used = lifestyle.daysUsed + days
  return {
    lifestyle: {
      ...lifestyle,
      monthsPaid: lifestyle.monthsPaid - Math.floor(used / MONTH_DAYS),
      daysUsed: used % MONTH_DAYS,
    },
    ranOutAfter: null,
  }
}

/** Nuyen for raising Reputation by `steps` from `reputation`. */
export function reputationCost(reputation: number, steps: number): { nuyen: number; karma: number; days: number } {
  let nuyen = 0
  for (let i = 0; i < steps; i++) {
    const current = reputation + i
    nuyen += 1_000 * (current >= 0 ? current + 1 : -current)
  }
  return { nuyen, karma: steps, days: steps * 14 }
}

/** Contacts who can make Heat go away: law enforcement or corp security, Connection 3+. */
export function heatContacts(character: Character) {
  return character.contacts.filter((c) => c.connection >= 3)
}

/** How much Heat lying low takes off for this many days. */
export function lieLowHeat(days: number): number {
  return Math.min(LIE_LOW_PER_YEAR, Math.floor(days / MONTH_DAYS))
}

export interface DowntimePlan {
  days: number
  /** Months of rent to pay, per lifestyle id; paid before the time passes. */
  rent: Record<string, number>
  /** No runs in this time: Heat drops a point a month. */
  lieLow: boolean
  /** Heat points bribed away. */
  bribes: number
  /** A contact asked to bury the runner's record. */
  heatContact: string | null
  /** Reputation points worked for. */
  reputation: number
  /** Weeks spent turning karma into nuyen (the Man) and nuyen into karma (the People). */
  workForTheMan: number
  workForThePeople: number
  /** Favors bought, one a week: the contact and how it's paid. */
  favors: { contactId: string; pay: 'karma' | 'nuyen' }[]
  notes: string
}

export function emptyPlan(days = 7): DowntimePlan {
  return {
    days,
    rent: {},
    lieLow: false,
    bribes: 0,
    heatContact: null,
    reputation: 0,
    workForTheMan: 0,
    workForThePeople: 0,
    favors: [],
    notes: '',
  }
}

export interface DowntimeOutcome {
  nuyen: number
  karma: number
  heat: number
  reputation: number
  /** Days of the downtime taken up by activities that need whole weeks. */
  busyDays: number
  /** Lifestyles whose rent ran out, and after how many days. */
  ranOut: { name: string; day: number }[]
  lines: { note: string; nuyen: number; karma: number }[]
}

/** What a plan costs and gives, before it's applied. */
export function downtimeOutcome(character: Character, plan: DowntimePlan): DowntimeOutcome {
  const lines: DowntimeOutcome['lines'] = []
  for (const l of character.lifestyles) {
    const months = plan.rent[l.id] ?? 0
    if (months > 0 && paysRent(l)) {
      lines.push({
        note: `Rent: ${l.name || l.level || 'lifestyle'}, ${months} ${months === 1 ? 'month' : 'months'}`,
        nuyen: -months * l.cost,
        karma: 0,
      })
    }
  }
  const heatBefore = character.heat
  let heat = heatBefore
  const lieLow = plan.lieLow ? Math.min(heat, lieLowHeat(plan.days)) : 0
  heat -= lieLow
  const contact = plan.heatContact ? character.contacts.find((c) => c.id === plan.heatContact) : undefined
  if (contact) heat = Math.max(0, heat - CONTACT_HEAT)
  const bribes = Math.min(heat, Math.max(0, plan.bribes))
  if (bribes) lines.push({ note: `Bribes: Heat −${bribes}`, nuyen: -bribes * BRIBE_PER_HEAT, karma: 0 })
  heat -= bribes
  if (plan.reputation > 0) {
    const cost = reputationCost(character.reputation, plan.reputation)
    lines.push({ note: `Working on Reputation (+${plan.reputation})`, nuyen: -cost.nuyen, karma: -cost.karma })
  }
  if (plan.workForTheMan > 0) {
    lines.push({
      note: `Working for the Man, ${plan.workForTheMan} ${plan.workForTheMan === 1 ? 'week' : 'weeks'}`,
      nuyen: plan.workForTheMan * WORK_RATE,
      karma: -plan.workForTheMan,
    })
  }
  if (plan.workForThePeople > 0) {
    lines.push({
      note: `Working for the People, ${plan.workForThePeople} ${plan.workForThePeople === 1 ? 'week' : 'weeks'}`,
      nuyen: -plan.workForThePeople * WORK_RATE,
      karma: plan.workForThePeople,
    })
  }
  for (const f of plan.favors) {
    const c = character.contacts.find((x) => x.id === f.contactId)
    if (!c) continue
    lines.push({
      note: `A favor from ${c.name || 'a contact'}`,
      nuyen: f.pay === 'nuyen' ? -1_000 * c.connection : 0,
      karma: f.pay === 'karma' ? -1 : 0,
    })
  }
  const ranOut: DowntimeOutcome['ranOut'] = []
  for (const l of character.lifestyles) {
    const paid = { ...l, monthsPaid: l.monthsPaid + (plan.rent[l.id] ?? 0) }
    const { ranOutAfter } = passDays(paid, plan.days)
    if (ranOutAfter !== null) ranOut.push({ name: l.name || l.level || 'Lifestyle', day: ranOutAfter })
  }
  const weeks = plan.workForTheMan + plan.workForThePeople + plan.favors.length + plan.reputation * 2
  return {
    nuyen: lines.reduce((s, l) => s + l.nuyen, 0),
    karma: lines.reduce((s, l) => s + l.karma, 0),
    heat: heat - heatBefore,
    reputation: plan.reputation,
    busyDays: weeks * 7,
    ranOut,
    lines,
  }
}

/** Apply a downtime: pay, let the days pass, change Heat, Reputation and contacts, and log it. */
export function applyDowntime(character: Character, plan: DowntimePlan, now = new Date()): Character {
  const outcome = downtimeOutcome(character, plan)
  let c = character
  for (const line of outcome.lines) c = addLedgerEntry(c, line, now)
  const contactId = plan.heatContact
  const favorCounts = new Map<string, number>()
  for (const f of plan.favors) favorCounts.set(f.contactId, (favorCounts.get(f.contactId) ?? 0) + 1)
  const record = SessionRecordSchema.parse({
    kind: 'downtime',
    title: `Downtime · ${formatDays(plan.days)}`,
    startedAt: now.toISOString(),
    endedAt: now.toISOString(),
    days: plan.days,
    nuyen: outcome.nuyen,
    karma: outcome.karma,
    notes: plan.notes,
    entries: outcome.lines,
    damage: { physical: c.damage.physical, stun: c.damage.stun },
    heat: outcome.heat,
    reputation: outcome.reputation,
  })
  return {
    ...c,
    heat: Math.max(0, c.heat + outcome.heat),
    reputation: c.reputation + outcome.reputation,
    lifestyles: c.lifestyles.map(
      (l) => passDays({ ...l, monthsPaid: l.monthsPaid + (plan.rent[l.id] ?? 0) }, plan.days).lifestyle,
    ),
    contacts: c.contacts.map((x) => {
      const favors = favorCounts.get(x.id) ?? 0
      const loyalty = x.id === contactId ? Math.max(0, x.loyalty - 1) : x.loyalty
      return favors || loyalty !== x.loyalty ? { ...x, loyalty, favors: x.favors + favors } : x
    }),
    sessions: [...c.sessions, record],
  }
}
