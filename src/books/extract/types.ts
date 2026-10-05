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

export type EntryKind = ExtractedEntry['kind']
