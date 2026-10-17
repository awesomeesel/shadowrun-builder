/**
 * What's new, newest first. Add an entry (with the next id) when shipping
 * something players will notice; the app shows new entries once after an update.
 */
export interface ChangelogEntry {
  id: number
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 4,
    date: '2026-10-17',
    title: 'Karma shop, healing and more',
    items: [
      'New Karma tab: spend karma on attributes, skills, specializations, knowledge, qualities and spells at the book’s prices, with undo.',
      'Heal step by step: first aid, medkit, healing magic and rest, from the Play tab or when a session ends.',
      'Banish spirits and decompile sprites.',
      'Quick make gives drones autosofts and fills a decker’s deck after upgrading it.',
      'The app tells you when a new version is out, and shows what changed.',
    ],
  },
  {
    id: 3,
    date: '2026-10-17',
    title: 'Spells, spirits, sprites and drones in play',
    items: [
      'Cast spells with Amp Up and bigger areas, resist drain, and keep track of sustained spells (−2 dice each).',
      'Summon spirits and compile sprites, with services or tasks, stats, skill rolls and damage.',
      'Vehicles and drones get damage tracks and rolls for driving, shooting and dodging; drones use autosofts.',
    ],
  },
  {
    id: 2,
    date: '2026-10-17',
    title: 'A much better Play tab',
    items: [
      'Ready-for-a-run checklist before each session.',
      'Spend Edge after a roll: reroll a die, +1 to a die, buy a hit, reroll failures.',
      'Combat tracker with rounds and actions; attacks by range and firing mode use the right ammo.',
      'Take damage step by step with soak, drain and overflow.',
      'Rules checked against the Core Rulebook: trolls and orks get their racial qualities, used implants are cheaper, and more.',
    ],
  },
  {
    id: 1,
    date: '2026-10-17',
    title: 'Decker hardware and programs',
    items: [
      'A cyberdeck and a cyberjack work together; programs run in the deck’s slots.',
      'Bone lacing, dermal plating and similar bonuses: Defense Rating, damage resistance and unarmed attacks.',
    ],
  },
]

export const LATEST_CHANGE = CHANGELOG[0].id

/** Event that opens the What's new list. */
export const SHOW_WHATS_NEW = 'show-whats-new'

/** Open the What's new list, e.g. from a link on the start page. */
export function showWhatsNew() {
  window.dispatchEvent(new Event(SHOW_WHATS_NEW))
}
