/**
 * Import characters exported from Commlink 6 ("Roll20 compatible" JSON).
 *
 * Built from a real export of a mundane street samurai. Sections that were
 * empty in that file (spells, powers, complex forms, vehicles, Matrix gear)
 * are read best-effort from the field names Commlink uses elsewhere.
 */
import { KNOWN_BOOKS } from '../../books/catalog'
import { parseAttackRatings } from '../../books/extract/values'
import { knownBonusAttribute, knownBonuses } from '../../rules/sr6/bonuses'
import { computeDerived, ownedSkillPools, weaponPool } from '../../rules/sr6/derived'
import type { MetatypeId } from '../../rules/sr6/metatypes'
import { SKILLS_BY_ID } from '../../rules/sr6/skills'
import { AUGMENTATION_GRADES, type GradeId } from '../../rules/sr6/special'
import {
  AdeptPowerSchema,
  AugmentationSchema,
  ComplexFormSchema,
  ContactSchema,
  createCharacter,
  GearSchema,
  KnowledgeSkillSchema,
  LanguageSchema,
  LicenseSchema,
  LifestyleSchema,
  MatrixDeviceSchema,
  QualitySchema,
  SinSchema,
  SpellSchema,
  VehicleSchema,
  WeaponSchema,
  type Character,
  type CharacterSkill,
  type GearItem,
  type SourceRef,
} from '../character'

type Json = Record<string, unknown>

/** A value Commlink calculated next to ours, to spot rules differences after import. */
export interface ImportCheck {
  label: string
  commlink: string
  ours: string
}

export interface ImportReport {
  source: 'Commlink 6'
  /** Things that were guessed, converted or left out. */
  notes: string[]
  checks: ImportCheck[]
}

export function isCommlinkExport(data: unknown): data is Json {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Json).system === 'SHADOWRUN6' &&
    Array.isArray((data as Json).attributes)
  )
}

// --- small readers that tolerate missing or oddly typed fields ---
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const arr = (v: unknown): Json[] =>
  Array.isArray(v) ? v.filter((x): x is Json => typeof x === 'object' && x !== null) : []
const first = (o: Json, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]
  return undefined
}

const METATYPES: Record<string, MetatypeId> = {
  human: 'human',
  elf: 'elf',
  dwarf: 'dwarf',
  ork: 'ork',
  troll: 'troll',
  // Metavariants count as their base metatype.
  dryad: 'elf',
  'night one': 'elf',
  wakyambi: 'elf',
  'xapiri thepe': 'elf',
  gnome: 'dwarf',
  hanuman: 'dwarf',
  koborokuru: 'dwarf',
  menehune: 'dwarf',
  hobgoblin: 'ork',
  ogre: 'ork',
  oni: 'ork',
  satyr: 'ork',
  cyclops: 'troll',
  fomori: 'troll',
  giant: 'troll',
  minotaur: 'troll',
}

const ATTRIBUTES: Record<string, keyof Character['attributes']> = {
  BODY: 'body',
  AGILITY: 'agility',
  REACTION: 'reaction',
  STRENGTH: 'strength',
  WILLPOWER: 'willpower',
  LOGIC: 'logic',
  INTUITION: 'intuition',
  CHARISMA: 'charisma',
  EDGE: 'edge',
  MAGIC: 'magic',
  RESONANCE: 'resonance',
}

/** "Core Rulebook 73" → { book: 'CRB', page: 73 }. */
function pageRef(text: unknown): SourceRef | undefined {
  const match = str(text).match(/^(.*?)[\s,]*(?:p\.?\s*)?(\d+)$/i)
  if (!match || !match[1]) return undefined
  const title = match[1].trim().toLowerCase()
  const known = KNOWN_BOOKS.find((b) => b.title.toLowerCase() === title || title.includes(b.title.toLowerCase()))
  return { book: known?.code ?? match[1].trim(), page: parseInt(match[2], 10) }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()

function joinNotes(...parts: unknown[]) {
  return parts.map(str).filter(Boolean).join(' · ')
}

/** Convert a Commlink 6 export to a character, with notes on what was guessed and checks against Commlink's math. */
export function fromCommlink(data: Json): { character: Character; report: ImportReport } {
  const notes: string[] = []
  const metaName = str(data.metaType).toLowerCase()
  const metatype = METATYPES[metaName] ?? 'human'
  if (!METATYPES[metaName]) notes.push(`Unknown metatype "${str(data.metaType)}"; imported as human.`)
  else if (!['human', 'elf', 'dwarf', 'ork', 'troll'].includes(metaName)) {
    notes.push(
      `${capitalize(metaName)} is a metavariant; imported as ${metatype}. Add its qualities if they're missing.`,
    )
  }

  // Attributes: "points" is the natural rating, "modifiedValue" includes augmentations.
  const attributes = { ...createCharacter().attributes }
  const boost: Partial<Record<keyof typeof attributes, number>> = {}
  for (const a of arr(data.attributes)) {
    const key = ATTRIBUTES[str(a.id)]
    if (!key) continue
    attributes[key] = Math.max(0, num(a.points))
    const diff = num(a.modifiedValue) - num(a.points)
    if (diff > 0 && num(a.points) > 0) boost[key] = diff
  }

  const initiatives = new Map(arr(data.initiatives).map((i) => [str(i.id), i]))
  const physicalInit = initiatives.get('INITIATIVE_PHYSICAL')
  const extraDice = Math.max(0, Number(str(physicalInit?.dice).match(/(\d+)\s*D6/i)?.[1] ?? 1) - 1)

  // Skills, knowledge skills and languages all come in one list.
  const skills: CharacterSkill[] = []
  const knowledgeSkills = []
  const languages = []
  for (const s of arr(data.skills)) {
    const id = str(s.id)
    const specs = arr(s.specializations)
    if (id === 'knowledge') {
      knowledgeSkills.push(KnowledgeSkillSchema.parse({ name: str(s.name) }))
      continue
    }
    if (id === 'language') {
      const name = str(s.name)
      const level = /native/i.test(name)
        ? 'native'
        : specs.some((x) => x.expertise)
          ? 'expert'
          : specs.length
            ? 'specialist'
            : 'basic'
      languages.push(LanguageSchema.parse({ name, level }))
      continue
    }
    const skillId = id.replace(/_/g, '-')
    if (!SKILLS_BY_ID.has(skillId)) {
      notes.push(`Skipped unknown skill "${str(s.name)}".`)
      continue
    }
    skills.push({
      id: crypto.randomUUID(),
      skillId,
      rating: num(s.rating),
      specialization: str(specs.find((x) => !x.expertise)?.name),
      expertise: str(specs.find((x) => x.expertise)?.name),
    })
  }
  if (languages.some((l) => l.name === 'Native Language')) {
    notes.push('Commlink calls the native language "Native Language"; rename it on the Edit tab if you like.')
  }

  const qualities = arr(data.qualities).map((q) =>
    QualitySchema.parse({
      name: str(q.name),
      kind: q.positive === false ? 'negative' : 'positive',
      rating: Math.max(1, num(q.rating)),
      notes: joinNotes(str(q.choice) !== str(q.name) ? q.choice : '', q.description),
      source: pageRef(q.page),
    }),
  )

  // Weapons. "Unarmed" is shown on our sheet already.
  const weapons = [...arr(data.longRangeWeapons), ...arr(data.closeCombatWeapons)]
    .filter((w) => !/^unarmed$/i.test(str(w.subtype)) && !/^unarmed$/i.test(str(w.name)))
    .map((w) => {
      const type = str(w.type).toLowerCase()
      const subtype = str(w.subtype)
      const skillId = /close combat/.test(type)
        ? 'close-combat'
        : /exotic|launcher/i.test(`${type} ${subtype}`)
          ? 'exotic-weapons'
          : /throw/i.test(`${type} ${subtype}`)
            ? 'athletics'
            : 'firearms'
      return {
        weapon: WeaponSchema.parse({
          name: str(w.name),
          skillId,
          specialization: subtype,
          damage: str(w.damage),
          attackRatings: parseAttackRatings(str(w.attackRating).replace(/-/g, '—')),
          modes: str(w.mode).replace(/,\s*/g, '/'),
          ammo: str(w.ammunition),
          notes: joinNotes(
            arr(w.accessories)
              .map((a) => str(a.name))
              .join(', '),
            w.description,
          ),
          source: pageRef(w.page),
        }),
        commlinkPool: num(w.pool),
      }
    })

  // Armor and other items become gear; repeated identical items are merged.
  const gear: GearItem[] = arr(data.armors).map((a) =>
    GearSchema.parse({
      name: str(a.name),
      category: 'Armor',
      armor: num(a.rating),
      equipped: a.isIgnored !== true,
      notes: joinNotes(num(a.socialrating) ? `Social rating ${num(a.socialrating)}` : '', a.description),
      source: pageRef(a.page),
    }),
  )
  for (const item of arr(data.items)) {
    const candidate = GearSchema.parse({
      name: str(item.name),
      category: str(first(item, 'subType', 'type')),
      rating: num(item.rating),
      quantity: Math.max(1, num(item.count)),
      notes: joinNotes(
        arr(item.accessories)
          .map((a) => str(a.name))
          .join(', '),
        item.description,
      ),
      source: pageRef(item.page),
    })
    const same = gear.find(
      (g) => g.name === candidate.name && g.rating === candidate.rating && g.category === candidate.category,
    )
    if (same) same.quantity += candidate.quantity
    else gear.push(candidate)
  }

  // Augmentations: Commlink exports Essence divided by 1,000 and no ratings or bonuses.
  const rawAugs = arr(data.augmentations)
  const scaled = rawAugs.length > 0 && rawAugs.every((a) => num(a.essence) < 0.01)
  if (scaled)
    notes.push('Augmentation Essence was exported 1,000× too small (a Commlink quirk) and has been corrected.')
  const remaining = { ...boost }
  let diceLeft = extraDice
  const augmentations = rawAugs.map((a) => {
    const name = str(a.name)
    const essence = Math.round(num(a.essence) * (scaled ? 1000 : 1) * 100) / 100
    let rating = num(first(a, 'level', 'rating'))
    const attribute = knownBonusAttribute(name)
    if (attribute && !rating && remaining[attribute]) {
      rating = remaining[attribute]!
      notes.push(`${name}: rating ${rating} worked out from ${capitalize(attribute)} going up by ${rating}.`)
    }
    const bonuses = attribute ? knownBonuses(name, rating) : { attributes: {}, initiativeDice: 0 }
    if (attribute)
      remaining[attribute] = Math.max(0, (remaining[attribute] ?? 0) - (bonuses.attributes[attribute] ?? 0))
    diceLeft -= bonuses.initiativeDice
    const grade = str(a.quality).toLowerCase()
    const gradeId: GradeId = (['used', 'alpha', 'beta', 'delta'] as const).find((g) => grade.includes(g)) ?? 'standard'
    return AugmentationSchema.parse({
      name,
      kind: /bio|cultured|toner|pheromone|orthoskin|platelet/i.test(name) ? 'bioware' : 'cyberware',
      grade: gradeId,
      rating,
      // Commlink's Essence already includes the grade; we store the printed value and apply the grade ourselves.
      essence:
        gradeId === 'standard' ? essence : Math.round((essence / AUGMENTATION_GRADES[gradeId].essence) * 100) / 100,
      bonuses,
      notes: joinNotes(
        arr(a.accessories)
          .map((x) => str(x.name))
          .join(', '),
        a.description,
      ),
      source: pageRef(a.page),
    })
  })
  for (const [attribute, left] of Object.entries(remaining)) {
    if (left)
      notes.push(
        `${capitalize(attribute)} is ${left} higher in Commlink than our augmentations explain. Add the bonus on the Edit tab.`,
      )
  }
  if (diceLeft > 0) notes.push(`Commlink shows ${diceLeft} more initiative dice than our augmentations explain.`)

  // Magic, resonance, vehicles and Matrix gear: best effort (no sample export yet).
  const spells = arr(data.spells).map((s) =>
    SpellSchema.parse({
      name: str(s.name),
      category: (['combat', 'detection', 'health', 'illusion', 'manipulation'].find((c) =>
        str(first(s, 'category', 'type'))
          .toLowerCase()
          .includes(c),
      ) ?? 'combat') as 'combat',
      type: /^p/i.test(str(first(s, 'spellType', 'type'))) ? 'physical' : 'mana',
      range: str(s.range),
      duration: str(s.duration),
      drain: str(first(s, 'drain', 'dv')),
      notes: str(s.description),
      source: pageRef(s.page),
    }),
  )
  const adeptPowers = arr(data.adeptPowers).map((p) => {
    const name = str(p.name)
    const level = num(first(p, 'level', 'rating'))
    return AdeptPowerSchema.parse({
      name,
      level,
      powerPoints: num(first(p, 'cost', 'powerPoints', 'pp')),
      bonuses: knownBonuses(name, level),
      notes: str(p.description),
      source: pageRef(p.page),
    })
  })
  const complexForms = arr(data.complexForms).map((f) =>
    ComplexFormSchema.parse({
      name: str(f.name),
      duration: str(f.duration),
      fading: str(first(f, 'fading', 'fade')),
      notes: str(f.description),
      source: pageRef(f.page),
    }),
  )
  const vehicles = [...arr(data.vehicles), ...arr(data.drones).map((d): Json => ({ ...d, isDrone: true }))].map((v) =>
    VehicleSchema.parse({
      name: str(v.name),
      kind: v.isDrone ? 'drone' : 'vehicle',
      handling: str(first(v, 'handling', 'handl')),
      acceleration: str(first(v, 'acceleration', 'accel')),
      speedInterval: str(first(v, 'speedInterval', 'speed_interval')),
      topSpeed: str(first(v, 'topSpeed', 'speed')),
      body: num(v.body),
      armor: num(v.armor),
      pilot: num(v.pilot),
      sensor: num(v.sensor),
      seats: str(v.seats),
      notes: str(v.description),
      source: pageRef(v.page),
    }),
  )
  const matrixDevices = arr(data.matrixItems).map((m, i) =>
    MatrixDeviceSchema.parse({
      name: str(m.name),
      kind: /deck/i.test(str(first(m, 'subType', 'type')))
        ? 'cyberdeck'
        : /rcc|rigger/i.test(str(first(m, 'subType', 'type')))
          ? 'rcc'
          : 'commlink',
      deviceRating: num(first(m, 'deviceRating', 'rating')),
      attack: num(m.attack),
      sleaze: num(m.sleaze),
      dataProcessing: num(first(m, 'dataProcessing', 'dataprocessing')),
      firewall: num(m.firewall),
      active: i === 0,
      notes: str(m.description),
      source: pageRef(m.page),
    }),
  )
  if (spells.length + adeptPowers.length + complexForms.length + vehicles.length + matrixDevices.length > 0) {
    notes.push('Spells, powers, complex forms, vehicles and Matrix gear were read from an untested format; check them.')
  }

  const contacts = arr(data.contacts).map((c) =>
    ContactSchema.parse({
      name: str(c.name),
      role: str(c.type),
      connection: Math.max(1, num(first(c, 'influence', 'connection'))),
      loyalty: Math.max(1, num(c.loyalty)),
      notes: joinNotes(c.description, num(c.favors) ? `Favors: ${num(c.favors)}` : ''),
    }),
  )
  const sins = arr(data.sins).map((s) =>
    SinSchema.parse({ name: str(s.name), rating: num(first(s, 'quality', 'rating')), notes: str(s.description) }),
  )
  const licenses = arr(data.licenses).map((l) => {
    const rating = str(l.rating)
    return LicenseSchema.parse({
      name: str(l.name),
      sin: str(l.sin),
      rating: Number(rating) || 0,
      notes: joinNotes(l.type, Number(rating) ? '' : rating && rating !== 'ANYONE' ? rating : ''),
    })
  })
  const lifestyles = arr(data.lifestyles).map((l) =>
    LifestyleSchema.parse({
      name: str(first(l, 'customName', 'name')),
      level: str(l.name),
      cost: num(l.cost),
      monthsPaid: num(l.paidMonths),
      notes: str(l.description),
    }),
  )

  const extraNotes = [
    num(data.initiation) ? `Initiation grade ${num(data.initiation)}` : '',
    num(data.submersion) ? `Submersion grade ${num(data.submersion)}` : '',
    arr(data.martialArts).length
      ? `Martial arts: ${arr(data.martialArts)
          .map((m) => str(m.name))
          .join(', ')}`
      : '',
    arr(data.signatureManeuvers).length
      ? `Signature maneuvers: ${arr(data.signatureManeuvers)
          .map((m) => str(m.name))
          .join(', ')}`
      : '',
    num(data.freeKarma) ? `Unspent free karma in Commlink: ${num(data.freeKarma)}` : '',
  ].filter(Boolean)
  if (extraNotes.length) notes.push(`Added to the notes: ${extraNotes.join('; ')}.`)

  const genderRaw = str(data.gender)
  const character = createCharacter({
    name: str(data.streetName) || str(data.name) || 'Imported runner',
    realName: str(data.streetName) ? str(data.name) : '',
    metatype,
    gender: genderRaw ? capitalize(genderRaw) : '',
    age: str(data.age),
    height: num(data.size),
    weight: num(data.weight),
    heat: num(data.heat),
    reputation: num(data.reputation),
    attributes,
    skills,
    knowledgeSkills,
    languages,
    qualities,
    weapons: weapons.map((w) => w.weapon),
    gear,
    augmentations,
    spells,
    adeptPowers,
    complexForms,
    vehicles,
    matrixDevices,
    contacts,
    sins,
    licenses,
    lifestyles,
    nuyen: num(data.nuyen),
    karma: { available: num(data.karma), career: 0 },
    notes: [str(data.notes), ...extraNotes].filter(Boolean).join('\n'),
  })
  notes.push('Commlink exports no prices or quality karma costs; these are 0 unless your books filled them in.')

  return { character, report: { source: 'Commlink 6', notes, checks: compare(data, character, weapons) } }
}

/** Compare Commlink's own calculated values with ours. */
function compare(
  data: Json,
  character: Character,
  weapons: { weapon: { name: string; id: string }; commlinkPool: number }[],
) {
  const derived = computeDerived(character)
  const checks: ImportCheck[] = []
  const add = (label: string, commlink: unknown, ours: string) => {
    if (commlink !== undefined && str(commlink) !== '') checks.push({ label, commlink: str(commlink), ours })
  }
  const attrs = new Map(arr(data.attributes).map((a) => [str(a.id), a.modifiedValue]))
  add('Defense pool', attrs.get('DEFENSE_POOL_PHYSICAL'), String(derived.pools.defense))
  add('Composure', attrs.get('COMPOSURE'), String(derived.pools.composure))
  add('Judge Intentions', attrs.get('JUDGE_INTENTIONS'), String(derived.pools.judgeIntentions))
  add('Memory', attrs.get('MEMORY'), String(derived.pools.memory))
  add('Lift / Carry', attrs.get('LIFT_CARRY'), String(derived.pools.liftCarry))
  const inits = new Map(arr(data.initiatives).map((i) => [str(i.id), i]))
  const init = (id: string) => {
    const i = inits.get(id)
    return i ? `${num(i.value)} ${str(i.dice)}` : undefined
  }
  add('Initiative', init('INITIATIVE_PHYSICAL'), `${derived.initiative.score} +${derived.initiative.dice}D6`)
  if (character.attributes.magic > 0) {
    add(
      'Astral initiative',
      init('INITIATIVE_ASTRAL'),
      `${derived.astralInitiative.score} +${derived.astralInitiative.dice}D6`,
    )
  }
  for (const { weapon, commlinkPool } of weapons) {
    const full = character.weapons.find((w) => w.id === weapon.id)
    if (full && commlinkPool) add(`${weapon.name} pool`, commlinkPool, String(weaponPool(character, full).pool ?? '–'))
  }
  for (const s of arr(data.skills)) {
    const pool = num(s.pool)
    if (!pool) continue
    const ours = ownedSkillPools(character).find((p) => p.skill.id === str(s.id).replace(/_/g, '-'))
    if (ours) add(`${str(s.name)} pool`, pool, String(ours.pool ?? '–'))
  }
  return checks
}
