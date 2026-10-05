/**
 * Two-way character sync between this browser and a Drive folder.
 *
 * Each character is one `.sr6char.json` file (the normal export format), tagged
 * with the character id and its updatedAt in Drive's appProperties. Per
 * character we remember which updatedAt both sides last agreed on, so we can
 * tell which side changed since.
 */
import { db } from '../db/db'
import { CharacterSchema, migrateCharacter, type Character } from '../model/character'
import { characterFileName, parseCharacterFile, serializeCharacter } from '../model/fileFormat'
import type { Drive, DriveFile } from './drive'

export interface SyncReport {
  uploaded: number
  downloaded: number
  deletedInDrive: number
  deletedHere: number
  /** Characters changed on both sides; the older version was kept as a copy. */
  conflicts: string[]
}

const APP_TAG = 'shadowrun-builder'

function toCharacter(raw: unknown): Character {
  return CharacterSchema.parse(migrateCharacter(raw))
}

async function upload(drive: Drive, folderId: string, character: Character, existing?: DriveFile) {
  const content = new Blob([serializeCharacter(character)], { type: 'application/json' })
  const props = { app: APP_TAG, characterId: character.id, updatedAt: character.updatedAt }
  const file = existing
    ? await drive.update(existing.id, characterFileName(character), props, content)
    : await drive.create(folderId, characterFileName(character), props, content)
  await db.syncState.put({ id: character.id, driveFileId: file.id, syncedUpdatedAt: character.updatedAt })
}

async function download(drive: Drive, file: DriveFile): Promise<Character> {
  const [character] = parseCharacterFile(await (await drive.download(file.id)).text())
  // The file's tag decides the id, so a renamed or hand-edited file still matches.
  const stored = { ...character, id: file.appProperties.characterId ?? character.id }
  await db.characters.put(stored)
  await db.syncState.put({ id: stored.id, driveFileId: file.id, syncedUpdatedAt: stored.updatedAt })
  return stored
}

/** Keep the losing side of a conflict as its own character, so nothing is lost. */
async function keepAsCopy(character: Character) {
  const copy = { ...character, id: crypto.randomUUID(), name: `${character.name} (other version)` }
  await db.characters.put(copy)
  return copy
}

export async function syncCharacters(drive: Drive, folderId: string): Promise<SyncReport> {
  const report: SyncReport = { uploaded: 0, downloaded: 0, deletedInDrive: 0, deletedHere: 0, conflicts: [] }

  // Newest file per character, in case two devices created the same one at once.
  const remote = new Map<string, DriveFile>()
  for (const file of await drive.list(folderId)) {
    const id = file.appProperties.characterId
    if (!id) continue
    const current = remote.get(id)
    if (!current || (file.appProperties.updatedAt ?? '') > (current.appProperties.updatedAt ?? '')) remote.set(id, file)
  }
  const states = new Map((await db.syncState.toArray()).map((s) => [s.id, s]))

  // Deletions made on this device.
  for (const { id } of await db.deletedCharacters.toArray()) {
    const file = remote.get(id)
    if (file) {
      await drive.trash(file.id)
      report.deletedInDrive++
    }
    await db.characters.delete(id)
    await db.syncState.delete(id)
    await db.deletedCharacters.delete(id)
    remote.delete(id)
  }

  for (const raw of await db.characters.toArray()) {
    const local = toCharacter(raw)
    const state = states.get(local.id)
    const file = remote.get(local.id)
    remote.delete(local.id)

    if (!file) {
      if (state && local.updatedAt === state.syncedUpdatedAt) {
        // Synced before, unchanged here, gone from Drive: it was deleted on another device.
        await db.characters.delete(local.id)
        await db.syncState.delete(local.id)
        report.deletedHere++
      } else {
        await upload(drive, folderId, local)
        report.uploaded++
      }
      continue
    }

    const remoteUpdatedAt = file.appProperties.updatedAt ?? ''
    if (remoteUpdatedAt === local.updatedAt) {
      if (!state || state.syncedUpdatedAt !== local.updatedAt) {
        await db.syncState.put({ id: local.id, driveFileId: file.id, syncedUpdatedAt: local.updatedAt })
      }
      continue
    }
    const localChanged = !state || local.updatedAt !== state.syncedUpdatedAt
    const remoteChanged = !state || remoteUpdatedAt !== state.syncedUpdatedAt

    if (localChanged && !remoteChanged) {
      await upload(drive, folderId, local, file)
      report.uploaded++
    } else if (remoteChanged && !localChanged) {
      await download(drive, file)
      report.downloaded++
    } else {
      // Changed on both sides: the newer version wins, the other is kept as a copy.
      report.conflicts.push(local.name)
      if (local.updatedAt > remoteUpdatedAt) {
        const theirs = toCharacter(parseCharacterFile(await (await drive.download(file.id)).text())[0])
        await upload(drive, folderId, local, file)
        await upload(drive, folderId, await keepAsCopy(theirs))
        report.uploaded += 2
      } else {
        await download(drive, file)
        await upload(drive, folderId, await keepAsCopy(local))
        report.downloaded++
        report.uploaded++
      }
    }
  }

  // New on another device.
  for (const file of remote.values()) {
    await download(drive, file)
    report.downloaded++
  }
  return report
}

export function describeReport(report: SyncReport): string {
  const parts = [
    report.uploaded && `${report.uploaded} saved to Drive`,
    report.downloaded && `${report.downloaded} updated from Drive`,
    report.deletedInDrive && `${report.deletedInDrive} moved to Drive trash`,
    report.deletedHere && `${report.deletedHere} removed (deleted on another device)`,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Everything up to date'
}
