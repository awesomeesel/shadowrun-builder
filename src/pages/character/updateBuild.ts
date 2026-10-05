import type { Build, Character } from '../../model/character'
import { applyBuild } from '../../rules/sr6/build'
import type { Update } from './CharacterPage'

export type UpdateBuild = (change: (build: Build, character: Character) => void) => void

/** Mutate a copy of the build (and character, e.g. metatype), then re-derive attributes and skills. */
export function makeUpdateBuild(update: Update): UpdateBuild {
  return (change) =>
    update((c) => {
      const next = { ...c, build: structuredClone(c.build!) }
      change(next.build, next)
      return applyBuild(next)
    })
}
