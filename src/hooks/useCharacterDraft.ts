import { liveQuery } from 'dexie'
import { useCallback, useEffect, useRef, useState } from 'react'
import { saveCharacter } from '../db/characters'
import { db } from '../db/db'
import { CharacterSchema, migrateCharacter, type Character } from '../model/character'

const SAVE_DELAY_MS = 400

export type SaveState = 'saved' | 'pending' | 'error'

/**
 * Loads a character into local state and autosaves edits after a short pause.
 * Editing local state (instead of writing every keystroke to IndexedDB and
 * reading it back) keeps inputs responsive. If the stored character changes
 * from elsewhere (Drive sync, another tab) while nothing is being edited, the
 * newer version is loaded.
 */
export function useCharacterDraft(id: string) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const pending = useRef<Character | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** updatedAt of the version on screen, to recognise our own saves. */
  const known = useRef<string | null>(null)

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const toSave = pending.current
    if (!toSave) return
    pending.current = null
    try {
      const updatedAt = await saveCharacter(toSave)
      if (updatedAt) known.current = updatedAt
      if (!pending.current) setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [])

  useEffect(() => {
    known.current = null
    const subscription = liveQuery(() => db.characters.get(id)).subscribe({
      next: (raw) => {
        if (!raw) {
          if (!pending.current) setCharacter(null)
          return
        }
        // Ignore our own saves and anything arriving while the user has unsaved edits.
        if (raw.updatedAt === known.current || pending.current) return
        known.current = raw.updatedAt
        // Run stored data through the schema so older records pick up new defaults.
        setCharacter(CharacterSchema.parse(migrateCharacter(raw)))
      },
    })
    return () => {
      subscription.unsubscribe()
      void flush()
    }
  }, [id, flush])

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flush])

  const update = useCallback(
    (change: (draft: Character) => Character) => {
      setCharacter((current) => {
        if (!current) return current
        const next = change(current)
        pending.current = next
        return next
      })
      setSaveState('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush],
  )

  return { character, update, saveState, flush }
}
