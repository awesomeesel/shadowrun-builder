import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { noAutofill, noAutofillField } from '../../../components/noAutofill'
import { PlayStatusSchema, type Character } from '../../../model/character'
import { STATUSES, STATUS_BY_NAME, statusLabel } from '../../../rules/sr6/statuses'
import type { Update } from '../CharacterPage'

/** Statuses on the runner (Burning, Cover, Dazed…), from the GM or added here. */
export function StatusList({ character, update }: { character: Character; update: Update }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(STATUSES[0].name)
  const [value, setValue] = useState(1)
  const statuses = character.play.statuses
  const def = STATUS_BY_NAME.get(name.toLowerCase())
  const remove = (id: string) =>
    update((c) => ({ ...c, play: { ...c.play, statuses: c.play.statuses.filter((s) => s.id !== id) } }))
  const add = () => {
    const status = PlayStatusSchema.parse({ name, value: def?.value ? value : 0 })
    update((c) => ({
      ...c,
      play: { ...c.play, statuses: [...c.play.statuses.filter((s) => s.name !== name), status] },
    }))
    setAdding(false)
  }
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs text-muted">Statuses</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {statuses.map((s) => {
          const info = STATUS_BY_NAME.get(s.name.toLowerCase())
          return (
            <span
              key={s.id}
              className="chip gap-1 border-amber/50 text-amber"
              title={info ? `${info.effect} (CRB ${info.page})` : undefined}
            >
              {statusLabel(s)}
              {s.rounds !== null && <span className="text-muted">· {s.rounds} rd</span>}
              <button className="hover:text-fg" onClick={() => remove(s.id)} aria-label={`Remove ${statusLabel(s)}`}>
                <X className="size-3" />
              </button>
            </span>
          )
        })}
        {adding ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <select
              {...noAutofillField}
              className="input py-1 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
            {def?.value && (
              <input
                {...noAutofill}
                type="number"
                min={1}
                className="input w-14 py-1 text-xs"
                value={value}
                onChange={(e) => setValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                aria-label="Level or number"
              />
            )}
            <button className="btn btn-primary px-2 py-1 text-xs" onClick={add}>
              Add
            </button>
            <button className="text-muted hover:text-fg" onClick={() => setAdding(false)} aria-label="Cancel">
              <X className="size-4" />
            </button>
          </span>
        ) : (
          <button className="chip cursor-pointer text-muted hover:text-fg" onClick={() => setAdding(true)}>
            <Plus className="size-3" /> Status
          </button>
        )}
      </div>
      {statuses.length > 0 && (
        <ul className="mt-1.5 grid gap-0.5 text-xs text-muted">
          {statuses.map((s) => (
            <li key={s.id}>
              <span className="text-fg">{statusLabel(s)}</span>: {STATUS_BY_NAME.get(s.name.toLowerCase())?.effect}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
