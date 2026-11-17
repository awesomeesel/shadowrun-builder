import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Campaign } from '../db/db'
import { EncounterSchema } from '../model/encounter'
import { createCampaign, ensureGmAccess, moveCampaignHere, setTransport } from './campaigns'
import { publishJobs } from './jobBoard'
import { memoryServer } from './transport'

describe('GM on more than one device', () => {
  let server: ReturnType<typeof memoryServer>
  beforeEach(async () => {
    server = memoryServer()
    await Promise.all([db.campaigns.clear(), db.encounters.clear(), db.sharedSheets.clear(), db.deletedGmItems.clear()])
  })

  /** Switch to another device that has the same campaign (restored from the GM's Drive backup). */
  async function onDevice(uid: string, campaign: Campaign) {
    setTransport(server.client(uid))
    await db.campaigns.clear()
    await db.campaigns.put({ ...campaign, gmAccess: undefined })
  }

  it('lets the GM’s other device act as GM with the key from the backup', async () => {
    setTransport(server.client('laptop'))
    const campaign = await createCampaign('Seattle Nights', '')
    expect(campaign.gmSecret).toHaveLength(64)

    await onDevice('tablet', campaign)
    await expect(publishJobs(campaign)).rejects.toThrow(/permission/)
    expect(await ensureGmAccess(campaign.id)).toBe('ok')
    await publishJobs(campaign)
  })

  it('keeps players out: knowing the code and password isn’t enough', async () => {
    setTransport(server.client('laptop'))
    const campaign = await createCampaign('Seattle Nights', '')
    await onDevice('player', { ...campaign, gmSecret: undefined })
    expect(await ensureGmAccess(campaign.id)).toBe('no-key')
    await onDevice('player', { ...campaign, gmSecret: 'f'.repeat(64) })
    expect(await ensureGmAccess(campaign.id)).toBe('refused')
    await expect(publishJobs(campaign)).rejects.toThrow(/permission/)
  })

  it('gives an older campaign a key on the device that made it, for the other devices', async () => {
    setTransport(server.client('laptop'))
    const made = await createCampaign('Seattle Nights', '')
    // Stand in for a campaign made before GM keys: the same room on a server with no key, and no key here.
    const room = server.rooms.get(made.id)!
    server = memoryServer()
    server.rooms.set(made.id, room)
    const older = { ...made, gmSecret: undefined }
    await onDevice('laptop', older)
    expect(await ensureGmAccess(made.id)).toBe('ok')
    const withKey = (await db.campaigns.get(made.id))!
    expect(withKey.gmSecret).toHaveLength(64)

    await onDevice('tablet', withKey)
    expect(await ensureGmAccess(made.id)).toBe('ok')
  })

  it('moves a campaign to a new code, keeping its encounters and notes', async () => {
    setTransport(server.client('laptop'))
    const campaign = await createCampaign('Seattle Nights', 'pw')
    await db.campaigns.update(campaign.id, { notes: 'The Johnson lies.' })
    await db.encounters.put(EncounterSchema.parse({ id: 'e1', name: 'Docks', campaignId: campaign.id }))

    await onDevice('new-phone', { ...(await db.campaigns.get(campaign.id))!, gmSecret: undefined })
    await db.encounters.put(EncounterSchema.parse({ id: 'e1', name: 'Docks', campaignId: campaign.id }))
    const moved = await moveCampaignHere(campaign.id)
    expect(moved.id).not.toBe(campaign.id)
    expect(moved).toMatchObject({ name: 'Seattle Nights', password: 'pw', notes: 'The Johnson lies.', gmAccess: 'ok' })
    expect(await db.campaigns.get(campaign.id)).toBeUndefined()
    expect((await db.encounters.get('e1'))?.campaignId).toBe(moved.id)
    await publishJobs(moved)
  })
})
