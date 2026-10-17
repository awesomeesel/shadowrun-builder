/** A value that may scale with rating, as printed: "0.2" or "Rating x 0.2". */
export interface Scaled {
  base: number
  /** True when the printed value is "Rating x base". */
  perRating: boolean
  /** True for "Rating^2 x base". */
  squared?: boolean
}

export interface RatingRange {
  min: number
  max: number
}

interface EntryBase {
  /** 1-based PDF page where the entry was found. */
  page: number
  name: string
  /** Section label from the book, e.g. 'Heavy pistols' or 'Bodyware'. */
  category: string
}

/** An attribute in a stat block: "5(7)" is 5, augmented to 7. */
export interface NpcAttribute {
  base: number
  augmented: number
}

export type ExtractedEntry =
  | (EntryBase & {
      kind: 'weapon'
      damage: string
      modes: string
      attackRatings: (number | null)[]
      ammo: string
      availability: string
      cost: Scaled | null
    })
  | (EntryBase & {
      kind: 'augmentation'
      rating: RatingRange | null
      essence: Scaled | null
      capacity: string
      availability: string
      cost: Scaled | null
    })
  | (EntryBase & {
      kind: 'armor'
      rating: RatingRange | null
      defense: number
      capacity: string
      availability: string
      cost: Scaled | null
    })
  | (EntryBase & {
      kind: 'vehicle'
      drone: boolean
      handling: string
      acceleration: string
      speedInterval: string
      topSpeed: string
      body: number
      armor: number
      pilot: number
      sensor: number
      seats: string
      availability: string
      cost: Scaled | null
    })
  | (EntryBase & {
      kind: 'matrixDevice'
      deviceRating: number
      /** Attribute pair as printed, e.g. "3/1", and which attributes it covers. */
      attributes: string
      attributeNames: string
      /** How many programs can run at once (0 when the table doesn't say). */
      programSlots: number
      availability: string
      cost: Scaled | null
    })
  | (EntryBase & {
      kind: 'gear'
      rating: RatingRange | null
      availability: string
      cost: Scaled | null
    })
  | (EntryBase & {
      kind: 'quality'
      positive: boolean
      karma: number
      perLevel: boolean
      maxLevel: number | null
      /** The cost line as printed, for cases the number doesn't capture. */
      costText: string
    })
  | (EntryBase & {
      kind: 'adeptPower'
      powerPoints: number
      perLevel: boolean
      maxLevel: number | null
      activation: string
    })
  | (EntryBase & {
      kind: 'spell'
      spellCategory: string
      range: string
      type: string
      duration: string
      drain: string
      damage: string
    })
  | (EntryBase & {
      kind: 'complexForm'
      fading: string
      duration: string
    })
  | (EntryBase & {
      kind: 'npc'
      /** Professional Rating for grunts; null for others. */
      professionalRating: number | null
      metatype: string
      /** body…charisma, magic, resonance, edge, essence. */
      attributes: Record<string, NpcAttribute>
      defenseRating: number | null
      initiative: { score: number; dice: number } | null
      /** Actions per round as printed, e.g. "A1, I2". */
      actions: string
      /** One track for grunts (physical only), or Physical/Stun. */
      monitor: { physical: number | null; stun: number | null }
      move: string
      skills: string
      knowledge: string
      gear: string
      augmentations: string
      weapons: string
      spells: string
      powers: string
      weaknesses: string
      notes: string
    })

export type EntryKind = ExtractedEntry['kind']
