/**
 * Statuses (Core Rulebook pp. 51–53), summarised in our own words. Damage from
 * statuses comes at the end of each combat round and is resisted with Body.
 */
export interface StatusDef {
  name: string
  /** 'level' for I/II/III, 'number' for statuses with a value (Burning 3). */
  value?: 'level' | 'number'
  effect: string
  /** Change to the Initiative Score while the status lasts. */
  initiative?: number
  /** Damage to resist at the end of each round, from the status's number. */
  roundDamage?: 'P' | 'S' | 'P or S'
  page: number
}

export const STATUSES: StatusDef[] = [
  { name: 'Blinded', value: 'level', effect: '−3 dice per level on sight tests; level III fails them.', page: 51 },
  {
    name: 'Burning',
    value: 'number',
    effect: 'Resist that much Physical each round. Major Action + Agility + Reaction (2) or water puts it out.',
    roundDamage: 'P',
    page: 51,
  },
  {
    name: 'Chilled',
    effect: 'Initiative −4 and −1 die on everything except damage resistance.',
    initiative: -4,
    page: 51,
  },
  { name: 'Confused', value: 'number', effect: 'That number as a dice penalty on all actions.', page: 51 },
  {
    name: 'Corrosive',
    value: 'number',
    effect: 'Resist that much Physical each round until removed.',
    roundDamage: 'P',
    page: 52,
  },
  {
    name: 'Cover',
    value: 'level',
    effect: '+1 Defense Rating and defense dice per level. Shooting out costs a Minor Action.',
    page: 52,
  },
  { name: 'Dazed', effect: 'Initiative −4; can’t gain or spend Edge (can burn it).', initiative: -4, page: 52 },
  { name: 'Deafened', value: 'level', effect: '−3 dice per level on hearing tests; level III fails them.', page: 52 },
  { name: 'Fatigued', value: 'level', effect: '−2 dice per level (not damage resistance); slower movement.', page: 52 },
  { name: 'Frightened', effect: '−4 dice on tests against or defending from the source.', page: 52 },
  { name: 'Hazed', effect: 'Can’t move between astral and physical; can still perceive.', page: 52 },
  { name: 'Hobbled', effect: 'Movement on foot is halved.', page: 52 },
  {
    name: 'Immobilized',
    effect: 'Can’t move; Attack Rating −3 and −3 dice on attacks; no Reaction on defense.',
    page: 52,
  },
  { name: 'Invisible', value: 'number', effect: 'Perception threshold to notice (cameras see them).', page: 52 },
  {
    name: 'Nauseated',
    effect: 'Body + Willpower (2) each round or no actions; on a success, one Minor Action fewer.',
    page: 52,
  },
  { name: 'Panicked', effect: 'Can only act to get away from the cause.', page: 52 },
  { name: 'Petrified', effect: 'No actions; +10 armor; ends damaging statuses.', page: 53 },
  {
    name: 'Poisoned',
    value: 'number',
    effect: 'Resist the damage at the end of each round; it drops by 1 each round.',
    roundDamage: 'P or S',
    page: 53,
  },
  {
    name: 'Prone',
    effect: '+2 defense vs Medium range or farther, −2 vs Close/Near; −4 on melee; firearm AR +2.',
    page: 53,
  },
  { name: 'Silent', value: 'number', effect: 'Perception threshold to hear (microphones hear).', page: 53 },
  { name: 'Stilled', effect: 'Can’t act or defend; Defense Rating −10; ongoing effects pause.', page: 53 },
  { name: 'Wet', effect: '−6 to resist cold and electricity; cancels Burning.', page: 53 },
  { name: 'Zapped', effect: 'Initiative −2, no Sprint, −1 die on all actions.', initiative: -2, page: 53 },
]

export const STATUS_BY_NAME = new Map(STATUSES.map((s) => [s.name.toLowerCase(), s]))

/** Total Initiative Score change from a combatant's statuses. */
export function statusInitiative(statuses: { name: string }[]): number {
  return statuses.reduce((sum, s) => sum + (STATUS_BY_NAME.get(s.name.toLowerCase())?.initiative ?? 0), 0)
}

const ROMAN = ['', 'I', 'II', 'III', 'IV']

/** "Burning 3", "Cover II", "Dazed". */
export function statusLabel(status: { name: string; value: number }): string {
  const def = STATUS_BY_NAME.get(status.name.toLowerCase())
  if (!status.value) return status.name
  return `${status.name} ${def?.value === 'level' ? (ROMAN[status.value] ?? status.value) : status.value}`
}
