import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addCharacter, deleteCharacter, saveCharacter } from '../db/characters'
import { db } from '../db/db'
import { createCharacter, type Character } from '../model/character'
import { serializeCharacter } from '../model/fileFormat'
import { MemoryDrive } from './memoryDrive'
import { syncCharacters } from './sync'

let drive: MemoryDrive
let folder: string

beforeEach(async () => {
  await Promise.all([db.characters.clear(), db.syncState.clear(), db.deletedCharacters.clear()])
  drive = new MemoryDrive()
  folder = await drive.folder('Characters')
})

/** Simulate another device writing a character file to Drive. */
async function remoteWrite(character: Character, fileId?: string) {
  const content = new Blob([serializeCharacter(character)])
  const props = { app: 'shadowrun-builder', characterId: character.id, updatedAt: character.updatedAt }
  if (fileId) return drive.update(fileId, 'x.sr6char.json', props, content)
  return drive.create(folder, 'x.sr6char.json', props, content)
}

const names = async () => (await db.characters.toArray()).map((c) => c.name).sort()
const remoteNames = async () =>
  Promise.all(
    (await drive.list(folder)).map(async (f) => JSON.parse(await (await drive.download(f.id)).text()).character.name),
  ).then((n) => n.sort())

const later = (iso: string, ms = 1000) => new Date(Date.parse(iso) + ms).toISOString()

describe('syncCharacters', () => {
  it('uploads new local characters and does nothing on the next run', async () => {
    await addCharacter({ name: 'Sly' })
    expect(await syncCharacters(drive, folder)).toMatchObject({ uploaded: 1, downloaded: 0 })
    expect(await remoteNames()).toEqual(['Sly'])
    expect(await syncCharacters(drive, folder)).toMatchObject({ uploaded: 0, downloaded: 0, conflicts: [] })
  })

  it('downloads characters created on another device', async () => {
    await remoteWrite(createCharacter({ name: 'Remote Rita' }))
    expect(await syncCharacters(drive, folder)).toMatchObject({ downloaded: 1 })
    expect(await names()).toEqual(['Remote Rita'])
  })

  it('uploads local edits', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await syncCharacters(drive, folder)
    await db.characters.put({ ...c, nuyen: 500, updatedAt: later(c.updatedAt) })
    expect(await syncCharacters(drive, folder)).toMatchObject({ uploaded: 1 })
    const [file] = await drive.list(folder)
    expect(JSON.parse(await (await drive.download(file.id)).text()).character.nuyen).toBe(500)
  })

  it('downloads edits made on another device', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await syncCharacters(drive, folder)
    const [file] = await drive.list(folder)
    await remoteWrite({ ...c, nuyen: 900, updatedAt: later(c.updatedAt) }, file.id)
    expect(await syncCharacters(drive, folder)).toMatchObject({ downloaded: 1, uploaded: 0 })
    expect((await db.characters.get(c.id))?.nuyen).toBe(900)
  })

  it('keeps both versions when a character changed on both sides', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await syncCharacters(drive, folder)
    const [file] = await drive.list(folder)
    await remoteWrite({ ...c, nuyen: 900, updatedAt: later(c.updatedAt, 5000) }, file.id)
    await db.characters.put({ ...c, nuyen: 100, updatedAt: later(c.updatedAt, 1000) })

    const report = await syncCharacters(drive, folder)
    expect(report.conflicts).toEqual(['Sly'])
    // The newer (remote) version wins; the local one is kept as a copy on both sides.
    expect((await db.characters.get(c.id))?.nuyen).toBe(900)
    expect(await names()).toEqual(['Sly', 'Sly (other version)'])
    expect(await remoteNames()).toEqual(['Sly', 'Sly (other version)'])
  })

  it('moves characters deleted here to the Drive trash', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await syncCharacters(drive, folder)
    await deleteCharacter(c.id)
    expect(await syncCharacters(drive, folder)).toMatchObject({ deletedInDrive: 1 })
    expect(await drive.list(folder)).toEqual([])
    expect(await db.deletedCharacters.count()).toBe(0)
  })

  it('removes characters deleted on another device', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await syncCharacters(drive, folder)
    await drive.trash((await drive.list(folder))[0].id)
    expect(await syncCharacters(drive, folder)).toMatchObject({ deletedHere: 1 })
    expect(await db.characters.get(c.id)).toBeUndefined()
  })

  it('keeps a character deleted elsewhere if it was edited here since', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await syncCharacters(drive, folder)
    await drive.trash((await drive.list(folder))[0].id)
    await db.characters.put({ ...c, nuyen: 5, updatedAt: later(c.updatedAt) })
    expect(await syncCharacters(drive, folder)).toMatchObject({ uploaded: 1, deletedHere: 0 })
    expect(await remoteNames()).toEqual(['Sly'])
  })

  it('does not let an open editor bring back a deleted character', async () => {
    const c = await addCharacter({ name: 'Sly' })
    await deleteCharacter(c.id)
    await saveCharacter(c)
    expect(await db.characters.get(c.id)).toBeUndefined()
  })
})
