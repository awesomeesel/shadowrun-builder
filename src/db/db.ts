import Dexie, { type EntityTable } from 'dexie'
import type { Character } from '../model/character'

export const db = new Dexie('shadowrun-builder') as Dexie & {
  characters: EntityTable<Character, 'id'>
}

db.version(1).stores({
  characters: 'id, name, updatedAt',
})
