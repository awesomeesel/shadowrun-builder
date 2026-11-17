import type { Initiative } from './derived'

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function formatInitiative({ score, dice }: Initiative) {
  return `${score} + ${dice}D6`
}

export function armorHint(armor: number) {
  return armor > 0 ? `incl. armor ${armor}` : 'no armor equipped'
}

/** A dice pool after wound modifiers; never below zero. */
export function formatPool(pool: number, wounds: number) {
  return Math.max(0, pool + wounds)
}

/** "1 day", "2 weeks", "1 month and 5 days". */
export function formatDays(days: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (days >= 30) {
    const months = Math.floor(days / 30)
    const rest = days % 30
    return rest ? `${plural(months, 'month')} and ${plural(rest, 'day')}` : plural(months, 'month')
  }
  if (days >= 7 && days % 7 === 0) return plural(days / 7, 'week')
  return plural(days, 'day')
}
