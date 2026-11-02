import type { Participant } from '../model/encounter'
import { parseWeapons, splitTop } from '../rules/sr6/npc'

export interface LootSource {
  /** The participant it comes from. */
  id: string
  name: string
  /** Down or out of the fight: their gear is up for grabs. */
  down: boolean
  items: string[]
}

/** What each enemy with a stat block carries: weapons first, then gear. */
export function lootFrom(participants: Participant[], isDown: (p: Participant) => boolean): LootSource[] {
  return participants.flatMap((p) => {
    if (!p.npc) return []
    const weapons = parseWeapons(p.npc.weapons ?? '').map((w) => w.name)
    const gear = splitTop((p.npc.gear ?? '').replace(/Starting Nuyen:.*$/i, ''))
      // A stray ")" the book left at the end of a list, as in "Yamaha Growler)".
      .map((g) => (g.includes('(') ? g : g.replace(/\)+$/, '')).trim())
      .filter(Boolean)
    const items = [...weapons, ...gear].filter((item, i, all) => item && all.indexOf(item) === i)
    return items.length ? [{ id: p.id, name: p.name, down: p.out || isDown(p), items }] : []
  })
}

/** Split nuyen as evenly as whole nuyen allow; the first ones get the odd nuyen. */
export function splitNuyen(total: number, ways: number): number[] {
  if (ways <= 0) return []
  const share = Math.floor(total / ways)
  return Array.from({ length: ways }, (_, i) => share + (i < total - share * ways ? 1 : 0))
}
