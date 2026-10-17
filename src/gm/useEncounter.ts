import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'
import { db } from '../db/db'
import { EncounterSchema, type Encounter } from '../model/encounter'

/** Load an encounter and change it; every change is saved right away. */
export function useEncounter(id: string) {
  const encounter = useLiveQuery(async () => {
    const raw = await db.encounters.get(id)
    return raw ? EncounterSchema.parse(raw) : null
  }, [id])

  const update = useCallback(
    async (change: (e: Encounter) => Encounter) => {
      // Read the stored copy so quick clicks build on each other instead of on a stale render.
      const raw = await db.encounters.get(id)
      if (!raw) return
      const next = change(EncounterSchema.parse(raw))
      await db.encounters.put({ ...next, updatedAt: new Date().toISOString() })
    },
    [id],
  )

  return { encounter, update }
}
