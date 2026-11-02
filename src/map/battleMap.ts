/**
 * A quick battle mat for an encounter: a grid with a few simple shapes on it
 * (walls, areas, circles, labels) and tokens for the combatants. Coordinates
 * are in grid squares from the top-left corner; tokens sit in square centres.
 */
import { z } from 'zod'

export const SHAPE_KINDS = ['wall', 'rect', 'circle', 'text'] as const

export const MapShapeSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  kind: z.enum(SHAPE_KINDS),
  /** Wall: from (x1, y1) to (x2, y2). Area: opposite corners. Circle: centre and a point on the edge. Text: its spot. */
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  color: z.string().default('stone'),
  text: z.string().default(''),
})

export const MapTokenSchema = z.object({
  /** The encounter participant it stands for. */
  id: z.string(),
  x: z.number(),
  y: z.number(),
})

export const BattleMapSchema = z.object({
  cols: z.number().int().min(4).max(80).default(30),
  rows: z.number().int().min(4).max(80).default(20),
  /** Meters per square. */
  meters: z.number().min(0.5).max(10).default(2),
  shapes: z.array(MapShapeSchema).default([]),
  tokens: z.array(MapTokenSchema).default([]),
  /** Shown to the players in the campaign. */
  shown: z.boolean().default(false),
})

export type BattleMap = z.infer<typeof BattleMapSchema>
export type MapShape = z.infer<typeof MapShapeSchema>
export type MapToken = z.infer<typeof MapTokenSchema>

/** A token as drawn: who it is and how to show them. Also what players receive. */
export interface TokenView {
  id: string
  x: number
  y: number
  name: string
  side: 'runner' | 'enemy' | 'other'
  /** Out of the fight: drawn faded. */
  out: boolean
  /** Whose turn it is. */
  active: boolean
  /** For a runner shared by a player: their character id, so their own token can stand out. */
  characterId?: string
}

/** Colors, named so the theme can draw them. */
export const MAP_COLORS: { id: string; label: string; stroke: string; fill: string }[] = [
  { id: 'stone', label: 'Walls & buildings', stroke: '#9aa4b5', fill: '#9aa4b533' },
  { id: 'cover', label: 'Cover & objects', stroke: '#ffb547', fill: '#ffb54733' },
  { id: 'water', label: 'Water', stroke: '#4ea8ff', fill: '#4ea8ff33' },
  { id: 'green', label: 'Trees & plants', stroke: '#3ee8b5', fill: '#3ee8b533' },
  { id: 'danger', label: 'Danger', stroke: '#ff5c7a', fill: '#ff5c7a33' },
]

export const colorOf = (id: string) => MAP_COLORS.find((c) => c.id === id) ?? MAP_COLORS[0]

export function newMap(): BattleMap {
  return BattleMapSchema.parse({})
}

/** Snap to the nearest grid line crossing (walls, area corners). */
export const snapCorner = (v: number) => Math.round(v)
/** Snap to the nearest half square (circle centres and sizes). */
export const snapHalf = (v: number) => Math.round(v * 2) / 2
/** The square a point is in. */
export const cellOf = (v: number) => Math.floor(v)

/** Distance in meters between two points, using the map's scale. */
export function meters(map: Pick<BattleMap, 'meters'>, ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay) * map.meters
}

/** SR6 range categories (Core Rulebook p. 109): Close 0–3 m, Near 4–50, Medium 51–250, Far 251–500, Extreme beyond. */
export function rangeBand(m: number): 'Close' | 'Near' | 'Medium' | 'Far' | 'Extreme' {
  if (m <= 3) return 'Close'
  if (m <= 50) return 'Near'
  if (m <= 250) return 'Medium'
  if (m <= 500) return 'Far'
  return 'Extreme'
}

/** Keep a point on the map. */
export function clampTo(map: Pick<BattleMap, 'cols' | 'rows'>, x: number, y: number): [number, number] {
  return [Math.min(Math.max(0, x), map.cols), Math.min(Math.max(0, y), map.rows)]
}

/** Place or move a token in a square, one token per combatant. */
export function placeToken(map: BattleMap, id: string, x: number, y: number): BattleMap {
  const [cx, cy] = clampTo(map, cellOf(x), cellOf(y))
  const token = { id, x: Math.min(cx, map.cols - 1) + 0.5, y: Math.min(cy, map.rows - 1) + 0.5 }
  return { ...map, tokens: [...map.tokens.filter((t) => t.id !== id), token] }
}

/** Move a shape by whole squares. */
export function moveShape(shape: MapShape, dx: number, dy: number): MapShape {
  return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy }
}

/** A drawn shape is worth keeping: not a click without a drag. */
export function isUseful(shape: MapShape): boolean {
  if (shape.kind === 'text') return shape.text.trim().length > 0
  return shape.x1 !== shape.x2 || shape.y1 !== shape.y2
}
