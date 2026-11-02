import { beforeEach, describe, expect, it } from 'vitest'
import { addCharacter } from '../db/characters'
import { db, type Campaign } from '../db/db'
import { newJob } from '../gm/jobRules'
import { createCharacter } from '../model/character'
import { createCampaign, joinCampaign, lookupCampaign, setTransport } from './campaigns'
import { playerJobs, publishJobs, watchJobs } from './jobBoard'
import { memoryServer } from './transport'

async function until(check: () => Promise<boolean>, ms = 3000) {
  const end = Date.now() + ms
  while (!(await check())) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('jobs for players', () => {
  let server: ReturnType<typeof memoryServer>
  beforeEach(async () => {
    server = memoryServer()
    await Promise.all([db.characters.clear(), db.campaigns.clear(), db.jobBoards.clear()])
  })

  const campaignWithJobs = (base: Campaign): Campaign => ({
    ...base,
    cast: [{ id: 'mrj', name: 'Mr. Test', role: 'Johnson', attitude: 'neutral', notes: '', updatedAt: '' }],
    jobs: [
      {
        ...newJob(),
        id: 'heist',
        title: 'The skybar meet',
        status: 'legwork',
        johnsonId: 'mrj',
        nuyen: 5000,
        brief: 'Get the crate.',
        twists: 'The Johnson sells them out.',
        objectives: [{ id: 'o1', text: 'Meet him', done: true }],
      },
      { ...newJob(), id: 'secret', title: 'Not yet', hidden: true },
    ],
  })

  it('shows players the visible jobs without the twists', () => {
    const jobs = playerJobs(campaignWithJobs({ id: 'r', name: 'x' } as Campaign))
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ title: 'The skybar meet', johnson: 'Mr. Test', status: 'legwork', nuyen: 5000 })
    expect(JSON.stringify(jobs)).not.toContain('sells them out')
  })

  it('reaches the players who joined, and only the GM can publish', async () => {
    setTransport(server.client('gm'))
    const campaign = await createCampaign('Seattle Nights', '')
    await publishJobs(campaignWithJobs(campaign))

    setTransport(server.client('player'))
    await db.campaigns.clear()
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const runner = await addCharacter({ ...createCharacter(), name: 'Sly' })
    const joined = await joinCampaign(found, '', [runner.id])
    const stop = watchJobs(joined)
    await until(async () => (await db.jobBoards.count()) === 1)
    const board = await db.jobBoards.get(campaign.id)
    expect(board?.jobs.map((j) => j.title)).toEqual(['The skybar meet'])
    stop()
    await expect(publishJobs(joined)).rejects.toThrow(/permission/)
  })
})

describe('battle map for players', () => {
  it('publishes the shown map with tokens, and takes it down when hidden', async () => {
    const { EncounterSchema, ParticipantSchema } = await import('../model/encounter')
    const { newMap, placeToken } = await import('../map/battleMap')
    const { mapPayloads, publishMap, watchMap } = await import('./mapBoard')
    const server = memoryServer()
    await Promise.all([db.characters.clear(), db.campaigns.clear(), db.mapBoards.clear()])
    setTransport(server.client('gm'))
    const campaign = await createCampaign('Seattle Nights', '')
    const map = placeToken({ ...newMap(), shown: true }, 'p1', 2, 3)
    const encounter = EncounterSchema.parse({
      name: 'Dock ambush',
      campaignId: campaign.id,
      map,
      participants: [
        ParticipantSchema.parse({ id: 'p1', kind: 'runner', name: 'Sly', characterId: 'shared:room/u_sly' }),
      ],
    })
    const payloads = mapPayloads([encounter], [{ id: 'room/u_sly', character: { ...createCharacter(), id: 'sly' } }])
    const payload = payloads.get(campaign.id)!
    expect(payload.tokens).toMatchObject([{ name: 'Sly', side: 'runner', characterId: 'sly', x: 2.5, y: 3.5 }])
    await publishMap(campaign, payload)

    setTransport(server.client('player'))
    await db.campaigns.clear()
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const runner = await addCharacter({ ...createCharacter(), name: 'Sly' })
    const joined = await joinCampaign(found, '', [runner.id])
    const stop = watchMap(joined)
    await until(async () => (await db.mapBoards.count()) === 1)
    expect((await db.mapBoards.get(campaign.id))?.title).toBe('Dock ambush')

    setTransport(server.client('gm'))
    await publishMap(campaign, null)
    await until(async () => (await db.mapBoards.count()) === 0)
    stop()
  })
})

describe('sketch for players', () => {
  it('reaches joined players when shown, and goes away when hidden', async () => {
    const { publishSketch, watchSketch } = await import('./sketchBoard')
    const { SketchStrokeSchema } = await import('../map/sketch')
    const server = memoryServer()
    await Promise.all([db.characters.clear(), db.campaigns.clear(), db.sketchBoards.clear()])
    setTransport(server.client('gm'))
    const campaign = await createCampaign('Seattle Nights', '')
    const stroke = SketchStrokeSchema.parse({ kind: 'box', points: [100, 100, 400, 300] })
    await publishSketch(campaign, [stroke])

    setTransport(server.client('player'))
    await db.campaigns.clear()
    const found = await lookupCampaign(campaign.code, '')
    if (!found.ok) throw new Error('not found')
    const runner = await addCharacter({ ...createCharacter(), name: 'Sly' })
    const joined = await joinCampaign(found, '', [runner.id])
    const stop = watchSketch(joined)
    await until(async () => (await db.sketchBoards.count()) === 1)
    expect((await db.sketchBoards.get(campaign.id))?.strokes).toHaveLength(1)

    setTransport(server.client('gm'))
    await publishSketch(campaign, null)
    await until(async () => (await db.sketchBoards.count()) === 0)
    stop()
  })
})
