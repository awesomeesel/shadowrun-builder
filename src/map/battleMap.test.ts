import { describe, expect, it } from 'vitest'
import { isUseful, meters, MapShapeSchema, moveShape, newMap, placeToken, rangeBand } from './battleMap'

describe('battle map', () => {
  it('measures in meters and names the SR6 range band (p. 109)', () => {
    const map = { ...newMap(), meters: 2 }
    expect(meters(map, 0, 0, 3, 4)).toBe(10)
    expect([3, 4, 50, 51, 250, 251, 500, 501].map(rangeBand)).toEqual([
      'Close',
      'Near',
      'Near',
      'Medium',
      'Medium',
      'Far',
      'Far',
      'Extreme',
    ])
  })

  it('places one token per combatant in a square’s centre, on the map', () => {
    let map = placeToken(newMap(), 'a', 3.7, 2.1)
    map = placeToken(map, 'a', 99, -5)
    expect(map.tokens).toEqual([{ id: 'a', x: 29.5, y: 0.5 }])
  })

  it('moves shapes and ignores clicks that drew nothing', () => {
    const wall = MapShapeSchema.parse({ kind: 'wall', x1: 1, y1: 1, x2: 1, y2: 1 })
    expect(isUseful(wall)).toBe(false)
    expect(moveShape({ ...wall, x2: 4 }, 2, 1)).toMatchObject({ x1: 3, y1: 2, x2: 6, y2: 2 })
    expect(isUseful(MapShapeSchema.parse({ kind: 'text', x1: 0, y1: 0, x2: 0, y2: 0, text: ' ' }))).toBe(false)
  })
})
