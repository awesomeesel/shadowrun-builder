import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { Field, NumberInput, Section } from '../../components/ui'
import type { Character } from '../../model/character'
import {
  ATTRIBUTE_LABELS,
  MENTAL_ATTRIBUTES,
  PHYSICAL_ATTRIBUTES,
  SPECIAL_ATTRIBUTES,
  type AttributeId,
} from '../../rules/sr6/attributes'
import { METATYPE_IDS, METATYPES, attributeMaximum } from '../../rules/sr6/metatypes'
import { SKILLS, SKILLS_BY_ID } from '../../rules/sr6/skills'
import type { CharacterContext, Update } from './CharacterPage'
import {
  ContactsSection,
  EssenceInput,
  GearSection,
  KnowledgeSection,
  QualitiesSection,
  WeaponsSection,
} from './EditLists'

export function EditTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BasicsSection character={character} update={update} />
      <AttributesSection character={character} update={update} />
      <SkillsSection character={character} update={update} />
      <QualitiesSection character={character} update={update} />
      <WeaponsSection character={character} update={update} />
      <GearSection character={character} update={update} />
      <ContactsSection character={character} update={update} />
      <KnowledgeSection character={character} update={update} />
      <ResourcesSection character={character} update={update} />
      <Section title="Notes" className="lg:col-span-2">
        <textarea
          className="input min-h-32 w-full"
          value={character.notes}
          onChange={(e) => {
            const notes = e.target.value
            update((c) => ({ ...c, notes }))
          }}
        />
      </Section>
    </div>
  )
}

function BasicsSection({ character, update }: { character: Character; update: Update }) {
  const textField = (key: 'name' | 'realName' | 'playerName' | 'concept', label: string) => (
    <Field label={label}>
      <input
        className="input w-full"
        value={character[key]}
        onChange={(e) => {
          const value = e.target.value
          update((c) => ({ ...c, [key]: value }))
        }}
      />
    </Field>
  )

  function onPortrait(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const portrait = reader.result as string
      update((c) => ({ ...c, portrait }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <Section title="Basics">
      <div className="flex gap-4">
        <label className="group relative grid size-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded border border-line bg-white/[0.03] text-xs text-muted">
          {character.portrait ? (
            <img src={character.portrait} alt="Portrait" className="size-full object-cover" />
          ) : (
            'Add portrait'
          )}
          <input type="file" accept="image/*" hidden onChange={(e) => onPortrait(e.target.files?.[0])} />
        </label>
        <div className="grid flex-1 gap-3">
          {textField('name', 'Street name')}
          {textField('realName', 'Real name')}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {textField('concept', 'Concept')}
        {textField('playerName', 'Player')}
        <Field label="Metatype">
          <select
            className="input w-full"
            value={character.metatype}
            onChange={(e) => {
              const metatype = e.target.value as Character['metatype']
              update((c) => ({ ...c, metatype }))
            }}
          >
            {METATYPE_IDS.map((m) => (
              <option key={m} value={m}>
                {METATYPES[m].name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Section>
  )
}

function AttributesSection({ character, update }: { character: Character; update: Update }) {
  const group = (ids: readonly AttributeId[]) =>
    ids.map((attribute) => {
      const max = attributeMaximum(character.metatype, attribute)
      const value = character.attributes[attribute]
      return (
        <Field key={attribute} label={`${ATTRIBUTE_LABELS[attribute].name} (max ${max})`}>
          <NumberInput
            value={value}
            min={0}
            className={value > max ? 'border-danger text-danger' : ''}
            onChange={(v) => update((c) => ({ ...c, attributes: { ...c.attributes, [attribute]: v } }))}
          />
        </Field>
      )
    })

  return (
    <Section title="Attributes">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {group(PHYSICAL_ATTRIBUTES)}
        {group(MENTAL_ATTRIBUTES)}
        {group(SPECIAL_ATTRIBUTES)}
        <Field label="Essence">
          <EssenceInput character={character} update={update} />
        </Field>
      </div>
    </Section>
  )
}

function SkillsSection({ character, update }: { character: Character; update: Update }) {
  const [adding, setAdding] = useState('')
  const available = SKILLS.filter((s) => !character.skills.some((cs) => cs.skillId === s.id))

  function patchSkill(skillId: string, patch: Partial<Character['skills'][number]>) {
    update((c) => ({ ...c, skills: c.skills.map((s) => (s.id === skillId ? { ...s, ...patch } : s)) }))
  }

  return (
    <Section title="Skills">
      {character.skills.length === 0 && <p className="mb-3 text-sm text-muted">No skills yet.</p>}
      <ul className="mb-3 grid gap-2">
        {character.skills.map((skill) => {
          const def = SKILLS_BY_ID.get(skill.skillId)
          return (
            <li key={skill.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm sm:w-36 sm:flex-none">
                {def?.name ?? skill.skillId}
                {def && <span className="ml-1 text-xs text-muted">{ATTRIBUTE_LABELS[def.attribute].short}</span>}
              </span>
              <NumberInput
                value={skill.rating}
                min={0}
                className="!w-16"
                onChange={(rating) => patchSkill(skill.id, { rating })}
              />
              <input
                className="input order-last basis-full sm:order-none sm:basis-auto sm:flex-1"
                placeholder="Specialization"
                value={skill.specialization}
                onChange={(e) => patchSkill(skill.id, { specialization: e.target.value })}
              />
              <button
                className="px-2 text-muted hover:text-danger"
                aria-label={`Remove ${def?.name ?? 'skill'}`}
                onClick={() => update((c) => ({ ...c, skills: c.skills.filter((s) => s.id !== skill.id) }))}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      {available.length > 0 && (
        <select
          className="input w-full"
          value={adding}
          onChange={(e) => {
            const skillId = e.target.value
            setAdding('')
            if (!skillId) return
            update((c) => ({
              ...c,
              skills: [...c.skills, { id: crypto.randomUUID(), skillId, rating: 1, specialization: '', expertise: '' }],
            }))
          }}
        >
          <option value="">+ Add skill…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </Section>
  )
}

function ResourcesSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Resources">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Nuyen (¥)">
          <NumberInput value={character.nuyen} onChange={(nuyen) => update((c) => ({ ...c, nuyen }))} />
        </Field>
        <Field label="Karma available">
          <NumberInput
            value={character.karma.available}
            onChange={(available) => update((c) => ({ ...c, karma: { ...c.karma, available } }))}
          />
        </Field>
        <Field label="Career karma">
          <NumberInput
            value={character.karma.career}
            onChange={(career) => update((c) => ({ ...c, karma: { ...c.karma, career } }))}
          />
        </Field>
      </div>
    </Section>
  )
}
