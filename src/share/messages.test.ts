import { beforeEach, describe, expect, it } from 'vitest'
import { addCharacter } from '../db/characters'
import { db, type Campaign } from '../db/db'
import { createCharacter, type Character } from '../model/character'
import { computeDerived } from '../rules/sr6/derived'
import { createCampaign, joinCampaign, lookupCampaign, setTransport, watchCampaign } from './campaigns'
import {
  applyMessage,
  cancelMessage,
  describeMessage,
  dismissMessage,
  keepHandout,
  sendToRunner,
  watchInbox,
  watchOutbox,
} from './messages'
import { memoryServer } from './transport'

async function until(check: () => Promise<boolean>, ms = 3000) {
  const end = Date.now() + ms
  while (!(await check())) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('applying GM messages', () => {
  const runner = () => createCharacter()

  it('applies damage straight to the boxes, spilling Stun into Physical', () => {
    const c = runner()
    const stun = computeDerived(c).stunMonitor.boxes
    const hurt = applyMessage(c, { kind: 'damage', value: stun + 2, type: 'S', resist: false, note: '' })
    expect(hurt.damage).toMatchObject({ stun, physical: 2 })
  })

  it('replaces an older copy of the same status', () => {
    let c = applyMessage(runner(), { kind: 'status', name: 'Burning', value: 2, rounds: null, note: '' })
    c = applyMessage(c, { kind: 'status', name: 'Burning', value: 4, rounds: null, note: '' })
    c = applyMessage(c, { kind: 'status', name: 'Cover', value: 2, rounds: 3, note: '' })
    expect(c.play.statuses.map((s) => [s.name, s.value, s.rounds])).toEqual([
      ['Burning', 4, null],
      ['Cover', 2, 3],
    ])
  })

  it('gives Edge up to 7, and karma and nuyen through the ledger', () => {
    const base = runner()
    let c: Character = { ...base, play: { ...base.play, edge: 6 } }
    c = applyMessage(c, { kind: 'edge', amount: 3, note: '' })
    expect(c.play.edge).toBe(7)
    c = applyMessage(c, { kind: 'reward', karma: 5, nuyen: 4000, note: 'Renraku heist' })
    expect(c.karma).toMatchObject({ available: 5, career: 5 })
    expect(c.nuyen).toBe(createCharacter().nuyen + 4000)
    expect(c.ledger.at(-1)?.note).toBe('From the GM: Renraku heist')
  })

  it('describes messages for the player', () => {
    expect(describeMessage({ kind: 'damage', value: 6, type: 'P', resist: true, note: '' })).toBe('Resist 6P')
    expect(describeMessage({ kind: 'status', name: 'Burning', value: 3, rounds: 2, note: '' })).toBe(
      'Burning 3 for 2 rounds',
    )
    expect(describeMessage({ kind: 'reward', karma: 5, nuyen: 0, note: '' })).toBe('5 karma')
  })
})

describe('sending to players', () => {
  let server: ReturnType<typeof memoryServer>
  beforeEach(async () => {
    server = memoryServer()
    await Promise.all([
      db.characters.clear(),
      db.campaigns.clear(),
      db.sharedSheets.clear(),
      db.inbox.clear(),
      db.outbox.clear(),
      db.handouts.clear(),
    ])
  })

  async function asDevice(uid: string, campaigns: Campaign[]) {
    setTransport(server.client(uid))
    await db.campaigns.clear()
    await db.campaigns.bulkPut(campaigns)
  }

  async function setup() {
    await asDevice('gm', [])
    const campaign = await createCampaign('Seattle Nights', '')
    const gmDevice = await db.campaigns.toArray()
    await asDevice('player', [])
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const runner = await addCharacter({ ...createCharacter(), name: 'Sly' })
    await joinCampaign(found, '', [runner.id])
    const playerDevice = await db.campaigns.toArray()
    await asDevice('gm', gmDevice)
    const stop = watchCampaign(campaign)
    await until(async () => (await db.sharedSheets.count()) === 1)
    stop()
    const sheet = (await db.sharedSheets.toArray())[0]
    return { campaign, gmDevice, playerDevice, runner, sheet }
  }

  it('delivers a message to the player, who handles it once', async () => {
    const { campaign, gmDevice, playerDevice, runner, sheet } = await setup()
    await sendToRunner(campaign, sheet, { kind: 'reward', karma: 5, nuyen: 0, note: '' })
    const stopOutbox = watchOutbox(campaign)
    await until(async () => (await db.outbox.count()) === 1)
    stopOutbox()

    await asDevice('player', playerDevice)
    const stop = watchInbox(playerDevice[0], runner.id)
    await until(async () => (await db.inbox.count()) === 1)
    const [item] = await db.inbox.toArray()
    expect(item).toMatchObject({ campaignName: 'Seattle Nights', message: { kind: 'reward', karma: 5 } })
    await dismissMessage(item)
    await until(async () => (await db.inbox.count()) === 0)
    expect(server.messages.get(campaign.id)?.size).toBe(0)
    stop()

    await asDevice('gm', gmDevice)
    expect(server.rooms.has(campaign.id)).toBe(true)
  })

  it('lets the GM take a message back', async () => {
    const { campaign, sheet } = await setup()
    await sendToRunner(campaign, sheet, { kind: 'edge', amount: 1, note: '' })
    const stop = watchOutbox(campaign)
    await until(async () => (await db.outbox.count()) === 1)
    await cancelMessage((await db.outbox.toArray())[0])
    expect(server.messages.get(campaign.id)?.size).toBe(0)
    stop()
  })

  it('respects the switches, and only the GM can send', async () => {
    const { campaign, playerDevice, sheet } = await setup()
    const off = { ...campaign, gmSends: { damage: false, rewards: true } }
    await expect(
      sendToRunner(off, sheet, { kind: 'damage', value: 4, type: 'P', resist: true, note: '' }),
    ).rejects.toThrow(/switched off/)
    await sendToRunner(off, sheet, { kind: 'reward', karma: 1, nuyen: 0, note: '' })

    await asDevice('player', playerDevice)
    await expect(sendToRunner(playerDevice[0], sheet, { kind: 'edge', amount: 1, note: '' })).rejects.toThrow(/refused/)
  })

  it('delivers a handout the player keeps, even with sending switched off', async () => {
    const { campaign, playerDevice, runner, sheet } = await setup()
    const off = { ...campaign, gmSends: { damage: false, rewards: false } }
    const image = 'data:image/jpeg;base64,' + 'A'.repeat(1000)
    await sendToRunner(off, sheet, { kind: 'handout', title: 'Floor plan', text: 'Skybar, 7th floor', image, note: '' })

    await asDevice('player', playerDevice)
    const stop = watchInbox(playerDevice[0], runner.id)
    await until(async () => (await db.inbox.count()) === 1)
    const [item] = await db.inbox.toArray()
    expect(applyMessage(runner, item.message)).toBe(runner)
    await keepHandout(item)
    await until(async () => (await db.inbox.count()) === 0)
    expect(await db.handouts.toArray()).toMatchObject([
      { characterId: runner.id, title: 'Floor plan', text: 'Skybar, 7th floor', image, campaignName: 'Seattle Nights' },
    ])
    stop()
  })
})
