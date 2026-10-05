import type { MetatypeId } from '../rules/sr6/metatypes'

/** Accent colour per metatype, used for portraits and chips. */
export const METATYPE_COLORS: Record<MetatypeId, string> = {
  human: '#3ee8b5',
  elf: '#a78bfa',
  dwarf: '#ffb547',
  ork: '#7ddc4b',
  troll: '#ff3ea5',
}
