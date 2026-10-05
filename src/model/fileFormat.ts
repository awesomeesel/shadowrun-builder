import { z } from 'zod'
import { CharacterSchema, migrateCharacter, type Character } from './character'

export const CHARACTER_FILE_FORMAT = 'shadowrun-builder/character'
export const BUNDLE_FILE_FORMAT = 'shadowrun-builder/bundle'
export const CHARACTER_FILE_EXTENSION = '.sr6char.json'

interface CharacterFile {
  format: typeof CHARACTER_FILE_FORMAT
  exportedAt: string
  character: Character
}

interface BundleFile {
  format: typeof BUNDLE_FILE_FORMAT
  exportedAt: string
  characters: Character[]
}

export function serializeCharacter(character: Character): string {
  const file: CharacterFile = {
    format: CHARACTER_FILE_FORMAT,
    exportedAt: new Date().toISOString(),
    character,
  }
  return JSON.stringify(file, null, 2)
}

export function serializeBundle(characters: Character[]): string {
  const file: BundleFile = {
    format: BUNDLE_FILE_FORMAT,
    exportedAt: new Date().toISOString(),
    characters,
  }
  return JSON.stringify(file, null, 2)
}

export class ImportError extends Error {}

const EnvelopeSchema = z.object({ format: z.string() }).loose()

/**
 * Parse an exported file (single character or bundle) into validated characters.
 * Throws `ImportError` with a readable message when the file can't be used.
 */
export function parseCharacterFile(json: string): Character[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new ImportError('The file is not valid JSON.')
  }

  const envelope = EnvelopeSchema.safeParse(data)
  if (!envelope.success) {
    throw new ImportError('This does not look like a Shadowrun Builder file.')
  }

  const raw = envelope.data
  let rawCharacters: unknown[]
  if (raw.format === CHARACTER_FILE_FORMAT) {
    rawCharacters = [raw.character]
  } else if (raw.format === BUNDLE_FILE_FORMAT && Array.isArray(raw.characters)) {
    rawCharacters = raw.characters
  } else {
    throw new ImportError(`Unsupported file format "${raw.format}".`)
  }

  return rawCharacters.map((rawCharacter, index) => {
    const result = CharacterSchema.safeParse(migrateCharacter(rawCharacter))
    if (!result.success) {
      const label = rawCharacters.length > 1 ? `Character #${index + 1}` : 'The character'
      throw new ImportError(`${label} is invalid:\n${z.prettifyError(result.error)}`)
    }
    return result.data
  })
}

export function characterFileName(character: Character): string {
  const slug = character.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return (slug || 'character') + CHARACTER_FILE_EXTENSION
}
