import { describe, expect, it } from 'vitest'
import { atRating, parseScaled } from './values'

describe('parseScaled', () => {
  it('reads plain and per-rating values', () => {
    expect(parseScaled('1,500¥')).toEqual({ base: 1500, perRating: false })
    expect(parseScaled('Rating x 4,000¥')).toEqual({ base: 4000, perRating: true })
    expect(parseScaled('Rating × 0.75')).toEqual({ base: 0.75, perRating: true })
  })

  it('reads a value printed with a leading dot (dermal plating)', () => {
    const essence = parseScaled('Rating x .3')
    expect(essence).toEqual({ base: 0.3, perRating: true })
    expect(atRating(essence, 3)).toBeCloseTo(0.9)
  })
})
