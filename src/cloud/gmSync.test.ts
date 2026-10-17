import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Campaign, type CampaignRun } from '../db/db'
import { deleteEncounter, updateCampaign } from '../gm/store'
import { createCharacter } from '../model/character'
import { newEncounter } from '../rules/sr6/encounter'
import { importSharedFile } from '../share/campaigns'
import { syncGmData } from './gmSync'
import { MemoryDrive } from './memoryDrive'

let drive: MemoryDrive
let folder: string

const campaign = (): Campaign => ({
  id: 'room1',
  role: 'gm',
  code: 'AAAA-BBBB-CCCC',
  password: 'pw',
  name: 'Seattle Nights',
  characterIds: [],
  pushed: {},
  joinedAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  notes: 'Mr. Johnson lies',
})

const run = (id: string, title: string): CampaignRun => ({
  id,
  date: '2026-10-18',
  title,
  notes: '',
  karma: 5,
  nuyen: 4000,
  runnerIds: [],
  runnerNames: [],
})

/** Lose everything on this device (new browser, cleared data), keeping Drive. */
async function wipeDevice() {
  await Promise.all([
    db.campaigns.clear(),
    db.encounters.clear(),
    db.sharedSheets.clear(),
    db.syncState.clear(),
    db.deletedGmItems.clear(),
  ])
}

beforeEach(async () => {
  await wipeDevice()
  drive = new MemoryDrive()
  folder = await drive.folder('GM')
})

const later = () => new Promise((r) => setTimeout(r, 5))

describe('GM data backup', () => {
  it('restores campaigns, encounters and imported runners on a new device', async () => {
    await db.campaigns.put(campaign())
    await db.encounters.put({ ...newEncounter('Docks ambush'), campaignId: 'room1' })
    await importSharedFile('room1', { ...createCharacter(), name: 'Sly' })
    // Live sheets from players aren't backed up; they come back from the sharing server.
    await db.sharedSheets.put({
      id: 'room1/uid_x',
      roomId: 'room1',
      sheetId: 'uid_x',
      character: createCharacter(),
      updatedAt: '',
      receivedAt: '',
    })
    expect((await syncGmData(drive, folder)).uploaded).toBe(3)

    await wipeDevice()
    const report = await syncGmData(drive, folder)
    expect(report.downloaded).toBe(3)
    const restored = await db.campaigns.get('room1')
    expect(restored).toMatchObject({ code: 'AAAA-BBBB-CCCC', password: 'pw', notes: 'Mr. Johnson lies', role: 'gm' })
    expect((await db.encounters.toArray()).map((e) => [e.name, e.campaignId])).toEqual([['Docks ambush', 'room1']])
    expect((await db.sharedSheets.toArray()).map((s) => s.character.name)).toEqual(['Sly'])
  })

  it('sends changes and deletions, and ignores sharing bookkeeping', async () => {
    await db.campaigns.put(campaign())
    const encounter = newEncounter('Docks ambush')
    await db.encounters.put(encounter)
    await syncGmData(drive, folder)

    // Sharing bookkeeping alone doesn't count as a change.
    await db.campaigns.update('room1', { lastSyncAt: new Date().toISOString(), error: 'offline' })
    expect((await syncGmData(drive, folder)).uploaded).toBe(0)

    await later()
    await updateCampaign('room1', { notes: 'Mr. Johnson lies. Twice.' })
    expect((await syncGmData(drive, folder)).uploaded).toBe(1)

    await deleteEncounter(encounter.id)
    expect((await syncGmData(drive, folder)).deletedInDrive).toBe(1)
    await wipeDevice()
    await syncGmData(drive, folder)
    expect(await db.encounters.count()).toBe(0)
    expect((await db.campaigns.get('room1'))?.notes).toBe('Mr. Johnson lies. Twice.')
  })

  it('removes items deleted on another device', async () => {
    const encounter = newEncounter('Docks ambush')
    await db.encounters.put(encounter)
    await syncGmData(drive, folder)
    const [file] = await drive.list(folder)
    await drive.trash(file.id)
    expect((await syncGmData(drive, folder)).deletedHere).toBe(1)
    expect(await db.encounters.count()).toBe(0)
  })

  it('keeps both versions of an encounter and merges run logs when edited on two devices', async () => {
    const encounter = newEncounter('Docks ambush')
    await db.campaigns.put({ ...campaign(), runs: [run('r1', 'First run')] })
    await db.encounters.put(encounter)
    await syncGmData(drive, folder)

    // Another device changes both and syncs.
    const files = await drive.list(folder)
    const other = { ...campaign(), runs: [run('r1', 'First run'), run('r2', 'Logged on the tablet')] }
    const otherAt = '2026-10-02T10:00:00.000Z'
    const write = (kind: string, id: string, item: unknown, file: (typeof files)[number]) =>
      drive.update(
        file.id,
        file.name,
        { app: 'shadowrun-builder', kind, itemId: id, updatedAt: otherAt },
        new Blob([JSON.stringify({ format: 'shadowrun-builder/gm-item', kind, item })]),
      )
    await write(
      'campaign',
      'room1',
      other,
      files.find((f) => f.appProperties.kind === 'campaign')!,
    )
    await write(
      'encounter',
      encounter.id,
      { ...encounter, name: 'Docks ambush', round: 3, updatedAt: otherAt },
      files.find((f) => f.appProperties.kind === 'encounter')!,
    )

    // Meanwhile, this device changed them too.
    await later()
    await updateCampaign('room1', { runs: [run('r1', 'First run'), run('r3', 'Logged on the laptop')] })
    await db.encounters.put({ ...encounter, round: 5, updatedAt: new Date().toISOString() })

    const report = await syncGmData(drive, folder)
    expect(report.conflicts.sort()).toEqual(['Docks ambush', 'Seattle Nights'])
    expect((await db.campaigns.get('room1'))?.runs?.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3'])
    const rounds = (await db.encounters.toArray())
      .map((e) => [e.name, e.round])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    expect(rounds).toEqual([
      ['Docks ambush', 5],
      ['Docks ambush (other version)', 3],
    ])
  })
})
