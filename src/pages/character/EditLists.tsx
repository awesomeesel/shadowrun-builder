import { ListEditor, type FieldDef } from '../../components/ListEditor'
import { useState } from 'react'
import { DecimalInput, NumberInput, Section } from '../../components/ui'
import {
  AdeptPowerSchema,
  AugmentationSchema,
  ComplexFormSchema,
  MatrixDeviceSchema,
  SpellSchema,
  VehicleSchema,
  type AdeptPower,
  type Augmentation,
  type Bonuses,
  type ComplexForm,
  type MatrixDevice,
  type Spell,
  type Vehicle,
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
  type SourceRef,
  type Weapon,
} from '../../model/character'
import { SourceInput } from '../../components/SourceLink'
import { formatBonuses, parseBonuses } from '../../rules/sr6/bonuses'
import { computeDerived } from '../../rules/sr6/derived'
import { SKILLS } from '../../rules/sr6/skills'
import {
  AUGMENTATION_GRADES,
  AUGMENTATION_KINDS,
  SPELL_CATEGORIES,
  TRADITIONS,
  type TraditionId,
} from '../../rules/sr6/special'
import type { Update } from './CharacterPage'

function sourceField<T extends { source?: SourceRef }>(span: 3 | 4 = 4): FieldDef<T> {
  return {
    kind: 'custom',
    label: 'Source',
    span,
    wide: true,
    render: (item, set) => <SourceInput value={item.source} onChange={(source) => set({ source } as Partial<T>)} />,
  }
}

type ListKey =
  | 'qualities'
  | 'weapons'
  | 'gear'
  | 'contacts'
  | 'knowledgeSkills'
  | 'languages'
  | 'augmentations'
  | 'spells'
  | 'adeptPowers'
  | 'complexForms'
  | 'vehicles'

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
  { kind: 'text', key: 'notes', label: 'Notes', span: 8, wide: true },
  sourceField<Quality>(),
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
  { kind: 'text', key: 'notes', label: 'Notes / accessories', span: 8, wide: true },
  sourceField<Weapon>(),
]

const gearFields: FieldDef<GearItem>[] = [
  { kind: 'text', key: 'name', label: 'Item', span: 4, wide: true },
  { kind: 'text', key: 'category', label: 'Category', span: 2, placeholder: 'Armor, Electronics…' },
  { kind: 'number', key: 'rating', label: 'Rating', span: 1, min: 0 },
  { kind: 'number', key: 'quantity', label: 'Qty', span: 1, min: 0 },
  { kind: 'number', key: 'armor', label: 'Armor', span: 1, min: 0 },
  { kind: 'checkbox', key: 'equipped', label: 'Worn', span: 1 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 8, wide: true },
  sourceField<GearItem>(),
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

/**
 * Edits the character's total Essence. Augmentations listed below already count;
 * whatever else is lost is stored as `essenceLoss`.
 */
export function EssenceInput({ character, update }: { character: Character; update: Update }) {
  const essence = computeDerived(character).essence
  const augmentationLoss = 600 - character.essenceLoss - Math.round(essence * 100)
  return (
    <DecimalInput
      value={essence}
      max={6}
      onChange={(value) =>
        update((c) => ({ ...c, essenceLoss: Math.max(0, 600 - Math.round(value * 100) - augmentationLoss) }))
      }
    />
  )
}

/** Text field for bonuses like "REA +2, +2D6"; turns red while the text can't be parsed. */
function BonusInput({ value, onChange }: { value: Bonuses; onChange: (value: Bonuses) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const invalid = draft !== null && parseBonuses(draft) === undefined
  return (
    <input
      className={`input w-full ${invalid ? 'border-danger' : ''}`}
      placeholder="REA +2, +2D6"
      title="Attribute bonuses (e.g. REA +2, AGI +1) and extra initiative dice (e.g. +2D6)"
      value={draft ?? formatBonuses(value)}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = parseBonuses(e.target.value)
        if (parsed) onChange(parsed)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

function bonusField<T extends { bonuses: Bonuses }>(span: 2 | 3 | 4): FieldDef<T> {
  return {
    kind: 'custom',
    label: 'Bonuses',
    span,
    wide: true,
    render: (item, set) => <BonusInput value={item.bonuses} onChange={(bonuses) => set({ bonuses } as Partial<T>)} />,
  }
}

function decimalField<T>(key: keyof T & string, label: string, span: 1 | 2): FieldDef<T> {
  return {
    kind: 'custom',
    label,
    span,
    render: (item, set) => (
      <DecimalInput value={Number(item[key] ?? 0)} onChange={(v) => set({ [key]: v } as Partial<T>)} />
    ),
  }
}

const options = <T extends string>(entries: Record<T, string> | readonly T[]) =>
  Array.isArray(entries)
    ? entries.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))
    : Object.entries<string>(entries as Record<T, string>).map(([value, label]) => ({ value, label }))

const augmentationFields: FieldDef<Augmentation>[] = [
  { kind: 'text', key: 'name', label: 'Augmentation', span: 4, wide: true },
  { kind: 'select', key: 'kind', label: 'Type', span: 2, options: options(AUGMENTATION_KINDS) },
  {
    kind: 'select',
    key: 'grade',
    label: 'Grade',
    span: 2,
    options: Object.entries(AUGMENTATION_GRADES).map(([value, g]) => ({ value, label: g.name })),
  },
  { kind: 'number', key: 'rating', label: 'Rating', span: 1, min: 0 },
  decimalField<Augmentation>('essence', 'Essence', 1),
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  bonusField<Augmentation>(4),
  { kind: 'text', key: 'notes', label: 'Notes', span: 4, wide: true },
  sourceField<Augmentation>(),
]

const spellFields: FieldDef<Spell>[] = [
  { kind: 'text', key: 'name', label: 'Spell', span: 4, wide: true },
  { kind: 'select', key: 'category', label: 'Category', span: 2, options: options(SPELL_CATEGORIES) },
  {
    kind: 'select',
    key: 'type',
    label: 'Type',
    span: 2,
    options: [
      { value: 'mana', label: 'Mana' },
      { value: 'physical', label: 'Physical' },
    ],
  },
  { kind: 'text', key: 'range', label: 'Range', span: 1, placeholder: 'LOS' },
  { kind: 'text', key: 'duration', label: 'Duration', span: 1, placeholder: 'I' },
  { kind: 'text', key: 'drain', label: 'Drain', span: 2, placeholder: '4' },
  { kind: 'text', key: 'notes', label: 'Notes', span: 8, wide: true },
  sourceField<Spell>(),
]

const adeptPowerFields: FieldDef<AdeptPower>[] = [
  { kind: 'text', key: 'name', label: 'Power', span: 4, wide: true },
  { kind: 'number', key: 'level', label: 'Level', span: 1, min: 0 },
  decimalField<AdeptPower>('powerPoints', 'PP', 1),
  bonusField<AdeptPower>(3),
  sourceField<AdeptPower>(3),
  { kind: 'text', key: 'notes', label: 'Notes', span: 12, wide: true },
]

const complexFormFields: FieldDef<ComplexForm>[] = [
  { kind: 'text', key: 'name', label: 'Complex form', span: 4, wide: true },
  { kind: 'text', key: 'duration', label: 'Duration', span: 2 },
  { kind: 'text', key: 'fading', label: 'Fading', span: 2 },
  sourceField<ComplexForm>(),
  { kind: 'text', key: 'notes', label: 'Notes', span: 12, wide: true },
]

const matrixDeviceFields: FieldDef<MatrixDevice>[] = [
  { kind: 'text', key: 'name', label: 'Device', span: 4, wide: true },
  {
    kind: 'select',
    key: 'kind',
    label: 'Type',
    span: 2,
    options: [
      { value: 'commlink', label: 'Commlink' },
      { value: 'cyberdeck', label: 'Cyberdeck' },
      { value: 'rcc', label: 'RCC' },
      { value: 'other', label: 'Other' },
    ],
  },
  { kind: 'number', key: 'deviceRating', label: 'DR', span: 1, min: 0 },
  { kind: 'number', key: 'attack', label: 'A', span: 1, min: 0 },
  { kind: 'number', key: 'sleaze', label: 'S', span: 1, min: 0 },
  { kind: 'number', key: 'dataProcessing', label: 'D', span: 1, min: 0 },
  { kind: 'number', key: 'firewall', label: 'F', span: 1, min: 0 },
  { kind: 'checkbox', key: 'active', label: 'Active', span: 1 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes / programs', span: 6, wide: true },
  sourceField<MatrixDevice>(),
]

const vehicleFields: FieldDef<Vehicle>[] = [
  { kind: 'text', key: 'name', label: 'Vehicle / drone', span: 4, wide: true },
  {
    kind: 'select',
    key: 'kind',
    label: 'Type',
    span: 2,
    options: [
      { value: 'vehicle', label: 'Vehicle' },
      { value: 'drone', label: 'Drone' },
    ],
  },
  { kind: 'text', key: 'handling', label: 'Handling', span: 2, placeholder: '4/3' },
  { kind: 'text', key: 'acceleration', label: 'Accel', span: 1 },
  { kind: 'text', key: 'speedInterval', label: 'Spd int.', span: 1 },
  { kind: 'text', key: 'topSpeed', label: 'Top spd', span: 2 },
  { kind: 'number', key: 'body', label: 'Body', span: 1, min: 0 },
  { kind: 'number', key: 'armor', label: 'Armor', span: 1, min: 0 },
  { kind: 'number', key: 'pilot', label: 'Pilot', span: 1, min: 0 },
  { kind: 'number', key: 'sensor', label: 'Sensor', span: 1, min: 0 },
  { kind: 'text', key: 'seats', label: 'Seats', span: 1 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes / mods', span: 5, wide: true },
  sourceField<Vehicle>(),
]

export function AugmentationsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section
      title="Augmentations"
      className="lg:col-span-2"
      aside={<span className="text-xs text-muted">Essence {computeDerived(character).essence}</span>}
    >
      <ListEditor
        items={character.augmentations}
        onChange={setList(update, 'augmentations')}
        fields={augmentationFields}
        newItem={() => AugmentationSchema.parse({})}
        addLabel="Add augmentation"
        emptyText="No cyberware or bioware. Enter Essence and cost as printed; the grade multiplier is applied for you."
      />
    </Section>
  )
}

export function MagicSection({ character, update }: { character: Character; update: Update }) {
  const derived = computeDerived(character)
  const pp = derived.magic?.powerPoints
  return (
    <Section title="Magic" className="lg:col-span-2">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Tradition</span>
          <select
            className="input w-full"
            value={character.tradition}
            onChange={(e) => {
              const tradition = e.target.value as TraditionId
              update((c) => ({ ...c, tradition }))
            }}
          >
            {(Object.keys(TRADITIONS) as TraditionId[]).map((t) => (
              <option key={t} value={t}>
                {TRADITIONS[t].name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Power points bought (mystic adept)</span>
          <NumberInput
            value={character.powerPointsBought}
            min={0}
            onChange={(powerPointsBought) => update((c) => ({ ...c, powerPointsBought: Math.max(0, powerPointsBought) }))}
          />
        </label>
      </div>
      <h3 className="mb-2 text-xs tracking-wider text-muted uppercase">Spells</h3>
      <ListEditor
        items={character.spells}
        onChange={setList(update, 'spells')}
        fields={spellFields}
        newItem={() => SpellSchema.parse({})}
        addLabel="Add spell"
        emptyText="No spells."
      />
      <h3 className="mt-5 mb-2 flex justify-between text-xs tracking-wider text-muted uppercase">
        Adept powers
        {pp && (
          <span className={pp.used > pp.available ? 'text-danger' : ''}>
            {pp.used} / {pp.available} PP
          </span>
        )}
      </h3>
      <ListEditor
        items={character.adeptPowers}
        onChange={setList(update, 'adeptPowers')}
        fields={adeptPowerFields}
        newItem={() => AdeptPowerSchema.parse({})}
        addLabel="Add adept power"
        emptyText="No adept powers."
      />
    </Section>
  )
}

export function ComplexFormsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Complex forms" className="lg:col-span-2">
      <ListEditor
        items={character.complexForms}
        onChange={setList(update, 'complexForms')}
        fields={complexFormFields}
        newItem={() => ComplexFormSchema.parse({})}
        addLabel="Add complex form"
        emptyText="No complex forms."
      />
    </Section>
  )
}

export function MatrixDevicesSection({ character, update }: { character: Character; update: Update }) {
  // Only one device can be active; ticking one clears the others.
  const onChange = (devices: MatrixDevice[]) => {
    const previous = new Map(character.matrixDevices.map((d) => [d.id, d.active]))
    const activated = devices.find((d) => d.active && !previous.get(d.id))
    update((c) => ({
      ...c,
      matrixDevices: activated ? devices.map((d) => ({ ...d, active: d.id === activated.id })) : devices,
    }))
  }
  return (
    <Section title="Matrix devices" className="lg:col-span-2">
      <ListEditor
        items={character.matrixDevices}
        onChange={onChange}
        fields={matrixDeviceFields}
        newItem={() => MatrixDeviceSchema.parse({ active: character.matrixDevices.length === 0 })}
        addLabel="Add device"
        emptyText="No commlink, cyberdeck or RCC. The active device is used for Matrix stats on the sheet."
      />
    </Section>
  )
}

export function VehiclesSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Vehicles & drones" className="lg:col-span-2">
      <ListEditor
        items={character.vehicles}
        onChange={setList(update, 'vehicles')}
        fields={vehicleFields}
        newItem={() => VehicleSchema.parse({})}
        addLabel="Add vehicle or drone"
        emptyText="No vehicles or drones."
      />
    </Section>
  )
}
