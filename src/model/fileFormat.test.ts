import { beforeEach, describe, expect, it } from 'vitest'
import { addCharacter, importCharacters } from '../db/characters'
import { db } from '../db/db'
import { createCharacter } from './character'
import {
  BUNDLE_FILE_FORMAT,
  CHARACTER_FILE_FORMAT,
  ImportError,
  characterFileName,
  parseCharacterFile,
  serializeBundle,
  serializeCharacter,
} from './fileFormat'

describe('character files', () => {
  it('round-trips a single character', () => {
    const character = createCharacter({
      name: 'Sly',
      metatype: 'elf',
      attributes: { ...createCharacter().attributes, agility: 7, charisma: 6 },
      skills: [{ id: 's1', skillId: 'firearms', rating: 5, specialization: 'Pistols', expertise: '' }],
      nuyen: 4500,
    })
    expect(parseCharacterFile(serializeCharacter(character))).toEqual([character])
  })

  it('round-trips a bundle', () => {
    const characters = [createCharacter({ name: 'A' }), createCharacter({ name: 'B' })]
    expect(parseCharacterFile(serializeBundle(characters))).toEqual(characters)
  })

  it('fills in defaults for sparse files', () => {
    const json = JSON.stringify({ format: CHARACTER_FILE_FORMAT, character: { name: 'Minimal' } })
    const [character] = parseCharacterFile(json)
    expect(character.name).toBe('Minimal')
    expect(character.metatype).toBe('human')
    expect(character.attributes.body).toBe(1)
    expect(character.attributes.magic).toBe(0)
    expect(character.skills).toEqual([])
    expect(character.id).toBeTruthy()
  })

  it('rejects files that are not JSON', () => {
    expect(() => parseCharacterFile('not json')).toThrow(ImportError)
  })

  it('rejects unknown formats', () => {
    expect(() => parseCharacterFile(JSON.stringify({ format: 'chummer' }))).toThrow(/Unsupported file format/)
  })

  it('reports which character in a bundle is invalid', () => {
    const json = JSON.stringify({
      format: BUNDLE_FILE_FORMAT,
      characters: [{ name: 'Fine' }, { name: 'Broken', metatype: 'dragon' }],
    })
    expect(() => parseCharacterFile(json)).toThrow(/Character #2/)
  })

  it('makes safe file names', () => {
    expect(characterFileName(createCharacter({ name: 'Mr. Johnson!' }))).toBe('mr-johnson.sr6char.json')
    expect(characterFileName(createCharacter({ name: '???' }))).toBe('character.sr6char.json')
  })
})

describe('importCharacters', () => {
  beforeEach(() => db.characters.clear())

  it('imports a character with a duplicate id as a copy', async () => {
    const existing = await addCharacter({ name: 'Sly' })
    const [imported] = await importCharacters([{ ...existing, nuyen: 100 }])

    expect(imported.id).not.toBe(existing.id)
    expect(imported.name).toBe('Sly (imported)')
    expect((await db.characters.get(existing.id))?.nuyen).toBe(0)
    expect(await db.characters.count()).toBe(2)
  })

  it('keeps the id of a character that is not in the library', async () => {
    const character = createCharacter({ name: 'New' })
    const [imported] = await importCharacters([character])
    expect(imported.id).toBe(character.id)
  })
})
