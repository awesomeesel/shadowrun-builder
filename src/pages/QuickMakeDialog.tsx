import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Dices, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toCharacterItem } from '../books/toCharacter'
import { noAutofill } from '../components/noAutofill'
import { addCharacter } from '../db/characters'
import { db } from '../db/db'
import { finishBuild } from '../rules/sr6/build'
import { PRIORITY_TABLE } from '../rules/sr6/creation'
import { METATYPE_IDS, METATYPES, type MetatypeId } from '../rules/sr6/metatypes'
import { quickBuild, randomStreetName } from '../rules/sr6/quickBuild'
import { ROLES, ROLES_BY_ID } from '../rules/sr6/roles'
import { RolePicker } from './character/wizardGuide'

/** Pick a role, metatype and name; get a finished, rules-legal runner. */
export function QuickMakeDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const catalogSize = useLiveQuery(() => db.catalog.count()) ?? 0
  const [roleId, setRoleId] = useState(ROLES[0].id)
  const role = ROLES_BY_ID.get(roleId)!
  const [metatype, setMetatype] = useState<MetatypeId>(role.metatypes[0])
  const [name, setName] = useState(() => randomStreetName())
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const allowed = PRIORITY_TABLE[role.priorities.metatype].metatypes
  const metatypes = [...role.metatypes, ...METATYPE_IDS.filter((m) => !role.metatypes.includes(m))].filter((m) =>
    allowed.includes(m),
  )

  async function create() {
    setBusy(true)
    const [catalog, books] = await Promise.all([db.catalog.toArray(), db.books.toArray()])
    const bookById = new Map(books.map((b) => [b.id, b]))
    const { character } = quickBuild({
      role,
      metatype,
      name,
      catalog,
      toItem: (entry, options) => toCharacterItem(entry, bookById.get(entry.bookId), options),
    })
    const saved = await addCharacter(review ? character : finishBuild(character))
    navigate(`/character/${saved.id}/${review ? 'wizard?step=review' : ''}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden border-line bg-surface sm:max-h-[90vh] sm:rounded-xl sm:border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Quick make a character"
      >
        <div className="border-b border-line p-4">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <Zap className="size-5 text-amber" /> Quick make
          </h2>
          <p className="text-sm text-muted">
            Pick a role and get a finished, rules-legal runner in one click. You can change anything afterwards.
          </p>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4">
          <RolePicker
            value={roleId}
            allowOther={false}
            bare
            onChange={(id) => {
              setRoleId(id)
              setMetatype(ROLES_BY_ID.get(id)!.metatypes[0])
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Street name</span>
              <div className="flex gap-2">
                <input
                  {...noAutofill}
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="btn shrink-0" onClick={() => setName(randomStreetName())} title="Random name">
                  <Dices className="size-4" />
                </button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Metatype</span>
              <select
                className="input w-full"
                value={metatype}
                onChange={(e) => setMetatype(e.target.value as MetatypeId)}
              >
                {metatypes.map((m) => (
                  <option key={m} value={m}>
                    {METATYPES[m].name}
                    {role.metatypes.includes(m) ? ' (suits this role)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {catalogSize === 0 ? (
            <p className="flex gap-2 rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-amber" />
              <span>
                No rulebooks in your{' '}
                <Link to="/library" className="text-accent hover:underline">
                  Library
                </Link>{' '}
                yet. You'll get attributes, skills and contacts, but no qualities, spells or gear. Add your PDFs first
                for a complete runner.
              </span>
            </p>
          ) : (
            <p className="flex gap-2 text-sm text-muted">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" />
              Qualities, {role.magicType === 'mundane' ? '' : 'magic, '}gear and weapons are picked from your books,
              with page links.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={review}
              onChange={(e) => setReview(e.target.checked)}
            />
            Let me review it in the wizard before finishing
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary px-4" onClick={create} disabled={busy}>
            <Zap className="size-4" /> {busy ? 'Building…' : `Make ${name.trim() || 'runner'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
