import { describe, expect, it } from 'vitest'
import { addDevice, cyberjackStats, ratingFromName, setDeviceActive } from './matrix'

const device = (id: string, kind: string, active = false) => ({ id, kind, active })

describe('setDeviceActive', () => {
  it('lets a deck and a cyberjack be in use together', () => {
    const devices = [device('deck', 'cyberdeck', true), device('jack', 'cyberjack')]
    expect(setDeviceActive(devices, 'jack', true).map((d) => d.active)).toEqual([true, true])
  })

  it('switches off another device of the same type', () => {
    const devices = [device('a', 'commlink', true), device('b', 'commlink')]
    expect(setDeviceActive(devices, 'b', true).map((d) => d.active)).toEqual([false, true])
  })
})

describe('addDevice', () => {
  it('uses a new device unless one of its type is already in use', () => {
    let devices = addDevice([], device('deck', 'cyberdeck'))
    devices = addDevice(devices, device('jack', 'cyberjack'))
    devices = addDevice(devices, device('spare', 'cyberdeck'))
    expect(devices.map((d) => d.active)).toEqual([true, true, false])
  })
})

describe('cyberjacks', () => {
  it('has Data Processing and Firewall by rating', () => {
    expect(cyberjackStats(1)).toMatchObject({ dataProcessing: 4, firewall: 3 })
    expect(cyberjackStats(6)).toMatchObject({ dataProcessing: 9, firewall: 8 })
  })

  it.each([
    ['Cyberjacks rating 6', 1, 6],
    ['Cyberjack (rating 4)', 1, 4],
    ['Cyberjack', 3, 3],
    ['Erika MCD-6', 1, 1],
  ])('reads the rating of %j', (name, rating, expected) => {
    expect(ratingFromName(name, rating)).toBe(expected)
  })
})
