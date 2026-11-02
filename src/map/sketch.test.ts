import { describe, expect, it } from 'vitest'
import { addPoint, changedSinceShown, emptySketch, SketchStrokeSchema, touches } from './sketch'

describe('sketch pad', () => {
  it('keeps pen paths small by skipping points that barely moved', () => {
    let points: number[] = []
    for (const [x, y] of [
      [0, 0],
      [1, 1],
      [10, 0],
      [11, 0],
      [20, 5],
    ])
      points = addPoint(points, x, y)
    expect(points).toEqual([0, 0, 10, 0, 20, 5])
  })

  it('erases a stroke when the eraser touches it, not when it’s near the middle of a box', () => {
    const line = SketchStrokeSchema.parse({ kind: 'line', points: [100, 100, 300, 100] })
    const box = SketchStrokeSchema.parse({ kind: 'box', points: [100, 100, 300, 300] })
    const text = SketchStrokeSchema.parse({ kind: 'text', points: [500, 500], text: 'Door' })
    expect(touches(line, 200, 108)).toBe(true)
    expect(touches(line, 200, 140)).toBe(false)
    expect(touches(box, 300, 200)).toBe(true)
    expect(touches(box, 200, 200)).toBe(false)
    expect(touches(text, 510, 505)).toBe(true)
  })

  it('knows when the pad has changed since the players got it', () => {
    const stroke = SketchStrokeSchema.parse({ kind: 'line', points: [0, 0, 5, 5] })
    const shown = { ...emptySketch(), strokes: [stroke], shown: JSON.stringify([stroke]) }
    expect(changedSinceShown(shown)).toBe(false)
    expect(changedSinceShown({ ...shown, strokes: [] })).toBe(true)
    expect(changedSinceShown(emptySketch())).toBe(false)
  })
})
