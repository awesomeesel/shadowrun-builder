import { BuildSchema, type Build, type Character } from '../../model/character'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS, MENTAL_ATTRIBUTES, PHYSICAL_ATTRIBUTES, type AttributeId } from './attributes'
import {
  CREATION_RULES as RULES,
  MAGIC_TYPES,
  PRIORITY_CATEGORIES,
  PRIORITY_CATEGORY_LABELS,
  PRIORITY_TABLE,
} from './creation'
import { METATYPES, attributeMaximum } from './metatypes'
import { computeDerived } from './derived'
import { SKILLS_BY_ID } from './skills'
import { AUGMENTATION_GRADES, SPECIAL_CREATION_RULES } from './special'

const POINT_ATTRIBUTES: readonly AttributeId[] = [...PHYSICAL_ATTRIBUTES, ...MENTAL_ATTRIBUTES]
const MAGIC_SKILLS = new Set(['astral', 'conjuring', 'enchanting', 'sorcery'])

export interface Budget {
  total: number
  spent: number
  remaining: number
}

export interface BuildIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface KarmaBreakdown {
  attributes: number
  skills: number
  qualities: number
  knowledge: number
  contacts: number
  magic: number
  nuyen: number
}

export interface BuildEvaluation {
  adjustmentPoints: Budget
  attributePoints: Budget
  skillPoints: Budget
  karma: Budget & { breakdown: KarmaBreakdown }
  nuyen: Budget
  freeKnowledge: Budget
  freeContactKarma: Budget
  issues: BuildIssue[]
}

export function startBuild(character: Character): Character {
  return applyBuild({ ...character, mode: 'build', build: BuildSchema.parse({}) })
}

/** The rating an attribute gets before karma: base + adjustment + points (or priority Magic). */
function attributeBase(build: Build, attribute: AttributeId): number {
  const a = build.attributes[attribute]
  if (attribute === 'magic' || attribute === 'resonance') {
    if (MAGIC_TYPES[build.magicType].attribute !== attribute) return 0
    return PRIORITY_TABLE[build.priorities.magic].magicRating + a.adjustment
  }
  if (attribute === 'edge') return 1 + a.adjustment
  return 1 + a.adjustment + a.points
}

export function buildAttributeValue(build: Build, attribute: AttributeId): number {
  const base = attributeBase(build, attribute)
  return base === 0 ? 0 : base + build.attributes[attribute].karma
}

/** Write attribute values and skill ratings derived from the build allocations. */
export function applyBuild(character: Character): Character {
  const build = character.build
  if (!build) return character
  const attributes = { ...character.attributes }
  for (const attribute of ATTRIBUTE_IDS) attributes[attribute] = buildAttributeValue(build, attribute)
  const skills = character.skills.map((skill) => {
    const alloc = build.skills[skill.id]
    return { ...skill, rating: alloc ? alloc.points + alloc.karma : 0 }
  })
  return { ...character, attributes, skills }
}

/** Karma to raise a rating from `from` to `to`, paying new rating × 5 per step. */
function raiseCost(from: number, to: number): number {
  let cost = 0
  for (let rating = from + 1; rating <= to; rating++) cost += rating * RULES.karmaPerRating
  return cost
}

function budget(total: number, spent: number): Budget {
  return { total, spent, remaining: total - spent }
}

export function evaluateBuild(character: Character): BuildEvaluation | null {
  const build = character.build
  if (!build) return null
  const issues: BuildIssue[] = []
  const error = (message: string) => issues.push({ severity: 'error', message })
  const warning = (message: string) => issues.push({ severity: 'warning', message })
  const priority = (category: keyof Build['priorities']) => PRIORITY_TABLE[build.priorities[category]]

  // Priorities
  const used = new Map<string, string[]>()
  for (const category of PRIORITY_CATEGORIES) {
    const level = build.priorities[category]
    used.set(level, [...(used.get(level) ?? []), PRIORITY_CATEGORY_LABELS[category]])
  }
  for (const [level, categories] of used) {
    if (categories.length > 1)
      error(`Priority ${level} is used for ${categories.join(' and ')}; each letter can be used once.`)
  }
  if (!priority('metatype').metatypes.includes(character.metatype)) {
    error(`${METATYPES[character.metatype].name} isn't available at metatype priority ${build.priorities.metatype}.`)
  }

  // Magic
  const magicAttribute = MAGIC_TYPES[build.magicType].attribute
  if (magicAttribute && priority('magic').magicRating === 0) {
    error(`${MAGIC_TYPES[build.magicType].name} needs Magic/Resonance priority D or better.`)
  }
  if (!magicAttribute && priority('magic').magicRating > 0) {
    warning(`Magic/Resonance priority ${build.priorities.magic} is wasted on a mundane character.`)
  }

  // Attributes
  let adjustmentSpent = 0
  let attributePointsSpent = 0
  let attributeKarma = 0
  let atMax = 0
  for (const attribute of ATTRIBUTE_IDS) {
    const alloc = build.attributes[attribute]
    const label = ATTRIBUTE_LABELS[attribute].name
    const value = buildAttributeValue(build, attribute)
    adjustmentSpent += alloc.adjustment
    attributeKarma += raiseCost(value - alloc.karma, value)

    if (POINT_ATTRIBUTES.includes(attribute)) attributePointsSpent += alloc.points
    else if (alloc.points > 0) error(`Attribute points can't be spent on ${label}.`)

    if (alloc.adjustment > 0 && !canUseAdjustment(character, build, attribute)) {
      error(`Adjustment points can't be spent on ${label} for a ${METATYPES[character.metatype].name.toLowerCase()}.`)
    }
    if ((attribute === 'magic' || attribute === 'resonance') && magicAttribute !== attribute) {
      if (alloc.adjustment > 0 || alloc.karma > 0) error(`${label} needs a matching magic/resonance type.`)
      continue
    }
    const max = attributeMaximum(character.metatype, attribute)
    if (value > max) error(`${label} ${value} is above the ${METATYPES[character.metatype].name} maximum of ${max}.`)
    if (value === max && attribute !== 'magic' && attribute !== 'resonance') atMax++
  }
  if (atMax > RULES.maxAttributesAtMax) {
    error(`${atMax} attributes are at their maximum; only ${RULES.maxAttributesAtMax} may be at creation.`)
  }

  // Skills
  let skillPointsSpent = 0
  let skillKarma = 0
  let skillsAtMax = 0
  for (const skill of character.skills) {
    const alloc = build.skills[skill.id] ?? { points: 0, karma: 0, adjustment: 0 }
    const name = SKILLS_BY_ID.get(skill.skillId)?.name ?? skill.skillId
    const rating = alloc.points + alloc.karma
    skillPointsSpent += alloc.points
    skillKarma += raiseCost(alloc.points, rating)
    if (skill.specialization.trim()) skillPointsSpent += RULES.specializationSkillPoints
    if (skill.expertise.trim()) {
      skillKarma += RULES.expertiseKarma
      if (!skill.specialization.trim()) error(`${name} needs a specialization before an expertise.`)
    }
    if (rating > RULES.maxSkillRating)
      error(`${name} ${rating} is above the creation maximum of ${RULES.maxSkillRating}.`)
    if (rating === RULES.maxSkillRating) skillsAtMax++
    if (rating === 0) warning(`${name} has no rating yet.`)
    if (MAGIC_SKILLS.has(skill.skillId) && magicAttribute !== 'magic')
      warning(`${name} is only useful for awakened characters.`)
    if (skill.skillId === 'tasking' && magicAttribute !== 'resonance')
      warning(`Tasking is only useful for technomancers.`)
  }
  if (skillsAtMax > RULES.maxSkillsAtMax) {
    error(
      `${skillsAtMax} skills are at rating ${RULES.maxSkillRating}; only ${RULES.maxSkillsAtMax} may be at creation.`,
    )
  }

  // Qualities
  const positive = sumBy(
    character.qualities.filter((q) => q.kind === 'positive'),
    (q) => q.karma,
  )
  const negative = sumBy(
    character.qualities.filter((q) => q.kind === 'negative'),
    (q) => q.karma,
  )

  // Knowledge skills and languages
  const nativeLanguages = character.languages.filter((l) => l.level === 'native').length
  const knowledgeCount = character.knowledgeSkills.length + character.languages.length - Math.min(1, nativeLanguages)
  const logic = buildAttributeValue(build, 'logic')
  const freeKnowledge = budget(logic * RULES.freeKnowledgePerLogic, knowledgeCount)
  const knowledgeKarma = Math.max(0, -freeKnowledge.remaining) * RULES.knowledgeSkillKarma

  // Contacts
  const charisma = buildAttributeValue(build, 'charisma')
  const freeContactKarma = budget(
    charisma * RULES.contactKarmaPerCharisma,
    sumBy(character.contacts, (c) => c.connection + c.loyalty),
  )
  const contactKarma = Math.max(0, -freeContactKarma.remaining)

  // Spells, adept powers, complex forms
  const casts = build.magicType === 'magician' || build.magicType === 'aspected' || build.magicType === 'mysticAdept'
  if (character.spells.length > 0 && !casts) warning(`Only magicians and mystic adepts can cast spells.`)
  const hasPowers = build.magicType === 'adept' || build.magicType === 'mysticAdept'
  if (character.adeptPowers.length > 0 && !hasPowers) warning(`Only adepts and mystic adepts can have adept powers.`)
  if (character.complexForms.length > 0 && build.magicType !== 'technomancer') {
    warning(`Only technomancers can use complex forms.`)
  }
  if (build.magicType !== 'mysticAdept' && character.powerPointsBought > 0) {
    error(`Only mystic adepts buy power points with karma.`)
  }
  const derived = computeDerived(applyBuild(character))
  if (derived.magic && hasPowers && derived.magic.powerPoints.used > derived.magic.powerPoints.available) {
    error(
      `Adept powers use ${derived.magic.powerPoints.used} power points; only ${derived.magic.powerPoints.available} available.`,
    )
  }
  if (build.magicType === 'mysticAdept' && character.powerPointsBought > buildAttributeValue(build, 'magic')) {
    error(`A mystic adept can't buy more power points than their Magic.`)
  }
  const magicKarma =
    character.spells.length * SPECIAL_CREATION_RULES.spellKarma +
    character.complexForms.length * SPECIAL_CREATION_RULES.complexFormKarma +
    character.powerPointsBought * SPECIAL_CREATION_RULES.powerPointKarma

  // Nuyen
  if (build.karmaForNuyen > RULES.maxKarmaForNuyen) {
    error(`At most ${RULES.maxKarmaForNuyen} karma can be converted to nuyen.`)
  }
  const nuyen = budget(
    priority('resources').nuyen + build.karmaForNuyen * RULES.nuyenPerKarma,
    sumBy(character.gear, (g) => g.cost * g.quantity) +
      sumBy(character.weapons, (w) => w.cost) +
      sumBy(character.augmentations, (a) => Math.round(a.cost * AUGMENTATION_GRADES[a.grade].cost)) +
      sumBy(character.matrixDevices, (d) => d.cost) +
      sumBy(character.vehicles, (v) => v.cost),
  )

  const breakdown: KarmaBreakdown = {
    attributes: attributeKarma,
    skills: skillKarma,
    qualities: positive - negative,
    knowledge: knowledgeKarma,
    contacts: contactKarma,
    magic: magicKarma,
    nuyen: build.karmaForNuyen,
  }
  const karma = {
    ...budget(
      RULES.startingKarma,
      Object.values(breakdown).reduce((a, b) => a + b, 0),
    ),
    breakdown,
  }

  const result: BuildEvaluation = {
    adjustmentPoints: budget(priority('metatype').adjustmentPoints, adjustmentSpent),
    attributePoints: budget(priority('attributes').attributePoints, attributePointsSpent),
    skillPoints: budget(priority('skills').skillPoints, skillPointsSpent),
    karma,
    nuyen,
    freeKnowledge,
    freeContactKarma,
    issues,
  }

  const overspent: [string, Budget][] = [
    ['adjustment points', result.adjustmentPoints],
    ['attribute points', result.attributePoints],
    ['skill points', result.skillPoints],
    ['karma', result.karma],
    ['nuyen', result.nuyen],
  ]
  for (const [label, b] of overspent) {
    if (b.remaining < 0) error(`Overspent ${label} by ${(-b.remaining).toLocaleString()}.`)
  }
  for (const [label, b] of overspent.slice(0, 3)) {
    if (b.remaining > 0) warning(`${b.remaining} ${label} left to spend.`)
  }

  return result
}

/** Adjustment points go to Edge, the awakened attribute, or attributes the metatype can raise above 6. */
export function canUseAdjustment(character: Character, build: Build, attribute: AttributeId): boolean {
  if (attribute === 'edge') return true
  if (attribute === 'magic' || attribute === 'resonance') return MAGIC_TYPES[build.magicType].attribute === attribute
  return attributeMaximum(character.metatype, attribute) > 6
}

/** End the build: leftover karma and nuyen become the character's starting resources. */
export function finishBuild(character: Character): Character {
  const evaluation = evaluateBuild(character)
  if (!evaluation) return character
  return {
    ...applyBuild(character),
    mode: 'free',
    karma: { ...character.karma, available: Math.max(0, evaluation.karma.remaining) },
    nuyen: Math.max(0, evaluation.nuyen.remaining),
  }
}

function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((sum, item) => sum + value(item), 0)
}
