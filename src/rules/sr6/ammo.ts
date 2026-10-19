/**
 * Ammunition types and prices (Core Rulebook p. 262–263), in our own words.
 * A type's Attack Rating and Damage Value changes add to the weapon's. Prices
 * are per 10 rounds and depend on the class of gun; a type multiplies it.
 */
import type { Character, Weapon } from '../../model/character'

export interface AmmoType {
  id: string
  name: string
  /** Added to every Attack Rating the weapon has. */
  attackRating: number
  /** Added to the Damage Value. */
  damage: number
  /** Deals Stun instead of Physical. */
  stun: boolean
  /** Multiplies the price per 10 rounds. */
  cost: number
  /** What it does at the table, briefly. */
  note: string
}

export const AMMO_TYPES: AmmoType[] = [
  { id: 'regular', name: 'Regular', attackRating: 0, damage: 0, stun: false, cost: 1, note: 'Plain ball rounds.' },
  {
    id: 'apds',
    name: 'APDS',
    attackRating: 2,
    damage: -1,
    stun: false,
    cost: 3,
    note: 'Armor-piercing: better Attack Rating, a little less damage.',
  },
  {
    id: 'explosive',
    name: 'Explosive',
    attackRating: 0,
    damage: 1,
    stun: false,
    cost: 2,
    note: 'More damage. On a critical glitch the round blows up in the gun: you resist the damage, and the gun is wrecked.',
  },
  {
    id: 'flechette',
    name: 'Flechette',
    attackRating: 1,
    damage: -1,
    stun: false,
    cost: 1.5,
    note: 'Spreads a little: easier to land, less punch.',
  },
  {
    id: 'gel',
    name: 'Gel',
    attackRating: 0,
    damage: 0,
    stun: true,
    cost: 1.5,
    note: 'Stun damage. The target resists Agility (2) or Body (4) or goes Prone; +1 threshold for burst or full auto.',
  },
  {
    id: 'stick-n-shock',
    name: 'Stick-n-Shock',
    attackRating: 1,
    damage: -1,
    stun: true,
    cost: 2,
    note: 'Electrical Stun damage and the Zapped status.',
  },
]

export const AMMO_BY_ID = new Map(AMMO_TYPES.map((t) => [t.id, t]))

/** The type loaded in a weapon; regular unless the player picked another. */
export function loadedType(character: Character, weapon: Pick<Weapon, 'id'>): AmmoType {
  return AMMO_BY_ID.get(character.play.ammoType[weapon.id] ?? 'regular') ?? AMMO_TYPES[0]
}

/** Price per 10 regular rounds for the weapon's class (p. 262); 10¥ when the class isn't clear. */
export function pricePer10(weapon: Pick<Weapon, 'name' | 'specialization'>): number {
  const text = `${weapon.specialization} ${weapon.name}`.toLowerCase()
  if (/assault cannon/.test(text)) return 50
  if (/machine gun|\blmg\b|\bmmg\b|\bhmg\b/.test(text)) return 15
  if (/holdout|hold-out|light pistol|machine pistol/.test(text)) return 5
  if (/heavy pistol|smg|submachine/.test(text)) return 10
  if (/taser/.test(text)) return 10
  if (/rifle|shotgun|sniper|longarm/.test(text)) return 20
  return 10
}

/** What a number of rounds of a type costs, rounded up to whole nuyen. */
export function ammoPrice(weapon: Pick<Weapon, 'name' | 'specialization'>, type: AmmoType, rounds: number): number {
  return Math.ceil((pricePer10(weapon) * type.cost * rounds) / 10)
}

/** Damage after the ammo, e.g. 3P with explosive is 4P, with gel 3S. */
export function damageWith(damage: { value: number; type: string }, type: AmmoType): { value: number; type: string } {
  return { value: Math.max(0, damage.value + type.damage), type: type.stun ? 'S' : damage.type }
}

/** Spare rounds the runner carries for a weapon, per type. Undefined when they don't keep count. */
export const spareRounds = (character: Character, weapon: Pick<Weapon, 'id'>) => character.play.spareAmmo[weapon.id]

/**
 * Reload a weapon with a type of ammo. Rounds left in the old magazine go back
 * to the spares. When the runner doesn't count spare rounds, it just fills up.
 */
export function reload(character: Character, weapon: Weapon, capacity: number, typeId?: string): Character {
  const play = character.play
  const current = play.ammoType[weapon.id] ?? 'regular'
  const next = typeId ?? current
  const loaded = play.ammo[weapon.id] ?? capacity
  const spares = play.spareAmmo[weapon.id]
  if (!spares) {
    return {
      ...character,
      play: {
        ...play,
        ammo: { ...play.ammo, [weapon.id]: capacity },
        ammoType: { ...play.ammoType, [weapon.id]: next },
      },
    }
  }
  const pool = { ...spares }
  // Same type: top up. Another type: the old rounds go back in the box.
  let start = loaded
  if (next !== current) {
    pool[current] = (pool[current] ?? 0) + loaded
    start = 0
  }
  const taken = Math.min(capacity - start, pool[next] ?? 0)
  pool[next] = (pool[next] ?? 0) - taken
  for (const k of Object.keys(pool)) if (!pool[k]) delete pool[k]
  return {
    ...character,
    play: {
      ...play,
      ammo: { ...play.ammo, [weapon.id]: start + taken },
      ammoType: { ...play.ammoType, [weapon.id]: next },
      spareAmmo: { ...play.spareAmmo, [weapon.id]: pool },
    },
  }
}

/** Add spare rounds (bought or found); a negative number takes them away. */
export function addSpares(character: Character, weaponId: string, typeId: string, rounds: number): Character {
  const pool = { ...(character.play.spareAmmo[weaponId] ?? {}) }
  pool[typeId] = Math.max(0, (pool[typeId] ?? 0) + rounds)
  return { ...character, play: { ...character.play, spareAmmo: { ...character.play.spareAmmo, [weaponId]: pool } } }
}

/** Stop counting spare rounds for a weapon: reloads are free again. */
export function stopCounting(character: Character, weaponId: string): Character {
  const { [weaponId]: _, ...rest } = character.play.spareAmmo
  return { ...character, play: { ...character.play, spareAmmo: rest } }
}
