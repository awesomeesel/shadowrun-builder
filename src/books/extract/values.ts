import type { RatingRange, Scaled } from './types'

/** "435¥", "1,500¥", "Rating x 55,000¥", "Rating × 0.75" → Scaled. */
export function parseScaled(text: string): Scaled | null {
  const t = text.replace(/[¥,]/g, '').trim()
  const squared = /rating\s*(?:\^\s*2|²)/i.test(t)
  const perRating = squared || /rating\s*[x×*]/i.test(t)
  const number = t.replace(/rating\s*(?:\^\s*2|²)/i, '').match(/\d+(?:\.\d+)?/)
  if (!number) return null
  return squared ? { base: parseFloat(number[0]), perRating, squared } : { base: parseFloat(number[0]), perRating }
}

/** "1–3" → {1, 3}; "4" → {4, 4}; "n/a" or "—" → null. */
export function parseRatingRange(text: string): RatingRange | null {
  const t = text.trim()
  const range = t.match(/^(\d+)\s*[–—-]\s*(\d+)$/)
  if (range) return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) }
  if (/^\d+$/.test(t)) return { min: parseInt(t, 10), max: parseInt(t, 10) }
  return null
}

/** "10/10/8/—/—" → [10, 10, 8, null, null]. Tolerates a missing slash like "9/8/6—/—". */
export function parseAttackRatings(text: string): (number | null)[] {
  const parts = text
    .replace(/(\d)([–—])/g, '$1/$2')
    .split('/')
    .map((p) => p.trim())
  const result = parts.slice(0, 5).map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : null))
  while (result.length < 5) result.push(null)
  return result
}

/** First integer in the text, or 0 for "—", "n/a" and blanks. */
export function parseInt0(text: string): number {
  const match = text.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

/** Value of a Scaled at a given rating. */
export function atRating(value: Scaled | null, rating: number): number {
  if (!value) return 0
  const r = Math.max(1, rating)
  if (!value.perRating) return value.base
  return value.base * (value.squared ? r * r : r)
}

/** Convert book typesetting quirks (ligature splits, odd spaces) into clean names. */
export function cleanName(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*\[.*$/, '')
    .trim()
}
