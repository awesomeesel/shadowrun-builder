/**
 * Fill in what imported characters lack (quality karma, prices) by looking up
 * items by name in the user's book catalog.
 */
import type { CatalogEntry } from '../db/db'
import type { Character } from '../model/character'
import { atRating } from './extract/values'

/** Lower-case, without punctuation or a trailing rating, for matching names across tools. */
function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(rating\s*)?\d+$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Lower-case words only, keeping numbers: "Wired Reflexes 2" → "wired reflexes 2". */
function exact(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function enrichFromCatalog(
  character: Character,
  catalog: CatalogEntry[],
): { character: Character; filled: number } {
  const loose = new Map<string, CatalogEntry>()
  const strict = new Map<string, CatalogEntry>()
  for (const entry of catalog) {
    const k = `${entry.kind}|${key(entry.name)}`
    if (!loose.has(k)) loose.set(k, entry)
    strict.set(`${entry.kind}|${exact(entry.name)}`, entry)
  }
  /** Prefer "Name rating" (e.g. "Wired Reflexes 2"), then the exact name, then a looser match. */
  const find = (kinds: string[], name: string, rating = 0) => {
    for (const kind of kinds) {
      const hit =
        (rating ? strict.get(`${kind}|${exact(`${name} ${rating}`)}`) : undefined) ??
        strict.get(`${kind}|${exact(name)}`) ??
        loose.get(`${kind}|${key(name)}`)
      if (hit) return hit
    }
    return undefined
  }
  let filled = 0

  const qualities = character.qualities.map((q) => {
    const entry = find(['quality'], q.name)
    if (q.karma || entry?.kind !== 'quality' || !entry.karma) return q
    filled++
    return { ...q, karma: entry.perLevel ? entry.karma * q.rating : entry.karma }
  })
  const weapons = character.weapons.map((w) => {
    const entry = find(['weapon'], w.name)
    if (w.cost || !entry || !('cost' in entry) || !entry.cost) return w
    filled++
    return { ...w, cost: Math.round(atRating(entry.cost, 0)) }
  })
  const gear = character.gear.map((g) => {
    const entry = find(['armor', 'gear'], g.name, g.rating)
    if (g.cost || !entry || !('cost' in entry) || !entry.cost) return g
    filled++
    return { ...g, cost: Math.round(atRating(entry.cost, g.rating)) }
  })
  const augmentations = character.augmentations.map((a) => {
    const entry = find(['augmentation'], a.name, a.rating)
    if (a.cost || entry?.kind !== 'augmentation' || !entry.cost) return a
    filled++
    // Our cost field is the printed price; the grade multiplier is applied when totals are added up.
    return { ...a, cost: Math.round(atRating(entry.cost, a.rating)) }
  })

  return { character: { ...character, qualities, weapons, gear, augmentations }, filled }
}
