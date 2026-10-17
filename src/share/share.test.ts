import { beforeEach, describe, expect, it } from 'vitest'
import { addCharacter, saveCharacter } from '../db/characters'
import { db, type Campaign } from '../db/db'
import { createCharacter } from '../model/character'
import {
  closeCampaign,
  createCampaign,
  importSharedFile,
  joinCampaign,
  latestSheets,
  lookupCampaign,
  removeSharedSheet,
  setShared,
  setTransport,
  syncCampaign,
  watchCampaign,
} from './campaigns'
import { deriveSession, generateCode, normalizeCode, seal, unseal } from './crypto'
import { memoryServer } from './transport'

/** Wait until the check passes (watching and unsealing are asynchronous). */
async function until(check: () => Promise<boolean>, ms = 3000) {
  const end = Date.now() + ms
  while (!(await check())) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('codes and sealing', () => {
  it('makes readable codes and normalizes typing', () => {
    const code = generateCode()
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(normalizeCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code)
    expect(normalizeCode('ABC')).toBeNull()
    expect(normalizeCode('AAAA-BBBB-CCC0')).toBeNull()
  })

  it('derives the same room for the same code and password, another for another password', async () => {
    const a = await deriveSession('AAAA-BBBB-CCCC', 'pw')
    const b = await deriveSession('AAAA-BBBB-CCCC', 'pw')
    const c = await deriveSession('AAAA-BBBB-CCCC', '')
    expect(a.roomId).toBe(b.roomId)
    expect(a.roomId).not.toBe(c.roomId)
    expect(a.roomId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('seals and unseals, and refuses the wrong key', async () => {
    const { key } = await deriveSession('AAAA-BBBB-CCCC', 'pw')
    const { key: other } = await deriveSession('AAAA-BBBB-CCCC', 'nope')
    const sealed = await seal(key, { hello: 'chummer', n: [1, 2, 3] })
    expect(sealed).not.toContain('chummer')
    expect(await unseal(key, sealed)).toEqual({ hello: 'chummer', n: [1, 2, 3] })
    await expect(unseal(other, sealed)).rejects.toThrow()
  })
})

describe('sharing with the GM', () => {
  let server: ReturnType<typeof memoryServer>
  beforeEach(async () => {
    server = memoryServer()
    await Promise.all([db.characters.clear(), db.campaigns.clear(), db.sharedSheets.clear()])
  })

  /** Switch "device": another user id, and only that device's campaign list. */
  async function asDevice(uid: string, campaigns: Campaign[]) {
    setTransport(server.client(uid))
    await db.campaigns.clear()
    await db.campaigns.bulkPut(campaigns)
  }

  it('lets a player join with code and password, and the GM sees live updates', async () => {
    await asDevice('gm', [])
    const campaign = await createCampaign('Seattle Nights', 'hoi')
    const gmDevice = await db.campaigns.toArray()

    await asDevice('player', [])
    expect(await lookupCampaign(campaign.code, 'wrong')).toEqual({ ok: false, reason: 'not-found' })
    const found = await lookupCampaign(campaign.code.toLowerCase(), 'hoi')
    expect(found).toMatchObject({ ok: true, name: 'Seattle Nights' })
    if (!found.ok) return
    const runner = await addCharacter({ ...createCharacter(), name: 'Sly' })
    await joinCampaign(found, 'hoi', [runner.id])
    const stored = [...server.sheets.get(campaign.id)!.values()]
    expect(stored).toHaveLength(1)
    expect(stored[0].data).not.toContain('Sly')
    const playerDevice = await db.campaigns.toArray()

    // The GM watches; the player takes damage.
    await asDevice('gm', gmDevice)
    const stop = watchCampaign(campaign)
    await until(async () => (await db.sharedSheets.count()) === 1)
    expect(latestSheets(await db.sharedSheets.toArray()).map((s) => s.character.name)).toEqual(['Sly'])

    setTransport(server.client('player'))
    await db.campaigns.bulkPut(playerDevice)
    await saveCharacter({ ...runner, damage: { physical: 3, stun: 1, overflow: 0 } })
    await syncCampaign(campaign.id)
    await until(async () => (await db.sharedSheets.toArray())[0]?.character.damage.physical === 3)
    const [sheet] = await db.sharedSheets.toArray()
    expect(sheet.character.damage).toMatchObject({ physical: 3, stun: 1 })
    stop()
  })

  it('only sends changed characters, and removes unshared ones', async () => {
    await asDevice('gm', [])
    const campaign = await createCampaign('Test', '')
    await asDevice('player', [])
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const a = await addCharacter({ ...createCharacter(), name: 'A' })
    const b = await addCharacter({ ...createCharacter(), name: 'B' })
    await joinCampaign(found, '', [a.id, b.id])
    const before = server.sheets.get(campaign.id)!.get(`player_${a.id}`)
    await syncCampaign(campaign.id)
    expect(server.sheets.get(campaign.id)!.get(`player_${a.id}`)).toBe(before)
    await setShared(campaign.id, b.id, false)
    expect([...server.sheets.get(campaign.id)!.keys()]).toEqual([`player_${a.id}`])
  })

  it("doesn't let another player overwrite a sheet, and lets the GM remove it", async () => {
    await asDevice('gm', [])
    const campaign = await createCampaign('Test', '')
    const gmDevice = await db.campaigns.toArray()
    await asDevice('player', [])
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const a = await addCharacter({ ...createCharacter(), name: 'A' })
    await joinCampaign(found, '', [a.id])
    const intruder = server.client('intruder')
    await expect(
      intruder.putSheet(campaign.id, `player_${a.id}`, { owner: 'intruder', data: 'x', updatedAt: '' }),
    ).rejects.toThrow()

    await asDevice('gm', gmDevice)
    const stop = watchCampaign(campaign)
    await until(async () => (await db.sharedSheets.count()) === 1)
    const [sheet] = await db.sharedSheets.toArray()
    await removeSharedSheet(sheet)
    expect(server.sheets.get(campaign.id)!.size).toBe(0)
    stop()
  })

  it('tells players when the GM closes the campaign', async () => {
    await asDevice('gm', [])
    const campaign = await createCampaign('Test', '')
    const gmDevice = await db.campaigns.toArray()
    await asDevice('player', [])
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const a = await addCharacter({ ...createCharacter(), name: 'A' })
    await joinCampaign(found, '', [a.id])
    const playerDevice = await db.campaigns.toArray()

    await asDevice('gm', gmDevice)
    await closeCampaign(campaign.id)
    expect(server.rooms.size).toBe(0)

    await asDevice('player', playerDevice)
    await saveCharacter({ ...a, name: 'A2' })
    await syncCampaign(campaign.id)
    expect((await db.campaigns.get(campaign.id))?.closed).toBe(true)
  })

  it('keeps runners imported from files when live sheets arrive', async () => {
    await asDevice('gm', [])
    const campaign = await createCampaign('Test', '')
    await importSharedFile(campaign.id, { ...createCharacter(), name: 'From file' })
    const stop = watchCampaign(campaign)
    await until(async () => !!(await db.campaigns.get(campaign.id))?.lastSyncAt)
    expect((await db.sharedSheets.toArray()).map((s) => s.character.name)).toEqual(['From file'])
    stop()
  })
})
