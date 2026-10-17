/**
 * SR6 Matrix gear: programs, cyberjacks and switching devices on and off.
 * Program effects are short summaries in our own words; the page reference has the full rule.
 */

export type ProgramKind = 'basic' | 'hacking' | 'other'

export interface ProgramDef {
  name: string
  kind: Exclude<ProgramKind, 'other'>
  /** One-line summary of what it does while running. */
  effect: string
  page: number
}

export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
  basic: 'Basic',
  hacking: 'Hacking',
  other: 'Other',
}

/** Price per program by kind (Software table). */
export const PROGRAM_COST: Record<ProgramKind, number> = { basic: 60, hacking: 250, other: 0 }

export const PROGRAMS: ProgramDef[] = [
  { name: 'Baby Monitor', kind: 'basic', effect: 'Always know your Overwatch Score, no action needed.', page: 184 },
  {
    name: 'Browse',
    kind: 'basic',
    effect: 'Matrix searches: gain 1 Edge, use it on that action or lose it.',
    page: 184,
  },
  {
    name: 'Configurator',
    kind: 'basic',
    effect: 'Store a second attribute setup and swap to it instead of moving two attributes.',
    page: 184,
  },
  { name: 'Edit', kind: 'basic', effect: 'Edit File: gain 1 Edge, use it on that action or lose it.', page: 184 },
  { name: 'Encryption', kind: 'basic', effect: '+2 dice on Encrypt File.', page: 184 },
  { name: 'Signal Scrubber', kind: 'basic', effect: 'Noise −2.', page: 184 },
  { name: 'Toolbox', kind: 'basic', effect: 'Data Processing +1.', page: 184 },
  {
    name: 'Virtual Machine',
    kind: 'basic',
    effect: '+2 program slots, but Matrix attacks on you deal 1 extra unresisted box.',
    page: 184,
  },
  { name: 'Armor', kind: 'hacking', effect: 'Matrix Defense Rating +2.', page: 184 },
  {
    name: 'Biofeedback',
    kind: 'hacking',
    effect: 'Matrix attacks also hurt the user: Stun in cold-sim, Physical in hot-sim.',
    page: 184,
  },
  { name: 'Biofeedback Filter', kind: 'hacking', effect: 'Soak Matrix damage with Device Rating or Body.', page: 184 },
  { name: 'Blackout', kind: 'hacking', effect: 'Like Biofeedback, but Stun damage only.', page: 184 },
  { name: 'Decryption', kind: 'hacking', effect: '+2 dice on Crack File.', page: 184 },
  { name: 'Defuse', kind: 'hacking', effect: 'Soak Data Bomb damage with Device Rating or Body.', page: 184 },
  { name: 'Exploit', kind: 'hacking', effect: 'Hacking target’s Defense Rating −2.', page: 184 },
  {
    name: 'Fork',
    kind: 'hacking',
    effect: 'One Matrix action hits two targets without splitting the pool.',
    page: 184,
  },
  { name: 'Lockdown', kind: 'hacking', effect: 'Link-lock a target when you deal Matrix damage.', page: 184 },
  { name: 'Overclock', kind: 'hacking', effect: '+2 dice on a Matrix action; one of them is the wild die.', page: 184 },
  { name: 'Stealth', kind: 'hacking', effect: 'Hide: gain 1 Edge, use it on that action or lose it.', page: 185 },
  { name: 'Trace', kind: 'hacking', effect: 'Trace Icon: gain 1 Edge, use it on that action or lose it.', page: 185 },
]

const BY_NAME = new Map(PROGRAMS.map((p) => [p.name.toLowerCase(), p]))

export function findProgram(name: string): ProgramDef | undefined {
  return BY_NAME.get(name.trim().toLowerCase())
}

/** Extra program slots from a running Virtual Machine. */
export const VIRTUAL_MACHINE_SLOTS = 2
/** Data Processing bonus from a running Toolbox. */
export const TOOLBOX_DATA_PROCESSING = 1

/**
 * Cyberjack Data Processing/Firewall by rating: 4/3 at rating 1, +1 each per rating.
 * The Matrix bonus is printed as "+1"–"+3"; the two tables in the Core Rulebook
 * disagree (p. 177 and p. 284), so this uses the gear chapter's. VERIFY.
 */
export function cyberjackStats(rating: number): { dataProcessing: number; firewall: number; initiativeBonus: number } {
  const r = Math.min(6, Math.max(1, rating))
  return { dataProcessing: r + 3, firewall: r + 2, initiativeBonus: Math.ceil(r / 2) }
}

export const isCyberjackName = (name: string) => /cyberjack/i.test(name)

/** The rating of an implant from its rating field, or a number at the end of its name ("Cyberjack rating 6"). */
export function ratingFromName(name: string, rating: number): number {
  // A separate trailing number ("Cyberjack 4", "Cyberjack (rating 4)"), not part of a model name like "MCD-6".
  const named = name.trim().match(/(?:^|[\s(])(?:rating\s*)?(\d+)\)?$/i)
  return named ? parseInt(named[1], 10) : rating
}

interface DeviceLike {
  id: string
  kind: string
  active: boolean
}

/**
 * Turn a device on or off. Several devices can be active together (a deck and
 * a cyberjack), but only one of each type, so switching one on switches off
 * the others of its type.
 */
export function setDeviceActive<T extends DeviceLike>(devices: T[], id: string, active: boolean): T[] {
  const target = devices.find((d) => d.id === id)
  if (!target) return devices
  return devices.map((d) =>
    d.id === id ? { ...d, active } : active && d.kind === target.kind ? { ...d, active: false } : d,
  )
}

/** Add a device, making it active when nothing of its type is in use yet. */
export function addDevice<T extends DeviceLike>(devices: T[], device: T): T[] {
  const active = !devices.some((d) => d.active && d.kind === device.kind)
  return [...devices, { ...device, active }]
}
