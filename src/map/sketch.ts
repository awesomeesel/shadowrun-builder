/**
 * The GM's sketch pad: a quick drawing to give the players the general idea
 * of a place (one per campaign, like a whiteboard). Drawn on a 1000 × 700
 * canvas, so it scales to any screen. Nothing snaps; it's meant to be rough.
 */
import { z } from 'zod'

export const SKETCH_WIDTH = 1000
export const SKETCH_HEIGHT = 700

export const SketchStrokeSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  kind: z.enum(['pen', 'line', 'box', 'text']),
  color: z.string().default('#e6edf3'),
  /** Flat x, y pairs: a pen's path, a line's two ends, a box's opposite corners, a text's spot. */
  points: z.array(z.number()).default([]),
  text: z.string().default(''),
})

export const SketchSchema = z.object({
  strokes: z.array(SketchStrokeSchema).default([]),
  /** The strokes the players last got, as JSON; empty when not shown. */
  shown: z.string().default(''),
  shownAt: z.string().default(''),
})

export type SketchStroke = z.infer<typeof SketchStrokeSchema>
export type Sketch = z.infer<typeof SketchSchema>

export const SKETCH_COLORS = [
  { color: '#e6edf3', label: 'White' },
  { color: '#3ee8b5', label: 'Green' },
  { color: '#ffb547', label: 'Amber' },
  { color: '#ff5c7a', label: 'Red' },
  { color: '#4ea8ff', label: 'Blue' },
]

export function emptySketch(): Sketch {
  return SketchSchema.parse({})
}

/** What the players see differs from the pad. */
export const changedSinceShown = (s: Sketch) => !!s.shown && s.shown !== JSON.stringify(s.strokes)

/** Leave out points closer than this to the last one kept, so pen paths stay small. */
const MIN_STEP = 3

/** Add a point to a pen path, unless it's barely moved. */
export function addPoint(points: number[], x: number, y: number): number[] {
  const n = points.length
  if (n >= 2 && Math.hypot(x - points[n - 2], y - points[n - 1]) < MIN_STEP) return points
  return [...points, Math.round(x), Math.round(y)]
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Whether the eraser at (x, y) touches a stroke. */
export function touches(stroke: SketchStroke, x: number, y: number, reach = 12): boolean {
  const p = stroke.points
  if (stroke.kind === 'text') {
    // Text sits centred on its spot; about 13 units a letter at the drawn size.
    const half = (stroke.text.length * 13) / 2 + reach
    return Math.abs(x - p[0]) <= half && Math.abs(y - p[1]) <= 20 + reach
  }
  if (stroke.kind === 'box') {
    const [x1, y1, x2, y2] = p
    const corners = [x1, y1, x2, y1, x2, y2, x1, y2, x1, y1]
    for (let i = 0; i < 8; i += 2) {
      if (distanceToSegment(x, y, corners[i], corners[i + 1], corners[i + 2], corners[i + 3]) <= reach) return true
    }
    return false
  }
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distanceToSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true
  }
  return false
}
