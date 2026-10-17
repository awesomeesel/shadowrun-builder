/**
 * Using book stat blocks at the table: dice pools from their skills and
 * weapons, and the numbers the GM needs when the block leaves them out.
 * Grunt rules: Core Rulebook p. 203.
 */
import type { ExtractedEntry } from '../../books/extract/types'
import { SKILLS } from './skills'

export type NpcEntry = Extract<ExtractedEntry, { kind: 'npc' }>

export interface NpcSkill {
  name: string
  rating: number
  /** Specializations and expertise, e.g. [{ name: 'Pistols', bonus: 2 }]. */
  specs: { name: string; bonus: number }[]
}

export interface NpcWeapon {
  name: string
  /** Weapon type as printed, e.g. "Light Pistol", "Club". */
  type: string
  damage: string
  modes: string
  attackRatings: (number | null)[]
  skill: string
}

/** Split on commas that aren't inside brackets or parentheses. */
function splitTop(text: string, separator = ','): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if (ch === separator && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** "Close Combat 8 (Blades +2) (Clubs +2)" → name, rating and specializations. */
export function parseSkills(text: string): NpcSkill[] {
  return splitTop(text).flatMap((part) => {
    const match = part.match(/^(.+?)\s+(\d+)\s*(.*)$/)
    if (!match) return []
    const specs = [...match[3].matchAll(/\(([^()]+?)\s*\+(\d+)\)/g)].map((m) => ({
      name: m[1].trim(),
      bonus: parseInt(m[2], 10),
    }))
    return [{ name: match[1].trim(), rating: parseInt(match[2], 10), specs }]
  })
}

const ATTRIBUTE_FOR_SKILL = new Map(SKILLS.map((s) => [s.name.toLowerCase(), s.attribute as string]))
ATTRIBUTE_FOR_SKILL.set('exotic ranged weapon', 'agility')
ATTRIBUTE_FOR_SKILL.set('unarmed combat', 'agility')

/** Which skill a weapon type uses. */
function weaponSkill(type: string): string {
  if (/pistol|rifle|smg|submachine|shotgun|machine gun|assault|sniper|taser|gun/i.test(type)) return 'Firearms'
  if (/bow|throw|thrown/i.test(type)) return 'Athletics'
  if (/exotic|launcher|grenade/i.test(type)) return 'Exotic Weapons'
  return 'Close Combat'
}

/** "8/8/6/—/—" → [8, 8, 6, null, null]. */
function ratings(text: string): (number | null)[] {
  const values = text.split('/').map((v) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  })
  return [0, 1, 2, 3, 4].map((i) => values[i] ?? null)
}

/**
 * Weapons as printed in stat blocks: "Colt America L36 [Light Pistol, DV 2P,
 * SA, Attack Ratings 8/8/6/—/—]" for grunts, or "Claws: DV 3P, Attack Ratings
 * 9/—/—/—/—; Bite: DV 4P, Attack Rating 9" for critters.
 */
export function parseWeapons(text: string): NpcWeapon[] {
  const weapons: NpcWeapon[] = []
  // Grenades are listed without brackets: "Fragmentation grenade (DV: 16P, 12P, 8P; Blast 20m)".
  for (const m of text.matchAll(/([A-Za-z][\w\s-]*?grenade)s?\s*\(DV:\s*([^;)]+);\s*Blast\s*([^)]+)\)/gi)) {
    weapons.push({
      name: m[1].replace(/^.*?\d+\s*x\s*/i, '').trim(),
      type: `Grenade, blast ${m[3].trim()}`,
      damage: m[2]
        .split(',')
        .map((d) => d.trim())
        .join('/'),
      modes: '',
      attackRatings: [null, null, null, null, null],
      skill: 'Athletics',
    })
  }
  const withoutGrenades = text.replace(/[A-Za-z][\w\s-]*?grenades?\s*\(DV:[^)]*\),?/gi, '')
  const parts = withoutGrenades.split('[')
  if (parts.length > 1) {
    for (let k = 1; k < parts.length; k++) {
      // The name is what follows the previous weapon's closing bracket.
      const name = (parts[k - 1].split(']').pop() ?? '').replace(/^[\s,;)]+/, '').trim()
      // Some lines close with ")" by mistake, so stop at "]" or at the end.
      const inner = parts[k].split(']')[0]
      const type = inner.split(',')[0].trim()
      weapons.push({
        name,
        type,
        damage: inner.match(/DV\s*([^,\]]+?)(?:,|$)/)?.[1]?.trim() ?? '',
        modes: inner.match(/\b((?:SS|SA|BF|FA)(?:\/(?:SS|SA|BF|FA))*)\b/)?.[1] ?? '',
        attackRatings: ratings(inner.match(/(\d+\*?\/[\d—–\-*]+(?:\/[\d—–\-*\s]+){0,3})/)?.[1] ?? ''),
        skill: weaponSkill(type),
      })
    }
    return weapons
  }
  return weapons.concat(
    splitTop(text, ';').flatMap((part) => {
      const match = part.match(/^([^:]+):\s*DV\s*([^,]+),\s*Attack Ratings?\s*([\d—–\-/]+)/i)
      if (!match) return []
      return [
        {
          name: match[1].trim(),
          type: 'Natural weapon',
          damage: match[2].trim(),
          modes: '',
          attackRatings: ratings(match[3]),
          skill: 'Close Combat',
        },
      ]
    }),
  )
}

export interface NpcPool {
  label: string
  pool: number
  /** Extra line for the roll result, e.g. damage and Attack Ratings. */
  info?: string
  /** Damage resistance doesn't take wound modifiers. */
  ignoreWounds?: boolean
}

export interface NpcStats {
  attributes: Record<string, number>
  initiative: { score: number; dice: number }
  defenseRating: number
  /** Grunts and simple critters have one track; others have Physical and Stun. */
  monitor: { physical: number; stun: number | null }
  /** Boxes per wound modifier step: 2 for grunts (p. 203), 3 for everyone else. */
  woundStep: number
  isGrunt: boolean
  skills: NpcSkill[]
  weapons: NpcWeapon[]
  pools: NpcPool[]
  /** Starting Edge: the Professional Rating for a grunt group (shared), or the Edge attribute. */
  edge: number
}

/** Fill in what a stat block leaves out and work out the pools the GM rolls. */
export function npcStats(entry: NpcEntry): NpcStats {
  const a: Record<string, number> = {}
  for (const [key, value] of Object.entries(entry.attributes)) a[key] = value.augmented
  const isGrunt = entry.professionalRating !== null
  const body = a.body ?? 1
  const willpower = a.willpower ?? 1
  const physical =
    entry.monitor.physical ?? (isGrunt ? 8 + Math.ceil(Math.max(body, willpower) / 2) : 8 + Math.ceil(body / 2))
  const stun = isGrunt
    ? null
    : (entry.monitor.stun ?? (entry.monitor.physical === null ? 8 + Math.ceil(willpower / 2) : null))
  const skills = parseSkills(entry.skills)
  const weapons = parseWeapons(entry.weapons)
  const skillPool = (name: string) => {
    const skill = skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
    const attribute = a[ATTRIBUTE_FOR_SKILL.get(name.toLowerCase()) ?? 'agility'] ?? 0
    // Untrained: attribute − 1 (assumed for NPCs without the skill).
    return skill ? skill.rating + attribute : Math.max(0, attribute - 1)
  }
  const pools: NpcPool[] = [
    { label: 'Defense', pool: (a.reaction ?? 0) + (a.intuition ?? 0) },
    { label: 'Soak', pool: body, ignoreWounds: true },
    ...weapons.map((w) => {
      const skill = skills.find((s) => s.name.toLowerCase() === w.skill.toLowerCase())
      const covers = (name: string) => w.type.toLowerCase().includes(name.toLowerCase().replace(/s$/, ''))
      // A matching specialization (e.g. "Pistols" for a Light Pistol) adds its bonus.
      const spec = skill?.specs.find((sp) => covers(sp.name))
      // Sample characters sometimes list the weapon group as the skill ("Pistols 2").
      const group = skill ? undefined : skills.find((s) => covers(s.name))
      const pool = group ? group.rating + (a.agility ?? 0) : skillPool(w.skill) + (spec?.bonus ?? 0)
      return {
        label: w.name,
        pool,
        info: `DV ${w.damage || '?'} + net hits · AR ${w.attackRatings.map((r) => r ?? '–').join('/')}`,
      }
    }),
    ...skills
      .filter((s) => !weapons.some((w) => w.skill.toLowerCase() === s.name.toLowerCase()))
      .map((s) => ({ label: s.name, pool: skillPool(s.name) })),
  ]
  return {
    attributes: a,
    initiative: entry.initiative ?? { score: (a.reaction ?? 0) + (a.intuition ?? 0), dice: 1 },
    defenseRating: entry.defenseRating ?? body,
    monitor: { physical, stun },
    woundStep: isGrunt ? 2 : 3,
    isGrunt,
    skills,
    weapons,
    pools,
    edge: isGrunt ? (entry.professionalRating ?? 0) : (a.edge ?? 0),
  }
}
