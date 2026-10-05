/**
 * "Quick make": builds a complete, rules-legal character for a role in one go,
 * using the same build model and checks as the wizard.
 */
import type { CatalogEntry } from '../../db/db'
import {
  ContactSchema,
  createCharacter,
  KnowledgeSkillSchema,
  LanguageSchema,
  type Build,
  type Character,
} from '../../model/character'
import type { EntryKind } from '../../books/extract'
import { atRating } from '../../books/extract/values'
import { ratingRange, TARGET_LIST, type PickOptions, type TargetList } from '../../books/toCharacter'
import { MENTAL_ATTRIBUTES, PHYSICAL_ATTRIBUTES, type AttributeId } from './attributes'
import { applyBuild, buildAttributeValue, canUseAdjustment, evaluateBuild, finishBuild, startBuild } from './build'
import { CREATION_RULES, MAGIC_TYPES, PRIORITY_TABLE } from './creation'
import { computeDerived } from './derived'
import { attributeMaximum, type MetatypeId } from './metatypes'
import type { RoleDef } from './roles'
import { AUGMENTATION_GRADES, SPECIAL_CREATION_RULES } from './special'

const POINT_ATTRIBUTES: AttributeId[] = [...PHYSICAL_ATTRIBUTES, ...MENTAL_ATTRIBUTES]

/** Sensible first specialization per skill. */
const DEFAULT_SPECIALIZATIONS: Record<string, string> = {
  firearms: 'Pistols',
  'close-combat': 'Blades',
  athletics: 'Running',
  stealth: 'Sneaking',
  perception: 'Visual',
  sorcery: 'Spellcasting',
  conjuring: 'Summoning',
  astral: 'Astral Combat',
  cracking: 'Hacking',
  electronics: 'Computer',
  tasking: 'Compiling',
  piloting: 'Ground Craft',
  engineering: 'Ground Craft',
  influence: 'Negotiation',
  con: 'Acting',
}

/** Skills that suit anyone, used for leftover skill points. */
const FILLER_SKILLS = ['perception', 'athletics', 'stealth', 'firearms', 'influence']

const KNOWLEDGE: Record<string, string[]> = {
  samurai: ['Seattle gangs', 'Weapon manufacturers', 'Corporate security tactics', 'Street drugs'],
  adept: ['Martial arts styles', 'Seattle gangs', 'Meditation', 'Parkour routes'],
  mage: ['Magical theory', 'Spirits', 'Magical threats', 'Seattle history'],
  shaman: ['Spirits', 'Local wildlife', 'Seattle gangs', 'Herbal remedies'],
  decker: ['Matrix security', 'Corporate hosts', 'Hacker groups', 'Data havens'],
  technomancer: ['Matrix security', 'Hacker groups', 'Corporate hosts', 'Technomancer lore'],
  rigger: ['Vehicle models', 'Smuggling routes', 'Drone manufacturers', 'Seattle roads'],
  face: ['Corporate politics', 'Seattle nightlife', 'Fashion', 'Underworld etiquette'],
  infiltrator: ['Security systems', 'Building layouts', 'Corporate security tactics', 'Seattle rooftops'],
}

const NAMES = [
  'Ash',
  'Blitz',
  'Cipher',
  'Echo',
  'Ghost',
  'Glitch',
  'Hex',
  'Jinx',
  'Kestrel',
  'Neon',
  'Nova',
  'Raven',
  'Razor',
  'Rook',
  'Shade',
  'Spike',
  'Static',
  'Torque',
  'Viper',
  'Wire',
  'Zero',
  'Mako',
  'Quill',
  'Sable',
]

export function randomStreetName(random: () => number = Math.random): string {
  return NAMES[Math.floor(random() * NAMES.length)]
}

export interface QuickBuildOptions {
  role: RoleDef
  metatype: MetatypeId
  name: string
  /** The user's book catalog; without it no qualities, magic or gear are picked. */
  catalog?: CatalogEntry[]
  /** Turns a catalog entry into a character item (with page reference). */
  toItem?: (entry: CatalogEntry, options: PickOptions) => { list: TargetList; item: unknown }
}

export interface QuickBuildResult {
  character: Character
  /** Things the user should know, e.g. that no books were available for gear. */
  notes: string[]
}

/** Build a legal character for the role. The result is still in build mode; call finishBuild to play. */
export function quickBuild(options: QuickBuildOptions): QuickBuildResult {
  const { role, metatype, name } = options
  const notes: string[] = []
  let c = startBuild(createCharacter({ name: name.trim() || 'Unnamed runner', metatype, concept: role.name }))
  const edit = (change: (b: Build, ch: Character) => void) => {
    const next = { ...c, build: structuredClone(c.build!) }
    change(next.build, next)
    c = applyBuild(next)
  }

  edit((b, ch) => {
    b.role = role.id
    b.priorities = { ...role.priorities }
    b.magicType = role.magicType
    if (role.tradition) ch.tradition = role.tradition
  })
  if (!PRIORITY_TABLE[role.priorities.metatype].metatypes.includes(metatype)) {
    edit((_, ch) => {
      ch.metatype = role.metatypes[0]
    })
    notes.push(`${metatype} isn't available with these priorities, so the runner is a ${role.metatypes[0]}.`)
  }

  allocateAttributes(c, role, edit)
  allocateSkills(role, edit)
  addKnowledge(c, role, edit)
  addContacts(c, role, edit)

  if (options.catalog && options.toItem && options.catalog.length > 0) {
    c = pickFromCatalog(c, role, options.catalog, options.toItem)
  } else {
    notes.push('No rulebooks in the Library, so no qualities, spells or gear were picked. Add them on the Edit tab.')
  }

  // Never hand back an illegal character: drop catalog picks until the checks pass.
  c = repair(c)
  return { character: c, notes }
}

/** Quick-build and finish in one step, ready for play. */
export function quickMake(options: QuickBuildOptions): QuickBuildResult {
  const result = quickBuild(options)
  return { ...result, character: finishBuild(result.character) }
}

type Edit = (change: (b: Build, ch: Character) => void) => void

function allocateAttributes(c: Character, role: RoleDef, edit: Edit) {
  const build = c.build!
  const max = (a: AttributeId) => attributeMaximum(c.metatype, a)
  const awakened = MAGIC_TYPES[build.magicType].attribute
  const keys = role.keyAttributes.filter((a) => POINT_ATTRIBUTES.includes(a))

  edit((b, ch) => {
    // Adjustment points: Magic/Resonance first, then the metatype's special attributes, then Edge.
    let adjustment = PRIORITY_TABLE[b.priorities.metatype].adjustmentPoints
    const adjustOrder: AttributeId[] = [
      ...(awakened ? [awakened as AttributeId] : []),
      ...keys.filter((a) => canUseAdjustment(ch, b, a)),
      ...POINT_ATTRIBUTES.filter((a) => !keys.includes(a) && canUseAdjustment(ch, b, a)),
      'edge',
    ]
    for (const a of adjustOrder) {
      // Stay one below the maximum (Magic may reach it: it doesn't count toward the one-at-max rule).
      const cap = a === 'magic' || a === 'resonance' ? max(a) : max(a) - 1
      while (adjustment > 0 && buildAttributeValue(b, a) < cap) {
        b.attributes[a].adjustment++
        adjustment--
      }
    }

    // Attribute points: everything to 2, key attributes up toward their maximum, then the rest.
    let points = PRIORITY_TABLE[b.priorities.attributes].attributePoints
    const raise = (a: AttributeId, cap: number) => {
      if (points > 0 && buildAttributeValue(b, a) < cap) {
        b.attributes[a].points++
        points--
        return true
      }
      return false
    }
    for (const a of POINT_ATTRIBUTES) raise(a, 2)
    for (let progress = true; progress && points > 0;) {
      progress = false
      for (const a of keys) progress = raise(a, max(a) - 1) || progress
    }
    for (let progress = true; progress && points > 0;) {
      progress = false
      for (const a of POINT_ATTRIBUTES) progress = raise(a, Math.min(4, max(a) - 1)) || progress
    }
    // Only one attribute may sit at its maximum: give it to the most important one.
    if (keys[0]) raise(keys[0], max(keys[0]))
    for (let progress = true; progress && points > 0;) {
      progress = false
      for (const a of POINT_ATTRIBUTES) progress = raise(a, max(a) - 1) || progress
    }
  })
}

function allocateSkills(role: RoleDef, edit: Edit) {
  edit((b, ch) => {
    let points = PRIORITY_TABLE[b.priorities.skills].skillPoints
    const add = (skillId: string) => {
      const existing = ch.skills.find((s) => s.skillId === skillId)
      if (existing) return existing.id
      const id = crypto.randomUUID()
      ch.skills = [...ch.skills, { id, skillId, rating: 0, specialization: '', expertise: '' }]
      b.skills[id] = { adjustment: 0, points: 0, karma: 0 }
      return id
    }
    const ids = role.keySkills.map(add)
    // One specialization on the main skill: +2 dice for a single point.
    const main = ch.skills.find((s) => s.id === ids[0])!
    main.specialization = DEFAULT_SPECIALIZATIONS[main.skillId] ?? ''
    if (main.specialization) points -= CREATION_RULES.specializationSkillPoints

    const raise = (id: string, cap: number) => {
      if (points > 0 && b.skills[id].points < cap) {
        b.skills[id].points++
        points--
        return true
      }
      return false
    }
    // Main skill can reach the creation maximum; the others stop one below it.
    const top = CREATION_RULES.maxSkillRating
    for (let progress = true; progress && points > 0;) {
      progress = false
      ids.forEach((id, i) => {
        progress = raise(id, i === 0 ? top : top - 2) || progress
      })
    }
    for (const skillId of FILLER_SKILLS) {
      if (points <= 0) break
      const id = add(skillId)
      while (raise(id, 3)) {
        /* fill up to 3 */
      }
    }
    // Still points left (Skills at A): raise everything toward 5, then specialise the other key skills.
    for (let progress = true; progress && points > 0;) {
      progress = false
      for (const s of ch.skills) progress = raise(s.id, top - 1) || progress
    }
    for (const s of ch.skills) {
      const spec = DEFAULT_SPECIALIZATIONS[s.skillId]
      if (
        points >= CREATION_RULES.specializationSkillPoints &&
        !s.specialization &&
        spec &&
        b.skills[s.id].points > 0
      ) {
        s.specialization = spec
        points -= CREATION_RULES.specializationSkillPoints
      }
    }
    // Drop skills that ended up without points.
    ch.skills = ch.skills.filter((s) => b.skills[s.id].points > 0)
  })
}

function addKnowledge(c: Character, role: RoleDef, edit: Edit) {
  const free = buildAttributeValue(c.build!, 'logic') * CREATION_RULES.freeKnowledgePerLogic
  edit((_, ch) => {
    ch.languages = [LanguageSchema.parse({ name: 'English', level: 'native' })]
    ch.knowledgeSkills = (KNOWLEDGE[role.id] ?? []).slice(0, free).map((name) => KnowledgeSkillSchema.parse({ name }))
  })
}

function addContacts(c: Character, role: RoleDef, edit: Edit) {
  const free = buildAttributeValue(c.build!, 'charisma') * CREATION_RULES.contactKarmaPerCharisma
  const count = Math.max(1, Math.min(role.contacts.length, Math.floor(free / 2)))
  const contacts = role.contacts.slice(0, count).map((r) => ContactSchema.parse({ role: r, connection: 1, loyalty: 1 }))
  // Share the free karma: alternate Connection and Loyalty, most important contact first.
  let left = free - count * 2
  for (let i = 0; left > 0 && i < 40; i++) {
    const contact = contacts[i % count]
    const field = Math.floor(i / count) % 2 === 0 ? 'connection' : 'loyalty'
    if (contact[field] < 6) {
      contact[field]++
      left--
    }
  }
  edit((_, ch) => {
    ch.contacts = contacts
  })
}

/**
 * Catalog entries with every word of the query at the start of a word, so "van" doesn't match
 * "Samuvani". Names are searched first, then categories, so "cyberdeck" finds the "Cyberdecks" table.
 */
function matches(catalog: CatalogEntry[], query: string, kinds: EntryKind[]) {
  const patterns = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  const test = (text: string) => patterns.every((p) => p.test(text.toLowerCase()))
  const ofKind = catalog.filter((e) => kinds.includes(e.kind))
  // Prefer name matches; fall back to the table/category name (e.g. "Cyberdecks").
  const byName = ofKind.filter((e) => test(e.name))
  return byName.length > 0 ? byName : ofKind.filter((e) => test(`${e.name} ${e.category}`))
}

function entryCost(entry: CatalogEntry, rating: number, grade: PickOptions['grade']) {
  if (!('cost' in entry)) return 0
  const base = atRating(entry.cost, rating)
  return entry.kind === 'augmentation' ? base * AUGMENTATION_GRADES[grade].cost : base
}

function pickFromCatalog(
  start: Character,
  role: RoleDef,
  catalog: CatalogEntry[],
  toItem: NonNullable<QuickBuildOptions['toItem']>,
): Character {
  let c = start
  const add = (entry: CatalogEntry, rating: number) => {
    const { list, item } = toItem(entry, { rating, grade: 'standard' })
    c = { ...c, [list]: [...(c[list] as unknown[]), item] } as Character
  }
  const karmaLeft = () => evaluateBuild(c)!.karma.remaining
  const nuyenLeft = () => evaluateBuild(c)!.nuyen.remaining

  // One positive quality from the role's suggestions, keeping karma for magic.
  for (const s of role.qualities) {
    const entry = matches(catalog, s.query, s.kinds).find((e) => e.kind === 'quality' && e.positive && !e.perLevel)
    if (entry && entry.kind === 'quality' && entry.karma <= Math.min(12, karmaLeft() - 20)) {
      add(entry, 1)
      break
    }
  }

  // Spells, complex forms and adept powers.
  const awakened = MAGIC_TYPES[role.magicType].attribute
  if (awakened) {
    const derived = () => computeDerived(applyBuild(c))
    for (const s of role.magic) {
      for (const entry of matches(catalog, s.query, s.kinds).slice(0, 2)) {
        if (entry.kind === 'adeptPower') {
          const pp = derived().magic?.powerPoints
          const level = entry.perLevel ? 1 : 0
          if (pp && pp.used + entry.powerPoints <= pp.available) add(entry, level)
        } else if (entry.kind === 'spell' || entry.kind === 'complexForm') {
          const cost =
            entry.kind === 'spell' ? SPECIAL_CREATION_RULES.spellKarma : SPECIAL_CREATION_RULES.complexFormKarma
          if (karmaLeft() - cost >= 2) add(entry, 0)
        }
        if (entry.kind !== 'adeptPower') break // one spell per suggestion keeps the list varied
      }
    }
  }

  // Gear: each suggestion gets a fair share of what's left; the most expensive affordable item wins.
  const gear = role.gear
  gear.forEach((s, index) => {
    const remaining = nuyenLeft()
    const share = Math.min(remaining, (remaining / (gear.length - index)) * 1.8)
    let best: { entry: CatalogEntry; rating: number; cost: number } | null = null
    for (const entry of matches(catalog, s.query, s.kinds)) {
      if (entry.kind === 'augmentation' && awakened) continue // would cost Magic/Resonance
      const range = ratingRange(entry)
      for (let r = range?.max ?? 0; r >= (range?.min ?? 0); r--) {
        const cost = entryCost(entry, r, 'standard')
        if (cost > share) continue
        if (entry.kind === 'augmentation' && computeDerived(c).essence - atRating(entry.essence, r) < 2) continue
        if (!best || cost > best.cost) best = { entry, rating: r, cost }
        break
      }
    }
    if (best) add(best.entry, best.rating)
  })

  // Wear the first armor, use the first device, and specialise in the first weapon.
  c = {
    ...c,
    gear: c.gear.map((g, i) => ({ ...g, equipped: g.armor > 0 && c.gear.findIndex((x) => x.armor > 0) === i })),
    matrixDevices: c.matrixDevices.map((d, i) => ({ ...d, active: i === 0 })),
  }
  const weapon = c.weapons[0]
  if (weapon) {
    c = {
      ...c,
      skills: c.skills.map((s) =>
        s.skillId === weapon.skillId && s.specialization ? { ...s, specialization: weapon.specialization } : s,
      ),
    }
  }
  return applyBuild(c)
}

/** Remove catalog picks (newest first) until the build has no errors. */
function repair(start: Character): Character {
  let c = start
  const lists: TargetList[] = [...new Set(Object.values(TARGET_LIST))]
  for (let guard = 0; guard < 50; guard++) {
    const errors = evaluateBuild(c)!.issues.filter((i) => i.severity === 'error')
    if (errors.length === 0) return c
    const list = lists.find((l) => (c[l] as unknown[]).length > 0)
    if (!list) break
    c = applyBuild({ ...c, [list]: (c[list] as unknown[]).slice(0, -1) } as Character)
  }
  return c
}
