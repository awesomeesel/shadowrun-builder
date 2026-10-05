import { ListEditor, type FieldDef } from '../../components/ListEditor'
import { useState } from 'react'
import { Section } from '../../components/ui'
import {
  ContactSchema,
  GearSchema,
  KnowledgeSkillSchema,
  LanguageSchema,
  QualitySchema,
  WeaponSchema,
  type Character,
  type Contact,
  type GearItem,
  type KnowledgeSkill,
  type Language,
  type Quality,
  type Weapon,
} from '../../model/character'
import { SKILLS } from '../../rules/sr6/skills'
import type { Update } from './CharacterPage'

type ListKey = 'qualities' | 'weapons' | 'gear' | 'contacts' | 'knowledgeSkills' | 'languages'

function setList<K extends ListKey>(update: Update, key: K) {
  return (items: Character[K]) => update((c) => ({ ...c, [key]: items }))
}

const qualityFields: FieldDef<Quality>[] = [
  { kind: 'text', key: 'name', label: 'Quality', span: 5, wide: true },
  {
    kind: 'select',
    key: 'kind',
    label: 'Type',
    span: 3,
    options: [
      { value: 'positive', label: 'Positive' },
      { value: 'negative', label: 'Negative' },
    ],
  },
  { kind: 'number', key: 'rating', label: 'Rating', span: 2, min: 1 },
  { kind: 'number', key: 'karma', label: 'Karma', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 12, wide: true },
]

const ATTACK_RANGES = ['Close', 'Near', 'Medium', 'Far', 'Extreme']

const weaponSkillOptions = SKILLS.filter((s) => ['firearms', 'close-combat', 'exotic-weapons', 'athletics'].includes(s.id)).map(
  (s) => ({ value: s.id, label: s.name }),
)

const weaponFields: FieldDef<Weapon>[] = [
  { kind: 'text', key: 'name', label: 'Weapon', span: 4, wide: true },
  { kind: 'select', key: 'skillId', label: 'Skill', span: 3, options: weaponSkillOptions },
  { kind: 'text', key: 'specialization', label: 'Specialization', span: 3, placeholder: 'e.g. Pistols' },
  { kind: 'text', key: 'damage', label: 'DV', span: 2, placeholder: '4P' },
  {
    kind: 'custom',
    label: 'Attack Ratings (blank = n/a)',
    span: 6,
    wide: true,
    render: (weapon, set) => (
      <div className="grid grid-cols-5 gap-1">
        {ATTACK_RANGES.map((range, i) => (
          <input
            key={range}
            className="input w-full px-1 text-center"
            inputMode="numeric"
            placeholder={range.charAt(0)}
            title={range}
            aria-label={`${range} attack rating`}
            value={weapon.attackRatings[i] ?? ''}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10)
              const attackRatings = [...weapon.attackRatings]
              attackRatings[i] = Number.isNaN(parsed) ? null : parsed
              set({ attackRatings })
            }}
          />
        ))}
      </div>
    ),
  },
  { kind: 'text', key: 'modes', label: 'Modes', span: 2, placeholder: 'SA/BF' },
  { kind: 'text', key: 'ammo', label: 'Ammo', span: 2, placeholder: '15(c)' },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes / accessories', span: 12, wide: true },
]

const gearFields: FieldDef<GearItem>[] = [
  { kind: 'text', key: 'name', label: 'Item', span: 4, wide: true },
  { kind: 'text', key: 'category', label: 'Category', span: 2, placeholder: 'Armor, Electronics…' },
  { kind: 'number', key: 'rating', label: 'Rating', span: 1, min: 0 },
  { kind: 'number', key: 'quantity', label: 'Qty', span: 1, min: 0 },
  { kind: 'number', key: 'armor', label: 'Armor', span: 1, min: 0 },
  { kind: 'checkbox', key: 'equipped', label: 'Worn', span: 1 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 12, wide: true },
]

const contactFields: FieldDef<Contact>[] = [
  { kind: 'text', key: 'name', label: 'Name', span: 4, wide: true },
  { kind: 'text', key: 'role', label: 'Role', span: 4, wide: true, placeholder: 'Fixer, Street doc…' },
  { kind: 'number', key: 'connection', label: 'Connection', span: 2, min: 1 },
  { kind: 'number', key: 'loyalty', label: 'Loyalty', span: 2, min: 1 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 12, wide: true },
]

const knowledgeFields: FieldDef<KnowledgeSkill>[] = [
  { kind: 'text', key: 'name', label: 'Knowledge skill', span: 12, wide: true, placeholder: 'e.g. Seattle gangs' },
]

const languageFields: FieldDef<Language>[] = [
  { kind: 'text', key: 'name', label: 'Language', span: 8 },
  {
    kind: 'select',
    key: 'level',
    label: 'Level',
    span: 4,
    options: [
      { value: 'native', label: 'Native' },
      { value: 'basic', label: 'Basic' },
      { value: 'specialist', label: 'Specialist' },
      { value: 'expert', label: 'Expert' },
    ],
  },
]

export function QualitiesSection({ character, update }: { character: Character; update: Update }) {
  const total = (kind: Quality['kind']) =>
    character.qualities.filter((q) => q.kind === kind).reduce((sum, q) => sum + q.karma, 0)
  return (
    <Section
      title="Qualities"
      aside={
        <span className="text-xs text-muted">
          +{total('positive')} / −{total('negative')} karma
        </span>
      }
    >
      <ListEditor
        items={character.qualities}
        onChange={setList(update, 'qualities')}
        fields={qualityFields}
        newItem={() => QualitySchema.parse({})}
        addLabel="Add quality"
        emptyText="No qualities."
      />
    </Section>
  )
}

export function WeaponsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Weapons" className="lg:col-span-2">
      <ListEditor
        items={character.weapons}
        onChange={setList(update, 'weapons')}
        fields={weaponFields}
        newItem={() => WeaponSchema.parse({})}
        addLabel="Add weapon"
        emptyText="No weapons."
      />
    </Section>
  )
}

export function GearSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Armor & gear" className="lg:col-span-2">
      <ListEditor
        items={character.gear}
        onChange={setList(update, 'gear')}
        fields={gearFields}
        newItem={() => GearSchema.parse({})}
        addLabel="Add item"
        emptyText="No gear. Armor counts toward Defense Rating when it has an armor value and is marked as worn."
      />
    </Section>
  )
}

export function ContactsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Contacts">
      <ListEditor
        items={character.contacts}
        onChange={setList(update, 'contacts')}
        fields={contactFields}
        newItem={() => ContactSchema.parse({})}
        addLabel="Add contact"
        emptyText="No contacts."
      />
    </Section>
  )
}

export function KnowledgeSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Knowledge & languages">
      <ListEditor
        items={character.languages}
        onChange={setList(update, 'languages')}
        fields={languageFields}
        newItem={() => LanguageSchema.parse({})}
        addLabel="Add language"
        emptyText="No languages."
      />
      <div className="mt-4">
        <ListEditor
          items={character.knowledgeSkills}
          onChange={setList(update, 'knowledgeSkills')}
          fields={knowledgeFields}
          newItem={() => KnowledgeSkillSchema.parse({})}
          addLabel="Add knowledge skill"
          emptyText="No knowledge skills."
        />
      </div>
    </Section>
  )
}

/** Essence is stored as hundredths lost; this edits the current value, e.g. 4.55 (or 4,55). */
export function EssenceInput({ character, update }: { character: Character; update: Update }) {
  const [draft, setDraft] = useState<string | null>(null)
  const essence = (600 - character.essenceLoss) / 100
  return (
    <input
      className="input w-full text-center"
      inputMode="decimal"
      value={draft ?? String(essence)}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = parseFloat(e.target.value.replace(',', '.'))
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 6) {
          update((c) => ({ ...c, essenceLoss: 600 - Math.round(parsed * 100) }))
        }
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
