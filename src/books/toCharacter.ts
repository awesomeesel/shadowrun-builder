import type { Book, CatalogEntry } from '../db/db'
import {
  AdeptPowerSchema,
  AugmentationSchema,
  ComplexFormSchema,
  GearSchema,
  MatrixDeviceSchema,
  QualitySchema,
  SpellSchema,
  VehicleSchema,
  WeaponSchema,
  type Bonuses,
  type Character,
  type SourceRef,
} from '../model/character'
import type { GradeId } from '../rules/sr6/special'
import type { ExtractedEntry, RatingRange } from './extract/types'
import { atRating } from './extract/values'
import { pdfPageToPrinted } from './pages'

/** Choices the user makes when adding a catalog item. */
export interface PickOptions {
  /** Rating for rated gear and augmentations, or level for qualities and powers. */
  rating: number
  grade: GradeId
}

/** Which character list an entry is added to. */
export type TargetList =
  | 'qualities'
  | 'weapons'
  | 'gear'
  | 'augmentations'
  | 'spells'
  | 'adeptPowers'
  | 'complexForms'
  | 'matrixDevices'
  | 'vehicles'

export const TARGET_LIST: Record<ExtractedEntry['kind'], TargetList> = {
  quality: 'qualities',
  weapon: 'weapons',
  armor: 'gear',
  gear: 'gear',
  augmentation: 'augmentations',
  spell: 'spells',
  adeptPower: 'adeptPowers',
  complexForm: 'complexForms',
  matrixDevice: 'matrixDevices',
  vehicle: 'vehicles',
}

/** The rating range a user can pick for an entry, or null when it has none. */
export function ratingRange(entry: ExtractedEntry): RatingRange | null {
  switch (entry.kind) {
    case 'augmentation':
    case 'armor':
    case 'gear':
      return entry.rating
    case 'quality':
    case 'adeptPower':
      return entry.perLevel ? { min: 1, max: entry.maxLevel ?? 6 } : null
    default:
      return null
  }
}

function sourceRef(entry: ExtractedEntry, book: Book | undefined): SourceRef | undefined {
  if (!book) return undefined
  const printed = parseInt(pdfPageToPrinted(book, entry.page), 10)
  return Number.isNaN(printed) ? undefined : { book: book.code || book.title, page: printed }
}

// Well-known bonuses that tables don't list. VERIFY against the Core Rulebook.
const KNOWN_BONUSES: [RegExp, (rating: number) => Bonuses][] = [
  [/^wired reflexes/i, (r) => ({ attributes: { reaction: r }, initiativeDice: r })],
  [/^synaptic booster/i, (r) => ({ attributes: { reaction: r }, initiativeDice: r })],
  [/^reaction enhancers?/i, (r) => ({ attributes: { reaction: r }, initiativeDice: 0 })],
  [/^muscle toner/i, (r) => ({ attributes: { agility: r }, initiativeDice: 0 })],
  [/^muscle augmentation/i, (r) => ({ attributes: { strength: r }, initiativeDice: 0 })],
  [/^cerebral booster/i, (r) => ({ attributes: { logic: r }, initiativeDice: 0 })],
  [/^improved reflexes/i, (r) => ({ attributes: { reaction: r }, initiativeDice: r })],
]

function knownBonuses(name: string, rating: number): Bonuses {
  const r = Math.max(1, rating || parseInt(name.match(/(\d+)\s*$/)?.[1] ?? '1', 10))
  for (const [pattern, bonus] of KNOWN_BONUSES) if (pattern.test(name)) return bonus(r)
  return { attributes: {}, initiativeDice: 0 }
}

/** Turn a catalog entry into an item for the character, with a page reference to the book. */
export function toCharacterItem(
  entry: CatalogEntry,
  book: Book | undefined,
  options: PickOptions,
): { list: TargetList; item: Character[TargetList][number] } {
  const source = sourceRef(entry, book)
  const r = options.rating
  const cost = 'cost' in entry ? Math.round(atRating(entry.cost, r)) : 0
  const list = TARGET_LIST[entry.kind]

  switch (entry.kind) {
    case 'quality':
      return {
        list,
        item: QualitySchema.parse({
          name: entry.name,
          kind: entry.positive ? 'positive' : 'negative',
          rating: entry.perLevel ? r : 1,
          karma: entry.perLevel ? entry.karma * r : entry.karma,
          notes: entry.perLevel || /\d+\s*to\s*\d+/.test(entry.costText) ? entry.costText : '',
          source,
        }),
      }
    case 'weapon':
      return {
        list,
        item: WeaponSchema.parse({
          name: entry.name,
          skillId: /melee|blade|club|whip|taser/i.test(entry.category)
            ? 'close-combat'
            : /exotic|launcher/i.test(entry.category)
              ? 'exotic-weapons'
              : 'firearms',
          specialization: entry.category,
          damage: entry.damage,
          attackRatings: entry.attackRatings,
          modes: entry.modes,
          ammo: entry.ammo,
          cost,
          source,
        }),
      }
    case 'armor':
      return {
        list,
        item: GearSchema.parse({
          name: entry.name,
          category: entry.category,
          armor: entry.defense,
          rating: r,
          cost,
          source,
        }),
      }
    case 'gear':
      return { list, item: GearSchema.parse({ name: entry.name, category: entry.category, rating: r, cost, source }) }
    case 'augmentation':
      return {
        list,
        item: AugmentationSchema.parse({
          name: entry.name,
          kind: /bio|cultured/i.test(entry.category) ? 'bioware' : 'cyberware',
          grade: options.grade,
          rating: r,
          essence: Math.round(atRating(entry.essence, r) * 100) / 100,
          cost,
          bonuses: knownBonuses(entry.name, r),
          source,
        }),
      }
    case 'spell':
      return {
        list,
        item: SpellSchema.parse({
          name: entry.name,
          category: entry.spellCategory,
          type: /^p/i.test(entry.type) ? 'physical' : 'mana',
          range: entry.range,
          duration: entry.duration,
          drain: entry.drain,
          notes: entry.damage ? `Damage ${entry.damage}` : '',
          source,
        }),
      }
    case 'adeptPower':
      return {
        list,
        item: AdeptPowerSchema.parse({
          name: entry.name,
          level: entry.perLevel ? r : 0,
          powerPoints: Math.round((entry.perLevel ? entry.powerPoints * r : entry.powerPoints) * 100) / 100,
          bonuses: knownBonuses(entry.name, r),
          notes: entry.activation ? `Activation: ${entry.activation}` : '',
          source,
        }),
      }
    case 'complexForm':
      return {
        list,
        item: ComplexFormSchema.parse({ name: entry.name, fading: entry.fading, duration: entry.duration, source }),
      }
    case 'matrixDevice': {
      const [first = 0, second = 0] = entry.attributes.split('/').map((v) => parseInt(v, 10) || 0)
      const offensive = /A\/S/i.test(entry.attributeNames)
      return {
        list,
        item: MatrixDeviceSchema.parse({
          name: entry.name,
          kind: /deck/i.test(entry.category)
            ? 'cyberdeck'
            : /rigger|rcc/i.test(entry.category)
              ? 'rcc'
              : /commlink/i.test(entry.category)
                ? 'commlink'
                : 'other',
          deviceRating: entry.deviceRating,
          attack: offensive ? first : 0,
          sleaze: offensive ? second : 0,
          dataProcessing: offensive ? 0 : first,
          firewall: offensive ? 0 : second,
          cost,
          source,
        }),
      }
    }
    case 'vehicle':
      return {
        list,
        item: VehicleSchema.parse({
          name: entry.name,
          kind: entry.drone ? 'drone' : 'vehicle',
          handling: entry.handling,
          acceleration: entry.acceleration,
          speedInterval: entry.speedInterval,
          topSpeed: entry.topSpeed,
          body: entry.body,
          armor: entry.armor,
          pilot: entry.pilot,
          sensor: entry.sensor,
          seats: entry.seats,
          cost,
          source,
        }),
      }
  }
}

/** One line of key stats for showing an entry in a list. */
export function entrySummary(entry: ExtractedEntry): string {
  const yen = (e: { cost: { base: number; perRating: boolean; squared?: boolean } | null }) =>
    e.cost ? `${e.cost.perRating ? `R${e.cost.squared ? '²' : ''}×` : ''}${e.cost.base.toLocaleString()}¥` : ''
  switch (entry.kind) {
    case 'weapon':
      return [entry.damage, entry.modes, entry.attackRatings.map((a) => a ?? '–').join('/'), entry.ammo, yen(entry)]
        .filter(Boolean)
        .join(' · ')
    case 'augmentation':
      return [
        entry.essence ? `Ess ${entry.essence.perRating ? 'R×' : ''}${entry.essence.base}` : '',
        entry.rating ? `R${entry.rating.min}–${entry.rating.max}` : '',
        yen(entry),
      ]
        .filter(Boolean)
        .join(' · ')
    case 'armor':
      return [`+${entry.defense} DR`, yen(entry)].join(' · ')
    case 'gear':
      return [entry.rating ? `R${entry.rating.min}–${entry.rating.max}` : '', yen(entry)].filter(Boolean).join(' · ')
    case 'matrixDevice':
      return [`DR ${entry.deviceRating}`, entry.attributes && `${entry.attributeNames} ${entry.attributes}`, yen(entry)]
        .filter(Boolean)
        .join(' · ')
    case 'vehicle':
      return [`Hand ${entry.handling}`, `Body ${entry.body}`, `Armor ${entry.armor}`, yen(entry)].join(' · ')
    case 'quality':
      return `${entry.positive ? '' : 'Bonus '}${entry.costText}`
    case 'adeptPower':
      return `${entry.powerPoints} PP${entry.perLevel ? ' per level' : ''}${entry.activation ? ` · ${entry.activation}` : ''}`
    case 'spell':
      return [entry.range, entry.type, entry.duration, entry.drain && `Drain ${entry.drain}`]
        .filter(Boolean)
        .join(' · ')
    case 'complexForm':
      return [entry.duration, entry.fading && `Fade ${entry.fading}`].filter(Boolean).join(' · ')
  }
}
