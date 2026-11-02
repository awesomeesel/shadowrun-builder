import { useLiveQuery } from 'dexie-react-hooks'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { asMain, copiesOf, differences, isConflictCopy, originalOf } from '../../cloud/conflicts'
import { deleteCharacter, saveCharacter } from '../../db/characters'
import { db } from '../../db/db'
import { CharacterSchema, migrateCharacter, type Character } from '../../model/character'

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Sorting out the "(other version)" copies Drive sync keeps when a character
 * was changed on two devices. On a copy: how it differs, and keep it instead
 * or delete it. On the main character: a pointer to its copy.
 */
export function ConflictCopy({ character, flush }: { character: Character; flush: () => Promise<void> }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const all = useLiveQuery(async () =>
    (await db.characters.toArray()).map((raw) => CharacterSchema.parse(migrateCharacter(raw))),
  )
  if (!all) return null
  const self = all.find((c) => c.id === character.id)
  if (!self) return null

  if (isConflictCopy(self)) {
    const main = originalOf(self, all)
    const diff = main ? differences(self, main) : []
    const remove = async () => {
      if (!confirm(`Delete “${self.name}”? ${main ? `${main.name} stays as it is.` : ''}`)) return
      setBusy(true)
      await deleteCharacter(self.id)
      navigate(main ? `/character/${main.id}` : '/')
    }
    const keepThis = async () => {
      if (!main) return
      if (
        !confirm(
          `Use this version as ${main.name}? The current ${main.name} is replaced by it, and this copy goes away.`,
        )
      )
        return
      setBusy(true)
      await flush()
      const latest = await db.characters.get(self.id)
      await saveCharacter(asMain(CharacterSchema.parse(migrateCharacter(latest ?? self)), main))
      await deleteCharacter(self.id)
      navigate(`/character/${main.id}`)
    }
    return (
      <section className="mb-5 rounded-xl border border-amber/60 bg-amber/10 p-4 text-sm print:hidden">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg">
          <Copy className="size-5 text-amber" /> An older version, kept to be safe
        </h2>
        <p className="mb-2">
          {main ? (
            <>
              <b>{main.name}</b> was changed on two devices before they could sync, so the newer version stayed as{' '}
              {main.name} and this one was kept as a copy. This copy was saved {when(self.updatedAt)}; {main.name}{' '}
              {when(main.updatedAt)}.
            </>
          ) : (
            <>
              This was kept when a character was changed on two devices before they could sync. The character it belongs
              to isn’t here any more.
            </>
          )}
        </p>
        {main &&
          (diff.length ? (
            <ul className="mb-3 list-inside list-disc text-xs text-muted">
              {diff.slice(0, 10).map((d) => (
                <li key={d}>{d}</li>
              ))}
              {diff.length > 10 && <li>…and {diff.length - 10} more</li>}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-muted">
              No differences in money, karma, damage, attributes, skills or gear.
            </p>
          ))}
        <div className="flex flex-wrap gap-2">
          {main && (
            <Link to={`/character/${main.id}`} className="btn px-3 py-1 text-xs">
              Open {main.name}
            </Link>
          )}
          <button className="btn btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => void remove()}>
            Delete this copy
          </button>
          {main && (
            <button className="btn px-3 py-1 text-xs" disabled={busy} onClick={() => void keepThis()}>
              Keep this one instead
            </button>
          )}
        </div>
      </section>
    )
  }

  const copies = copiesOf(self, all)
  if (copies.length === 0) return null
  return (
    <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg/60 px-3 py-2 text-xs print:hidden">
      <Copy className="size-4 text-amber" />
      <span className="mr-auto">There’s an older version of {self.name}, kept when it was changed on two devices.</span>
      {copies.map((c) => (
        <Link key={c.id} to={`/character/${c.id}`} className="btn px-2 py-0.5 text-xs">
          Look at it ({when(c.updatedAt)})
        </Link>
      ))}
    </p>
  )
}
