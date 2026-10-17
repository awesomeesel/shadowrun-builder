import { describe, expect, it } from 'vitest'
import { AugmentationSchema, SkillSchema, VehicleSchema, createCharacter } from '../../model/character'
import { controlRigRating, handlingPenalty, parseAutosofts, vehicleMonitor, vehiclePools } from './vehicles'

const drone = VehicleSchema.parse({
  name: 'Roto',
  kind: 'drone',
  body: 4,
  armor: 4,
  pilot: 3,
  sensor: 3,
  autosofts: 'HK-227 Targeting 3, Evasion 2',
})

const rigger = createCharacter({
  attributes: { ...createCharacter().attributes, reaction: 4, intuition: 5, logic: 4 },
  skills: [
    SkillSchema.parse({ skillId: 'piloting', rating: 5 }),
    SkillSchema.parse({ skillId: 'engineering', rating: 3 }),
  ],
  augmentations: [AugmentationSchema.parse({ name: 'Control rig', rating: 2 })],
})

describe('vehicles and drones', () => {
  it('has (Body / 2) + 8 boxes and loses Handling every 3 boxes (p. 201)', () => {
    expect(vehicleMonitor(drone)).toBe(10)
    expect(handlingPenalty(5)).toBe(1)
    expect(handlingPenalty(6)).toBe(2)
  })

  it('reads autosofts', () => {
    expect(parseAutosofts(drone.autosofts)).toEqual({ targeting: 3, evasion: 2 })
  })

  it('works out the rigger and drone pools', () => {
    expect(controlRigRating(rigger)).toBe(2)
    const pools = Object.fromEntries(vehiclePools(rigger, drone).map((p) => [p.label, p.pool]))
    expect(pools).toMatchObject({
      'Drive (jumped in)': 12, // Piloting 5 + Intuition 5 + rig 2
      'Shoot (jumped in)': 9, // Engineering 3 + Logic 4 + rig 2
      'Drive (remote/manual)': 9, // Piloting 5 + Reaction 4
      'Drone shoots': 6, // Targeting 3 + Sensor 3
      'Drone dodges': 5, // Pilot 3 + Evasion 2
    })
  })

  it('shoots with Sensor − 1 without a Targeting autosoft', () => {
    const plain = { ...drone, autosofts: '' }
    expect(vehiclePools(rigger, plain).find((p) => p.label === 'Drone shoots')?.pool).toBe(2)
  })
})
