import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpen, Plus, Swords, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { db } from '../db/db'
import { EncounterSchema } from '../model/encounter'
import { newEncounter } from '../rules/sr6/encounter'

/** The GM's start page: encounters to prepare or run, and the rules reference. */
export function GmHome() {
  const navigate = useNavigate()
  const encounters = useLiveQuery(async () =>
    (await db.encounters.orderBy('updatedAt').reverse().toArray()).map((e) => EncounterSchema.parse(e)),
  )

  const create = async () => {
    const encounter = newEncounter(`Encounter ${(encounters?.length ?? 0) + 1}`)
    await db.encounters.add(encounter)
    navigate(`/gm/${encounter.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/" className="text-muted hover:text-fg" aria-label="Back to characters">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="mr-auto font-display text-3xl font-semibold">GM screen</h1>
        <Link to="/rules" className="btn">
          <BookOpen className="size-4" /> Rules
        </Link>
        <button className="btn btn-primary" onClick={create}>
          <Plus className="size-4" /> New encounter
        </button>
      </div>
      <p className="mb-5 max-w-2xl text-sm text-muted">
        Set up fights ahead of time: add grunts, critters and spirits from your books, and the runners. At the table,
        roll initiative, step through turns, track damage, Edge, actions and statuses, and roll for the opposition.
      </p>
      {encounters?.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">
          No encounters yet.{' '}
          <button className="text-accent hover:underline" onClick={create}>
            Make the first one
          </button>
          .
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {encounters?.map((e) => (
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
            <button
              className="mt-3 flex items-center gap-1 self-end text-xs text-muted hover:text-danger"
              onClick={() => {
                if (confirm(`Delete "${e.name}"?`)) void db.encounters.delete(e.id)
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
