import {
  AppWindow,
  Backpack,
  IdCard,
  BookOpen,
  Car,
  Cpu,
  Crosshair,
  Flame,
  Radio,
  Star,
  TriangleAlert,
  Users,
  Wifi,
} from 'lucide-react'
import { noAutofill, noAutofillField } from '../../components/noAutofill'
import type { EntryKind } from '../../books/extract'
import { AddFromBooks } from '../../components/CatalogPicker'
import { addFromCatalog } from './addFromCatalog'
import { ListEditor, type FieldDef } from '../../components/ListEditor'
import { useState } from 'react'
import { DecimalInput, NumberInput, Section } from '../../components/ui'
import {
  LicenseSchema,
  LifestyleSchema,
  SinSchema,
  type License,
  type Lifestyle,
  type Sin,
  AdeptPowerSchema,
  AugmentationSchema,
  ComplexFormSchema,
  MatrixDeviceSchema,
  ProgramSchema,
  SpellSchema,
  VehicleSchema,
  type AdeptPower,
  type Augmentation,
  type Bonuses,
  type ComplexForm,
  type MatrixDevice,
  type Program,
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
import {
  PROGRAM_COST,
  PROGRAM_KIND_LABELS,
  PROGRAMS,
  findProgram,
  setDeviceActive,
  type ProgramDef,
} from '../../rules/sr6/matrix'
import { PersonaSummary } from './MatrixParts'
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

const fromBooks = (update: Update, kinds: EntryKind[]) => <AddFromBooks kinds={kinds} onAdd={addFromCatalog(update)} />

type ListKey =
  | 'sins'
  | 'licenses'
  | 'lifestyles'
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
  | 'programs'
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

const weaponSkillOptions = SKILLS.filter((s) =>
  ['firearms', 'close-combat', 'exotic-weapons', 'athletics'].includes(s.id),
).map((s) => ({ value: s.id, label: s.name }))

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
            {...noAutofill}
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
      icon={<Star className="size-4" />}
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
        addLabel="Type in quality"
        extra={fromBooks(update, ['quality'])}
        emptyText="No qualities."
      />
    </Section>
  )
}

export function WeaponsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Weapons" icon={<Crosshair className="size-4" />} className="lg:col-span-2">
      <ListEditor
        items={character.weapons}
        onChange={setList(update, 'weapons')}
        fields={weaponFields}
        newItem={() => WeaponSchema.parse({})}
        addLabel="Type in weapon"
        extra={fromBooks(update, ['weapon'])}
        emptyText="No weapons."
      />
    </Section>
  )
}

export function GearSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Armor & gear" icon={<Backpack className="size-4" />} className="lg:col-span-2">
      <ListEditor
        items={character.gear}
        onChange={setList(update, 'gear')}
        fields={gearFields}
        newItem={() => GearSchema.parse({})}
        addLabel="Type in item"
        extra={fromBooks(update, ['armor', 'gear'])}
        emptyText="No gear. Armor counts toward Defense Rating when it has an armor value and is marked as worn."
      />
    </Section>
  )
}

export function ContactsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Contacts" icon={<Users className="size-4" />}>
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
    <Section title="Knowledge & languages" icon={<BookOpen className="size-4" />}>
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

/** Text field for bonuses like "Reaction +2, +2D6, Defense Rating +1"; turns red while the text can't be parsed. */
function BonusInput({ value, onChange }: { value: Bonuses; onChange: (value: Bonuses) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const invalid = draft !== null && parseBonuses(draft) === undefined
  return (
    <>
      <input
        {...noAutofill}
        className={`input w-full ${invalid ? 'border-danger' : ''}`}
        placeholder="Reaction +2, +2D6"
        title={BONUS_HELP}
        value={draft ?? formatBonuses(value)}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parseBonuses(e.target.value)
          if (parsed) onChange(parsed)
        }}
        onBlur={() => setDraft(null)}
      />
      {invalid && <span className="mt-0.5 block text-[11px] text-danger">{BONUS_HELP}</span>}
    </>
  )
}

const BONUS_HELP =
  'Separate with commas. Understood: attributes (Body +1), initiative dice (+1D6), Defense Rating +1, ' +
  'Physical damage resistance +2, Unarmed attack rating +2, Unarmed damage +1, Unarmed physical.'

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
      { value: 'cyberjack', label: 'Cyberjack' },
      { value: 'rcc', label: 'Rigger console (RCC)' },
      { value: 'other', label: 'Other' },
    ],
  },
  { kind: 'number', key: 'deviceRating', label: 'Device rating', span: 2, min: 0 },
  { kind: 'number', key: 'programSlots', label: 'Program slots', span: 2, min: 0 },
  { kind: 'checkbox', key: 'active', label: 'In use', span: 2 },
  { kind: 'number', key: 'attack', label: 'Attack', span: 2, min: 0 },
  { kind: 'number', key: 'sleaze', label: 'Sleaze', span: 2, min: 0 },
  { kind: 'number', key: 'dataProcessing', label: 'Data Processing', span: 2, min: 0 },
  { kind: 'number', key: 'firewall', label: 'Firewall', span: 2, min: 0 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 4, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 8, wide: true },
  sourceField<MatrixDevice>(),
]

const programFields: FieldDef<Program>[] = [
  {
    kind: 'custom',
    label: 'Program',
    span: 5,
    wide: true,
    render: (item, set) => {
      const effect = findProgram(item.name)?.effect
      return (
        <>
          <input
            {...noAutofill}
            className="input w-full"
            value={item.name}
            onChange={(e) => set({ name: e.target.value })}
          />
          {effect && <span className="mt-0.5 block text-[11px] text-muted">{effect}</span>}
        </>
      )
    },
  },
  {
    kind: 'select',
    key: 'kind',
    label: 'Type',
    span: 2,
    options: Object.entries(PROGRAM_KIND_LABELS).map(([value, label]) => ({ value, label })),
  },
  { kind: 'checkbox', key: 'running', label: 'Running', span: 1 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 1, min: 0 },
  sourceField<Program>(3),
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
  { kind: 'text', key: 'acceleration', label: 'Acceleration', span: 1 },
  { kind: 'text', key: 'speedInterval', label: 'Speed interval', span: 1 },
  { kind: 'text', key: 'topSpeed', label: 'Top speed', span: 2 },
  { kind: 'number', key: 'body', label: 'Body', span: 1, min: 0 },
  { kind: 'number', key: 'armor', label: 'Armor', span: 1, min: 0 },
  { kind: 'number', key: 'pilot', label: 'Pilot', span: 1, min: 0 },
  { kind: 'number', key: 'sensor', label: 'Sensor', span: 1, min: 0 },
  { kind: 'text', key: 'seats', label: 'Seats', span: 1 },
  { kind: 'number', key: 'cost', label: 'Cost ¥', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes / mods', span: 5, wide: true },
  {
    kind: 'text',
    key: 'autosofts',
    label: 'Autosofts (drones)',
    span: 8,
    wide: true,
    placeholder: 'Targeting 3, Evasion 2, Maneuvering 2, Clearsight 2',
  },
  sourceField<Vehicle>(),
]

export function AugmentationsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section
      title="Augmentations"
      icon={<Cpu className="size-4" />}
      className="lg:col-span-2"
      aside={<span className="text-xs text-muted">Essence {computeDerived(character).essence}</span>}
    >
      <ListEditor
        items={character.augmentations}
        onChange={setList(update, 'augmentations')}
        fields={augmentationFields}
        newItem={() => AugmentationSchema.parse({})}
        addLabel="Type in augmentation"
        extra={fromBooks(update, ['augmentation'])}
        emptyText="No cyberware or bioware. Enter Essence and cost as printed; the grade multiplier is applied for you."
      />
    </Section>
  )
}

export function MagicSection({ character, update }: { character: Character; update: Update }) {
  const derived = computeDerived(character)
  const pp = derived.magic?.powerPoints
  return (
    <Section title="Magic" icon={<Flame className="size-4" />} className="lg:col-span-2">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Tradition</span>
          <select
            {...noAutofillField}
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
            onChange={(powerPointsBought) =>
              update((c) => ({ ...c, powerPointsBought: Math.max(0, powerPointsBought) }))
            }
          />
        </label>
        <GradeFields character={character} update={update} kind="initiation" />
      </div>
      <h3 className="mb-2 text-xs tracking-wider text-muted uppercase">Spells</h3>
      <ListEditor
        items={character.spells}
        onChange={setList(update, 'spells')}
        fields={spellFields}
        newItem={() => SpellSchema.parse({})}
        addLabel="Type in spell"
        extra={fromBooks(update, ['spell'])}
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
        addLabel="Type in adept power"
        extra={fromBooks(update, ['adeptPower'])}
        emptyText="No adept powers."
      />
    </Section>
  )
}

export function ComplexFormsSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Complex forms" icon={<Radio className="size-4" />} className="lg:col-span-2">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GradeFields character={character} update={update} kind="submersion" />
      </div>
      <ListEditor
        items={character.complexForms}
        onChange={setList(update, 'complexForms')}
        fields={complexFormFields}
        newItem={() => ComplexFormSchema.parse({})}
        addLabel="Type in complex form"
        extra={fromBooks(update, ['complexForm'])}
        emptyText="No complex forms."
      />
    </Section>
  )
}

export function MatrixDevicesSection({ character, update }: { character: Character; update: Update }) {
  // Several devices can be in use (deck + cyberjack), but only one of each type.
  const onChange = (devices: MatrixDevice[]) => {
    const previous = new Map(character.matrixDevices.map((d) => [d.id, d.active]))
    const switchedOn = devices.find((d) => d.active && !previous.get(d.id))
    update((c) => ({ ...c, matrixDevices: switchedOn ? setDeviceActive(devices, switchedOn.id, true) : devices }))
  }
  const matrix = computeDerived(character).matrix
  return (
    <Section title="Matrix devices" icon={<Wifi className="size-4" />} className="lg:col-span-2">
      <p className="mb-3 text-sm text-muted">
        Tick <span className="text-fg">In use</span> on everything your persona runs on. A decker uses a cyberdeck
        (Attack and Sleaze) together with a cyberjack (Data Processing and Firewall); without a jack, a commlink can
        provide those. A cyberjack bought under Augmentations counts automatically.
      </p>
      {matrix && (
        <div className="mb-3">
          <PersonaSummary matrix={matrix} />
        </div>
      )}
      <ListEditor
        items={character.matrixDevices}
        onChange={onChange}
        fields={matrixDeviceFields}
        newItem={() => MatrixDeviceSchema.parse({ active: !character.matrixDevices.some((d) => d.active) })}
        addLabel="Type in device"
        extra={fromBooks(update, ['matrixDevice'])}
        emptyText="No commlink, cyberdeck or RCC yet."
      />
    </Section>
  )
}

export function ProgramsSection({ character, update }: { character: Character; update: Update }) {
  const matrix = computeDerived(character).matrix
  const owned = new Set(character.programs.map((p) => p.name.trim().toLowerCase()))
  const slotsLeft = matrix ? matrix.programSlots - matrix.runningPrograms.length : 0
  const add = (def: ProgramDef) =>
    update((c) => ({
      ...c,
      programs: [
        ...c.programs,
        ProgramSchema.parse({
          name: def.name,
          kind: def.kind,
          cost: PROGRAM_COST[def.kind],
          running: slotsLeft > 0,
          source: { book: 'CRB', page: def.page },
        }),
      ],
    }))
  const boughtAsGear = character.gear.filter((g) => /program|software/i.test(`${g.name} ${g.category}`))
  return (
    <Section title="Programs" icon={<AppWindow className="size-4" />} className="lg:col-span-2">
      <p className="mb-3 text-sm text-muted">
        Your software library. Everything here is owned; tick <span className="text-fg">Running</span> on the ones
        loaded right now. How many can run at once is the program slots of your deck (or commlink).
        {matrix?.device && (
          <>
            {' '}
            Now: <span className="text-fg">{matrix.runningPrograms.length}</span> of{' '}
            <span className="text-fg">{matrix.programSlots}</span> slots on {matrix.device.name || 'your device'}.
          </>
        )}
      </p>
      {boughtAsGear.length > 0 && (
        <p className="mb-3 flex gap-2 text-sm text-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {boughtAsGear.map((g) => g.name).join(', ')} {boughtAsGear.length === 1 ? 'is' : 'are'} listed under Gear. Add
          each program here instead so it can run on your deck, then remove the gear entry.
        </p>
      )}
      <ListEditor
        items={character.programs}
        onChange={setList(update, 'programs')}
        fields={programFields}
        newItem={() => ProgramSchema.parse({ running: slotsLeft > 0 })}
        addLabel="Type in program"
        emptyText="No programs yet. Pick some below."
      />
      {(['basic', 'hacking'] as const).map((kind) => {
        const choices = PROGRAMS.filter((p) => p.kind === kind && !owned.has(p.name.toLowerCase()))
        if (choices.length === 0) return null
        return (
          <div key={kind} className="mt-3">
            <div className="mb-1 text-xs text-muted">
              Add {PROGRAM_KIND_LABELS[kind].toLowerCase()} program ({PROGRAM_COST[kind]}¥ each)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((p) => (
                <button
                  key={p.name}
                  className="chip cursor-pointer border-accent/30 text-fg hover:border-accent hover:text-accent"
                  title={p.effect}
                  onClick={() => add(p)}
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </Section>
  )
}

export function VehiclesSection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="Vehicles & drones" icon={<Car className="size-4" />} className="lg:col-span-2">
      <ListEditor
        items={character.vehicles}
        onChange={setList(update, 'vehicles')}
        fields={vehicleFields}
        newItem={() => VehicleSchema.parse({})}
        addLabel="Type in vehicle or drone"
        extra={fromBooks(update, ['vehicle'])}
        emptyText="No vehicles or drones."
      />
    </Section>
  )
}

const sinFields: FieldDef<Sin>[] = [
  { kind: 'text', key: 'name', label: 'SIN name', span: 5, wide: true, placeholder: 'e.g. Jack Smith' },
  { kind: 'number', key: 'rating', label: 'Rating (0 = real)', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 5, wide: true },
]

const licenseFields: FieldDef<License>[] = [
  { kind: 'text', key: 'name', label: 'License', span: 4, wide: true, placeholder: 'e.g. Concealed carry' },
  { kind: 'text', key: 'sin', label: 'On SIN', span: 3 },
  { kind: 'number', key: 'rating', label: 'Rating', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 3, wide: true },
]

const lifestyleFields: FieldDef<Lifestyle>[] = [
  { kind: 'text', key: 'name', label: 'Lifestyle', span: 4, wide: true, placeholder: 'e.g. Coffin motel' },
  { kind: 'text', key: 'level', label: 'Level', span: 2, placeholder: 'Low' },
  { kind: 'number', key: 'cost', label: 'Cost ¥/month', span: 2, min: 0 },
  { kind: 'number', key: 'monthsPaid', label: 'Months paid', span: 2, min: 0 },
  { kind: 'text', key: 'notes', label: 'Notes', span: 2, wide: true },
]

export function IdentitySection({ character, update }: { character: Character; update: Update }) {
  return (
    <Section title="SINs, licenses & lifestyle" icon={<IdCard className="size-4" />} className="lg:col-span-2">
      <ListEditor
        items={character.sins}
        onChange={setList(update, 'sins')}
        fields={sinFields}
        newItem={() => SinSchema.parse({})}
        addLabel="Add SIN"
        emptyText="No SINs."
      />
      <h3 className="mt-5 mb-2 text-xs tracking-wider text-muted uppercase">Licenses</h3>
      <ListEditor
        items={character.licenses}
        onChange={setList(update, 'licenses')}
        fields={licenseFields}
        newItem={() => LicenseSchema.parse({ sin: character.sins[0]?.name ?? '' })}
        addLabel="Add license"
        emptyText="No licenses."
      />
      <h3 className="mt-5 mb-2 text-xs tracking-wider text-muted uppercase">Lifestyle</h3>
      <ListEditor
        items={character.lifestyles}
        onChange={setList(update, 'lifestyles')}
        fields={lifestyleFields}
        newItem={() => LifestyleSchema.parse({})}
        addLabel="Add lifestyle"
        emptyText="No lifestyle."
      />
    </Section>
  )
}

/**
 * Initiate Grade and metamagics, or Submersion grade and echoes, for typing in
 * an existing character. New grades are bought on the Karma tab.
 */
function GradeFields({
  character,
  update,
  kind,
}: {
  character: Character
  update: Update
  kind: 'initiation' | 'submersion'
}) {
  const initiation = kind === 'initiation'
  const grade = initiation ? character.initiateGrade : character.submersionGrade
  const list = initiation ? character.metamagics : character.echoes
  const [draft, setDraft] = useState<string | null>(null)
  const setList = (text: string) => {
    const items = text
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    update((c) => (initiation ? { ...c, metamagics: items } : { ...c, echoes: items }))
  }
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">{initiation ? 'Initiate grade' : 'Submersion grade'}</span>
        <NumberInput
          value={grade}
          min={0}
          onChange={(n) =>
            update((c) =>
              initiation ? { ...c, initiateGrade: Math.max(0, n) } : { ...c, submersionGrade: Math.max(0, n) },
            )
          }
        />
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs text-muted">{initiation ? 'Metamagics' : 'Echoes'} (comma-separated)</span>
        <input
          {...noAutofill}
          className="input w-full"
          placeholder={initiation ? 'Centering, Masking' : 'NeuroFilter, Matrix Attribute Upgrade: Firewall'}
          value={draft ?? list.join(', ')}
          onChange={(e) => {
            setDraft(e.target.value)
            setList(e.target.value)
          }}
          onBlur={() => setDraft(null)}
        />
      </label>
    </>
  )
}
