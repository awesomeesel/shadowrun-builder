import type { Encounter, Participant } from '../model/encounter'
import type { TokenView } from './battleMap'

/** Runners on the players' side; spirits could be either, so they get their own color. */
export function sideOf(p: Pick<Participant, 'kind'>): TokenView['side'] {
  if (p.kind === 'runner') return 'runner'
  if (p.kind === 'spirit') return 'other'
  return 'enemy'
}

/**
 * The tokens on an encounter's map, with the names and states to draw.
 * `characterIdOf` gives a shared runner's character id (players use it to
 * find their own token).
 */
export function tokenViews(
  encounter: Pick<Encounter, 'map' | 'participants' | 'activeId'>,
  characterIdOf: (p: Participant) => string | undefined = () => undefined,
): TokenView[] {
  const byId = new Map(encounter.participants.map((p) => [p.id, p]))
  return (encounter.map?.tokens ?? []).flatMap((t) => {
    const p = byId.get(t.id)
    if (!p) return []
    return [
      {
        id: t.id,
        x: t.x,
        y: t.y,
        name: p.name,
        side: sideOf(p),
        out: p.out,
        active: encounter.activeId === p.id,
        characterId: characterIdOf(p),
      },
    ]
  })
}

/** Up to two letters for a token: "Buck Digas" → "BD", "Ganger 3" → "G3". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
