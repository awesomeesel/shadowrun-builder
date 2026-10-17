import { useLiveQuery } from 'dexie-react-hooks'
import { Swords, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { noAutofillField } from '../components/noAutofill'
import { db } from '../db/db'
import type { Encounter } from '../model/encounter'
import { deleteEncounter, moveEncounter } from './store'

/** Encounter cards, newest first, with a way to move each one to another campaign. */
export function EncounterList({ encounters, empty }: { encounters: Encounter[]; empty: string }) {
  const campaigns = useLiveQuery(() => db.campaigns.where('role').equals('gm').toArray())
  if (encounters.length === 0) return <div className="card p-6 text-sm text-muted">{empty}</div>
  const sorted = [...encounters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {sorted.map((e) => (
        <li key={e.id} className="card flex flex-col p-4">
          <Link to={`/gm/${e.id}`} className="flex-1">
            <div className="flex items-center gap-2 font-display text-lg">
              <Swords className="size-4 text-accent" /> {e.name}
            </div>
            <div className="mt-1 text-xs text-muted">
              {e.participants.length} {e.participants.length === 1 ? 'combatant' : 'combatants'}
              {e.round > 0 && ` · round ${e.round}`}
            </div>
            <div className="mt-1 truncate text-xs text-muted">{e.participants.map((p) => p.name).join(', ')}</div>
          </Link>
          <div className="mt-3 flex items-center gap-3 text-xs">
            {campaigns && campaigns.length > 0 && (
              <select
                {...noAutofillField}
                className="input mr-auto max-w-44 py-1 text-xs"
                value={e.campaignId ?? ''}
                onChange={(event) => {
                  const campaignId = event.target.value || undefined
                  void moveEncounter(e.id, campaignId)
                }}
                aria-label="Campaign"
                title="Which campaign this encounter belongs to"
              >
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="ml-auto flex items-center gap-1 text-muted hover:text-danger"
              onClick={() => {
                if (confirm(`Delete "${e.name}"?`)) void deleteEncounter(e.id)
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
