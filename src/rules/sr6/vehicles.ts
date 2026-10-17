/**
 * Vehicles and drones at the table (Core Rulebook pp. 196–201): damage,
 * handling, and the dice pools for driving, shooting and dodging.
 */
import type { Character, Vehicle } from '../../model/character'
import type { Initiative } from './derived'
import { computeDerived, effectiveAttributes } from './derived'
import { ratingFromName } from './matrix'

/** Autosofts a drone can run, and the drone attribute each one rolls with (p. 201). */
export const AUTOSOFTS = {
  clearsight: { name: 'Clearsight', attribute: 'sensor', use: 'Perception' },
  electronicWarfare: { name: 'Electronic Warfare', attribute: 'sensor', use: 'Jamming and ECM' },
  evasion: { name: 'Evasion', attribute: 'pilot', use: 'Dodging attacks' },
  maneuvering: { name: 'Maneuvering', attribute: 'pilot', use: 'Driving or flying' },
  stealth: { name: 'Stealth', attribute: 'pilot', use: 'Sneaking' },
  targeting: { name: 'Targeting', attribute: 'sensor', use: 'Firing its weapon' },
} as const

export type AutosoftId = keyof typeof AUTOSOFTS

/** Read "Targeting 3, Evasion 2" into ratings per autosoft. */
export function parseAutosofts(text: string): Partial<Record<AutosoftId, number>> {
  const result: Partial<Record<AutosoftId, number>> = {}
  for (const part of text.split(/[,;]/)) {
    const match = part.trim().match(/^(.*?)\s*(\d+)$/)
    if (!match) continue
    const name = match[1].toLowerCase()
    const id = (Object.keys(AUTOSOFTS) as AutosoftId[]).find((k) =>
      name.includes(AUTOSOFTS[k].name.toLowerCase().split(' ')[0]),
    )
    if (id) result[id] = parseInt(match[2], 10)
  }
  return result
}

/** One condition monitor of (Body / 2) + 8 boxes (p. 201). */
export function vehicleMonitor(vehicle: Vehicle): number {
  return Math.ceil(vehicle.body / 2) + 8
}

/** Handling gets 1 worse for every 3 boxes of damage (p. 201). */
export function handlingPenalty(damage: number): number {
  return Math.floor(Math.max(0, damage) / 3)
}

/** Extra dice for jumped-in tests: the control rig's rating (p. 197). */
export function controlRigRating(character: Character): number {
  const rig = character.augmentations.find((a) => /control rig/i.test(a.name))
  return rig ? Math.max(1, ratingFromName(rig.name, rig.rating)) : 0
}

export interface VehiclePool {
  label: string
  pool: number
  /** How the pool is made up, e.g. "Piloting + Intuition + rig 2". */
  formula: string
}

/** The rolls that matter for one vehicle or drone, for the rigger and for the drone on its own. */
export function vehiclePools(character: Character, vehicle: Vehicle): VehiclePool[] {
  const a = effectiveAttributes(character)
  const skill = (id: string) => character.skills.find((s) => s.skillId === id)?.rating ?? 0
  const rig = controlRigRating(character)
  const rigText = rig ? ` + rig ${rig}` : ''
  const piloting = skill('piloting')
  const engineering = skill('engineering')
  const pools: VehiclePool[] = []

  if (rig) {
    // Jumped in, the rigger uses mental attributes and adds the control rig's rating (p. 197).
    pools.push({
      label: 'Drive (jumped in)',
      pool: piloting + a.intuition + rig,
      formula: `Piloting + Intuition${rigText}`,
    })
    pools.push({
      label: 'Shoot (jumped in)',
      pool: engineering + a.logic + rig,
      formula: `Engineering + Logic${rigText}`,
    })
  }
  pools.push({ label: 'Drive (remote/manual)', pool: piloting + a.reaction, formula: 'Piloting + Reaction' })

  if (vehicle.kind === 'drone') {
    const soft = parseAutosofts(vehicle.autosofts)
    const pilot = vehicle.pilot
    const sensor = vehicle.sensor
    pools.push({
      label: 'Drone drives',
      pool: pilot + (soft.maneuvering ?? 0),
      formula: `Pilot + Maneuvering ${soft.maneuvering ?? 0}`,
    })
    pools.push(
      soft.targeting !== undefined
        ? { label: 'Drone shoots', pool: soft.targeting + sensor, formula: `Targeting ${soft.targeting} + Sensor` }
        : // Without the Targeting autosoft the drone fires with Sensor − 1 (p. 201).
          { label: 'Drone shoots', pool: Math.max(0, sensor - 1), formula: 'Sensor − 1 (no Targeting autosoft)' },
    )
    pools.push({
      label: 'Drone dodges',
      pool: pilot + (soft.evasion ?? 0),
      formula: `Pilot + Evasion ${soft.evasion ?? 0}`,
    })
    if (soft.clearsight !== undefined) {
      pools.push({
        label: 'Drone perceives',
        pool: sensor + soft.clearsight,
        formula: `Clearsight ${soft.clearsight} + Sensor`,
      })
    }
    if (soft.stealth !== undefined) {
      pools.push({ label: 'Drone sneaks', pool: pilot + soft.stealth, formula: `Stealth ${soft.stealth} + Pilot` })
    }
  }
  return pools
}

/** A drone acting on its own: Pilot × 2 + 4D6. Jumped in, it uses the rigger's hot-sim VR initiative (p. 201). */
export function droneInitiative(character: Character, vehicle: Vehicle): { own: Initiative; jumped: Initiative } {
  const derived = computeDerived(character)
  const a = derived.attributes
  const dataProcessing = derived.matrix?.dataProcessing ?? 0
  return {
    own: { score: vehicle.pilot * 2, dice: 4 },
    jumped: { score: a.intuition + dataProcessing, dice: 3 },
  }
}

/** Attack and Defense Rating of a vehicle in combat: driver's Piloting + Sensor / + Armor (p. 196). */
export function vehicleRatings(character: Character, vehicle: Vehicle): { attack: number; defense: number } {
  const piloting = character.skills.find((s) => s.skillId === 'piloting')?.rating ?? 0
  return { attack: piloting + vehicle.sensor, defense: piloting + vehicle.armor }
}
