import { createCharacter, type Character } from '../model/character'
import { db } from './db'

export async function addCharacter(overrides: Partial<Character> = {}): Promise<Character> {
  const character = createCharacter(overrides)
  await db.characters.add(character)
  return character
}

/** Save with a fresh updatedAt, which is returned (undefined if the character was deleted). */
export async function saveCharacter(character: Character): Promise<string | undefined> {
  // An editor that was open while the character got deleted must not bring it back.
  if (await db.deletedCharacters.get(character.id)) return undefined
  const updatedAt = new Date().toISOString()
  await db.characters.put({ ...character, updatedAt })
  return updatedAt
}

/** Delete locally and remember it, so Drive sync removes it there too. */
export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction('rw', db.characters, db.deletedCharacters, async () => {
    await db.characters.delete(id)
    await db.deletedCharacters.put({ id, deletedAt: new Date().toISOString() })
  })
}

export async function duplicateCharacter(id: string): Promise<Character | undefined> {
  const original = await db.characters.get(id)
  if (!original) return undefined
  const now = new Date().toISOString()
  return addCharacter({
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: `${original.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  })
}

/**
 * Store imported characters. A character whose id is already in the library is
 * imported as a copy with a fresh id, so an import never overwrites existing work.
 */
export async function importCharacters(characters: Character[]): Promise<Character[]> {
  return db.transaction('rw', db.characters, db.deletedCharacters, async () => {
    const imported: Character[] = []
    for (const character of characters) {
      const exists = (await db.characters.get(character.id)) !== undefined
      const toStore = exists
        ? { ...character, id: crypto.randomUUID(), name: `${character.name} (imported)` }
        : character
      await db.characters.add(toStore)
      // Re-importing a character deleted earlier brings it back for sync as well.
      await db.deletedCharacters.delete(toStore.id)
      imported.push(toStore)
    }
    return imported
  })
}
