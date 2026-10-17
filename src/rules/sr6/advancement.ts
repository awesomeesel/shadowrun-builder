/**
 * Spending karma between runs: the Advancement Costs table (Core Rulebook
 * pp. 67–68). Each purchase is checked, applied, and logged in the karma
 * history so it shows up next to the karma that was earned.
 */
import {
  ComplexFormSchema,
  KnowledgeSkillSchema,
  LanguageSchema,
  QualitySchema,
  SkillSchema,
  SpellSchema,
  type Character,
  type Quality,
} from '../../model/character'
import { ATTRIBUTE_LABELS, type AttributeId } from './attributes'
import { attributeMaximum } from './metatypes'
import { addLedgerEntry } from './play'
import { SKILLS_BY_ID } from './skills'

export const ADVANCEMENT = {
  /** Attributes and active skills cost 5 × the new rank, one rank at a time. */
  karmaPerRank: 5,
  specialization: 5,
  expertise: 5,
  /** An expertise needs a specialization and the skill at rank 5 or more. */
  expertiseMinRank: 5,
  knowledge: 3,
  /** Positive qualities cost twice the listed karma; removing a negative one costs twice its bonus. */
  qualityMultiplier: 2,
  spell: 5,
  complexForm: 5,
  /** Skill ranks range from 1 to 9 (p. 92). */
  maxSkillRank: 9,
  /** Magic and Resonance can't go above 6 without initiation or submersion. */
  maxSpecialRank: 6,
} as const

export interface Purchase {
  /** What it is, for the karma history, e.g. "Agility 4 → 5". */
  label: string
  cost: number
  /** Suggested training time from the book. */
  training: string
  /** Why it can't be bought, if it can't. */
  blocked?: string
  apply: (character: Character) => Character
}

const months = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`

/** Spend the karma, make the change, and note it in the karma history. */
export function buy(character: Character, purchase: Purchase, now = new Date()): Character {
  if (purchase.blocked || purchase.cost > character.karma.available) return character
  return addLedgerEntry(purchase.apply(character), { karma: -purchase.cost, note: purchase.label, purchase: true }, now)
}

/** Why a purchase can't go ahead: a rule, or not enough karma. */
export function whyNot(character: Character, purchase: Purchase): string | undefined {
  if (purchase.blocked) return purchase.blocked
  if (purchase.cost > character.karma.available)
    return `Needs ${purchase.cost} karma; you have ${character.karma.available}.`
  return undefined
}

/** Raise an attribute by one rank. */
export function raiseAttribute(character: Character, attribute: AttributeId): Purchase {
  const current = character.attributes[attribute]
  const next = current + 1
  const name = ATTRIBUTE_LABELS[attribute].name
  const special = attribute === 'magic' || attribute === 'resonance'
  const max = special ? ADVANCEMENT.maxSpecialRank : attributeMaximum(character.metatype, attribute)
  return {
    label: `${name} ${current} → ${next}`,
    cost: ADVANCEMENT.karmaPerRank * next,
    training: months(next * 2),
    blocked:
      special && current === 0
        ? `You don't have ${name}.`
        : next > max
          ? `${name} is at its maximum (${max}).`
          : undefined,
    apply: (c) => ({ ...c, attributes: { ...c.attributes, [attribute]: next } }),
  }
}

/** Raise an active skill by one rank, or learn it at rank 1. */
export function raiseSkill(character: Character, skillId: string): Purchase {
  const def = SKILLS_BY_ID.get(skillId)
  const owned = character.skills.find((s) => s.skillId === skillId)
  const current = owned?.rating ?? 0
  const next = current + 1
  const name = def?.name ?? skillId
  return {
    label: owned ? `${name} ${current} → ${next}` : `Learned ${name} 1`,
    cost: ADVANCEMENT.karmaPerRank * next,
    training: months(next),
    blocked: next > ADVANCEMENT.maxSkillRank ? `${name} is at the maximum rank of 9.` : undefined,
    apply: (c) =>
      owned
        ? { ...c, skills: c.skills.map((s) => (s.id === owned.id ? { ...s, rating: next } : s)) }
        : { ...c, skills: [...c.skills, SkillSchema.parse({ skillId, rating: 1 })] },
  }
}

/** Add a specialization to a skill (one per skill until it becomes an expertise). */
export function addSpecialization(character: Character, skillEntryId: string, specialization: string): Purchase {
  const owned = character.skills.find((s) => s.id === skillEntryId)
  const name = SKILLS_BY_ID.get(owned?.skillId ?? '')?.name ?? 'skill'
  const text = specialization.trim()
  return {
    label: `${name} specialization: ${text}`,
    cost: ADVANCEMENT.specialization,
    training: months(1),
    blocked: !owned
      ? 'Pick a skill first.'
      : !text
        ? 'Type the specialization.'
        : owned.specialization
          ? `${name} already has a specialization; turn it into an expertise first.`
          : undefined,
    apply: (c) => ({ ...c, skills: c.skills.map((s) => (s.id === skillEntryId ? { ...s, specialization: text } : s)) }),
  }
}

/** Turn a skill's specialization into an expertise (needs rank 5+). */
export function addExpertise(character: Character, skillEntryId: string): Purchase {
  const owned = character.skills.find((s) => s.id === skillEntryId)
  const name = SKILLS_BY_ID.get(owned?.skillId ?? '')?.name ?? 'skill'
  return {
    label: `${name} expertise: ${owned?.specialization ?? ''}`,
    cost: ADVANCEMENT.expertise,
    training: months(2),
    blocked: !owned
      ? 'Pick a skill first.'
      : owned.expertise
        ? `${name} already has an expertise.`
        : !owned.specialization
          ? `${name} needs a specialization first.`
          : owned.rating < ADVANCEMENT.expertiseMinRank
            ? `${name} needs rank ${ADVANCEMENT.expertiseMinRank} for an expertise.`
            : undefined,
    // The specialization becomes the expertise, freeing the slot for a new specialization.
    apply: (c) => ({
      ...c,
      skills: c.skills.map((s) =>
        s.id === skillEntryId ? { ...s, expertise: s.specialization, specialization: '' } : s,
      ),
    }),
  }
}

export function learnKnowledge(name: string): Purchase {
  const text = name.trim()
  return {
    label: `Knowledge: ${text}`,
    cost: ADVANCEMENT.knowledge,
    training: months(1),
    blocked: text ? undefined : 'Type the knowledge skill.',
    apply: (c) => ({ ...c, knowledgeSkills: [...c.knowledgeSkills, KnowledgeSkillSchema.parse({ name: text })] }),
  }
}

/** A new language costs the same as a knowledge skill (p. 67). */
export function learnLanguage(name: string): Purchase {
  const text = name.trim()
  return {
    label: `Language: ${text}`,
    cost: ADVANCEMENT.knowledge,
    training: months(1),
    blocked: text ? undefined : 'Type the language.',
    apply: (c) => ({ ...c, languages: [...c.languages, LanguageSchema.parse({ name: text })] }),
  }
}

/** Buy a positive quality at twice its karma cost. */
export function buyQuality(quality: Quality): Purchase {
  return {
    label: `Quality: ${quality.name}`,
    cost: ADVANCEMENT.qualityMultiplier * quality.karma,
    training: '1 week',
    blocked:
      quality.kind !== 'positive'
        ? "Negative qualities can't be bought for karma."
        : quality.karma <= 0
          ? 'Enter the karma cost from the book first.'
          : undefined,
    apply: (c) => ({ ...c, qualities: [...c.qualities, QualitySchema.parse({ ...quality })] }),
  }
}

/** Get rid of a negative quality at twice its karma bonus. */
export function removeNegativeQuality(character: Character, qualityId: string): Purchase {
  const quality = character.qualities.find((q) => q.id === qualityId)
  return {
    label: `Removed ${quality?.name ?? 'quality'}`,
    cost: ADVANCEMENT.qualityMultiplier * (quality?.karma ?? 0),
    training: '1 week',
    blocked: !quality
      ? 'Pick a quality.'
      : quality.kind !== 'negative'
        ? 'Only negative qualities can be bought off.'
        : quality.karma <= 0
          ? "Enter the quality's karma bonus on the Edit tab first."
          : undefined,
    apply: (c) => ({ ...c, qualities: c.qualities.filter((q) => q.id !== qualityId) }),
  }
}

export function learnSpell(character: Character, spell: Partial<Character['spells'][number]>): Purchase {
  const name = spell.name?.trim() ?? ''
  return {
    label: `Spell: ${name}`,
    cost: ADVANCEMENT.spell,
    training: '1 week',
    blocked:
      character.attributes.magic <= 0
        ? 'Only awakened characters learn spells.'
        : !name
          ? 'Type or pick the spell.'
          : character.spells.some((s) => s.name.toLowerCase() === name.toLowerCase())
            ? `You already know ${name}.`
            : undefined,
    apply: (c) => ({ ...c, spells: [...c.spells, SpellSchema.parse({ ...spell, name })] }),
  }
}

export function learnComplexForm(character: Character, form: Partial<Character['complexForms'][number]>): Purchase {
  const name = form.name?.trim() ?? ''
  return {
    label: `Complex form: ${name}`,
    cost: ADVANCEMENT.complexForm,
    training: '1 week',
    blocked:
      character.attributes.resonance <= 0
        ? 'Only technomancers learn complex forms.'
        : !name
          ? 'Type or pick the complex form.'
          : character.complexForms.some((f) => f.name.toLowerCase() === name.toLowerCase())
            ? `You already know ${name}.`
            : undefined,
    apply: (c) => ({ ...c, complexForms: [...c.complexForms, ComplexFormSchema.parse({ ...form, name })] }),
  }
}
