/**
 * Backs the GM's data up to a "GM" folder in Drive and keeps it in step
 * across devices: campaigns (code, password, notes, run log), encounters, and
 * runners imported from files. Live sheets from players aren't included; they
 * come back from the sharing server.
 *
 * Same idea as the character sync: one JSON file per item, tagged with its id
 * and updatedAt, and per item the updatedAt both sides last agreed on.
 */
import { db, type Campaign, type SharedSheet } from '../db/db'
import { CharacterSchema, migrateCharacter } from '../model/character'
import { EncounterSchema, type Encounter } from '../model/encounter'
import { isFileSheet } from '../share/campaigns'
import type { Drive, DriveFile } from './drive'

export interface GmSyncReport {
  uploaded: number
  downloaded: number
  deletedInDrive: number
  deletedHere: number
  conflicts: string[]
}

type Kind = 'campaign' | 'encounter' | 'runner'

interface Item {
  kind: Kind
  id: string
  name: string
  updatedAt: string
  data: unknown
}

const APP_TAG = 'shadowrun-builder'
const FORMAT = 'shadowrun-builder/gm-item'

/** Campaign fields worth backing up; the rest is this device's sharing bookkeeping. */
const CAMPAIGN_FIELDS = [
  'id',
  'role',
  'code',
  'password',
  'name',
  'notes',
  'joinHidden',
  'runs',
  'joinedAt',
  'gmSends',
  'cast',
  'jobs',
] as const

const campaignUpdatedAt = (c: Campaign) => c.updatedAt ?? c.joinedAt

async function localItems(): Promise<Item[]> {
  const campaigns = await db.campaigns.where('role').equals('gm').toArray()
  const encounters = (await db.encounters.toArray()).map((e) => EncounterSchema.parse(e))
  const runners = (await db.sharedSheets.toArray()).filter(isFileSheet)
  return [
    ...campaigns.map((c) => ({
      kind: 'campaign' as const,
      id: c.id,
      name: c.name,
      updatedAt: campaignUpdatedAt(c),
      data: Object.fromEntries(CAMPAIGN_FIELDS.map((k) => [k, c[k]])),
    })),
    ...encounters.map((e) => ({ kind: 'encounter' as const, id: e.id, name: e.name, updatedAt: e.updatedAt, data: e })),
    ...runners.map((s) => ({
      kind: 'runner' as const,
      id: s.id,
      name: s.character.name,
      updatedAt: s.updatedAt,
      data: s,
    })),
  ]
}

/** Store an item that came from Drive, keeping this device's own bookkeeping. */
async function store(kind: Kind, data: unknown, updatedAt: string) {
  if (kind === 'campaign') {
    const remote = data as Campaign
    const local = await db.campaigns.get(remote.id)
    await db.campaigns.put({
      ...local,
      ...remote,
      characterIds: local?.characterIds ?? [],
      pushed: local?.pushed ?? {},
      role: 'gm',
      updatedAt,
    })
  } else if (kind === 'encounter') {
    await db.encounters.put(EncounterSchema.parse(data))
  } else {
    const sheet = data as SharedSheet
    await db.sharedSheets.put({ ...sheet, character: CharacterSchema.parse(migrateCharacter(sheet.character)) })
  }
}

async function removeLocal(kind: Kind, id: string) {
  if (kind === 'campaign') await db.campaigns.delete(id)
  else if (kind === 'encounter') await db.encounters.delete(id)
  else await db.sharedSheets.delete(id)
}

const stateId = (kind: Kind, id: string) => `${kind}:${id}`

function fileName(item: Pick<Item, 'kind' | 'name'>) {
  const safe = item.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'Untitled'
  return `${item.kind} - ${safe}.json`
}

async function upload(drive: Drive, folderId: string, item: Item, existing?: DriveFile) {
  const content = new Blob([JSON.stringify({ format: FORMAT, kind: item.kind, item: item.data }, null, 2)], {
    type: 'application/json',
  })
  const props = { app: APP_TAG, kind: item.kind, itemId: item.id, updatedAt: item.updatedAt }
  const file = existing
    ? await drive.update(existing.id, fileName(item), props, content)
    : await drive.create(folderId, fileName(item), props, content)
  await db.syncState.put({ id: stateId(item.kind, item.id), driveFileId: file.id, syncedUpdatedAt: item.updatedAt })
}

async function read(drive: Drive, file: DriveFile): Promise<unknown> {
  const parsed = JSON.parse(await (await drive.download(file.id)).text())
  if (parsed?.format !== FORMAT) throw new Error(`${file.name} is not a GM data file`)
  return parsed.item
}

async function download(drive: Drive, file: DriveFile, kind: Kind) {
  const updatedAt = file.appProperties.updatedAt ?? ''
  await store(kind, await read(drive, file), updatedAt)
  await db.syncState.put({
    id: stateId(kind, file.appProperties.itemId),
    driveFileId: file.id,
    syncedUpdatedAt: updatedAt,
  })
}

/** Both sides changed. Encounters keep both versions; campaigns and runners take the newer one. */
async function resolveConflict(drive: Drive, folderId: string, local: Item, file: DriveFile, report: GmSyncReport) {
  report.conflicts.push(local.name)
  const remoteUpdatedAt = file.appProperties.updatedAt ?? ''
  const remote = await read(drive, file)
  if (local.kind === 'encounter') {
    const [newer, older] = local.updatedAt > remoteUpdatedAt ? [local.data, remote] : [remote, local.data]
    const copy: Encounter = {
      ...EncounterSchema.parse(older),
      id: crypto.randomUUID(),
      name: `${(older as Encounter).name} (other version)`,
    }
    await db.encounters.bulkPut([EncounterSchema.parse(newer), copy])
    const kept = EncounterSchema.parse(newer)
    await upload(drive, folderId, { ...local, data: kept, updatedAt: kept.updatedAt }, file)
    await upload(drive, folderId, {
      kind: 'encounter',
      id: copy.id,
      name: copy.name,
      updatedAt: copy.updatedAt,
      data: copy,
    })
    report.uploaded += 2
    return
  }
  if (local.kind === 'campaign') {
    // Run log entries, cast members and jobs from both sides are kept; everything else follows the newer side.
    const mine = local.data as Campaign
    const theirs = remote as Campaign
    const [newer, older] = local.updatedAt > remoteUpdatedAt ? [mine, theirs] : [theirs, mine]
    const runs = new Map((older.runs ?? []).map((r) => [r.id, r]))
    for (const r of newer.runs ?? []) runs.set(r.id, r)
    const cast = new Map((older.cast ?? []).map((m) => [m.id, m]))
    for (const m of newer.cast ?? []) {
      const other = cast.get(m.id)
      if (!other || m.updatedAt >= other.updatedAt) cast.set(m.id, m)
    }
    const jobs = new Map((older.jobs ?? []).map((j) => [j.id, j]))
    for (const j of newer.jobs ?? []) {
      const other = jobs.get(j.id)
      if (!other || j.updatedAt >= other.updatedAt) jobs.set(j.id, j)
    }
    const merged = {
      ...newer,
      runs: [...runs.values()].sort((a, b) => a.date.localeCompare(b.date)),
      cast: [...cast.values()],
      jobs: [...jobs.values()],
    }
    const updatedAt = new Date().toISOString()
    await store('campaign', merged, updatedAt)
    await upload(drive, folderId, { ...local, data: merged, updatedAt }, file)
    report.uploaded++
    return
  }
  if (local.updatedAt > remoteUpdatedAt) {
    await upload(drive, folderId, local, file)
    report.uploaded++
  } else {
    await download(drive, file, local.kind)
    report.downloaded++
  }
}

export async function syncGmData(drive: Drive, folderId: string): Promise<GmSyncReport> {
  const report: GmSyncReport = { uploaded: 0, downloaded: 0, deletedInDrive: 0, deletedHere: 0, conflicts: [] }

  // Newest file per item.
  const remote = new Map<string, DriveFile>()
  for (const file of await drive.list(folderId)) {
    const { kind, itemId } = file.appProperties
    if (!kind || !itemId) continue
    const key = stateId(kind as Kind, itemId)
    const current = remote.get(key)
    if (!current || (file.appProperties.updatedAt ?? '') > (current.appProperties.updatedAt ?? ''))
      remote.set(key, file)
  }
  const states = new Map((await db.syncState.toArray()).map((s) => [s.id, s]))

  // Deletions made on this device go to the Drive trash.
  for (const { id } of await db.deletedGmItems.toArray()) {
    const file = remote.get(id)
    if (file) {
      await drive.trash(file.id)
      report.deletedInDrive++
    }
    await db.syncState.delete(id)
    await db.deletedGmItems.delete(id)
    remote.delete(id)
  }

  for (const local of await localItems()) {
    const key = stateId(local.kind, local.id)
    const state = states.get(key)
    const file = remote.get(key)
    remote.delete(key)

    if (!file) {
      if (state && local.updatedAt === state.syncedUpdatedAt) {
        // Synced before, unchanged here, gone from Drive: deleted on another device.
        await removeLocal(local.kind, local.id)
        await db.syncState.delete(key)
        report.deletedHere++
      } else {
        await upload(drive, folderId, local)
        report.uploaded++
      }
      continue
    }

    const remoteUpdatedAt = file.appProperties.updatedAt ?? ''
    if (remoteUpdatedAt === local.updatedAt) {
      if (state?.syncedUpdatedAt !== local.updatedAt) {
        await db.syncState.put({ id: key, driveFileId: file.id, syncedUpdatedAt: local.updatedAt })
      }
      continue
    }
    const localChanged = !state || local.updatedAt !== state.syncedUpdatedAt
    const remoteChanged = !state || remoteUpdatedAt !== state.syncedUpdatedAt
    if (localChanged && !remoteChanged) {
      await upload(drive, folderId, local, file)
      report.uploaded++
    } else if (remoteChanged && !localChanged) {
      await download(drive, file, local.kind)
      report.downloaded++
    } else {
      await resolveConflict(drive, folderId, local, file, report)
    }
  }

  // New on another device. Campaigns first, so encounters and runners land in one that exists.
  const order: Kind[] = ['campaign', 'encounter', 'runner']
  for (const file of [...remote.values()].sort(
    (a, b) => order.indexOf(a.appProperties.kind as Kind) - order.indexOf(b.appProperties.kind as Kind),
  )) {
    const kind = file.appProperties.kind as Kind
    if (!order.includes(kind)) continue
    await download(drive, file, kind)
    report.downloaded++
  }
  return report
}
