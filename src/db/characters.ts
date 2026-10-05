import { createCharacter, type Character } from '../model/character'
import { db } from './db'

export async function addCharacter(overrides: Partial<Character> = {}): Promise<Character> {
  const character = createCharacter(overrides)
  await db.characters.add(character)
  return character
}

export async function saveCharacter(character: Character): Promise<void> {
  await db.characters.put({ ...character, updatedAt: new Date().toISOString() })
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.characters.delete(id)
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
  return db.transaction('rw', db.characters, async () => {
    const imported: Character[] = []
    for (const character of characters) {
      const exists = (await db.characters.get(character.id)) !== undefined
      const toStore = exists
        ? { ...character, id: crypto.randomUUID(), name: `${character.name} (imported)` }
        : character
      await db.characters.add(toStore)
      imported.push(toStore)
    }
    return imported
  })
}
