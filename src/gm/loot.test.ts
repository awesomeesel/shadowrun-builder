import { describe, expect, it } from 'vitest'
import { ParticipantSchema } from '../model/encounter'
import type { NpcEntry } from '../rules/sr6/npc'
import { lootFrom, splitNuyen } from './loot'

describe('loot', () => {
  const npc = {
    name: 'Test Thug',
    weapons: 'Testco Zapper [Light Pistol, DV 2P, SA, 9/8/6/—/—] Pointy Stick [Blade, DV 3P, 7/—/—/—/—]',
    gear: 'Armor vest, commlink (Device Rating 2, D/F 1/1), 3 x fake SIN (rating 1) Starting Nuyen: 500¥',
  } as unknown as NpcEntry
  const thug = ParticipantSchema.parse({ id: 't1', kind: 'npc', name: 'Thug 1', npc, out: true })
  const spirit = ParticipantSchema.parse({ id: 's1', kind: 'spirit', name: 'Spirit' })

  it('lists weapons and gear from stat blocks, keeping brackets together', () => {
    expect(lootFrom([thug, spirit], () => false)).toEqual([
      {
        id: 't1',
        name: 'Thug 1',
        down: true,
        items: [
          'Testco Zapper',
          'Pointy Stick',
          'Armor vest',
          'commlink (Device Rating 2, D/F 1/1)',
          '3 x fake SIN (rating 1)',
        ],
      },
    ])
  })

  it('splits nuyen evenly', () => {
    expect(splitNuyen(1000, 3)).toEqual([334, 333, 333])
    expect(splitNuyen(500, 0)).toEqual([])
  })
})
