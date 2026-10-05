import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { EntryKind } from '../books/extract'
import { entrySummary, ratingRange, toCharacterItem, type TargetList } from '../books/toCharacter'
import { pdfPageToPrinted } from '../books/pages'
import { db, type Book, type CatalogEntry } from '../db/db'
import type { Character } from '../model/character'
import { AUGMENTATION_GRADES, type GradeId } from '../rules/sr6/special'

const KIND_LABELS: Record<EntryKind, string> = {
  quality: 'Qualities',
  weapon: 'Weapons',
  armor: 'Armor',
  gear: 'Gear',
  augmentation: 'Augmentations',
  spell: 'Spells',
  adeptPower: 'Adept powers',
  complexForm: 'Complex forms',
  matrixDevice: 'Matrix devices',
  vehicle: 'Vehicles & drones',
}

const MAX_RESULTS = 150

export type AddItem = <L extends TargetList>(list: L, item: Character[L][number]) => void

/** Button that opens the catalog picker for the given kinds of items. */
export function AddFromBooks({ kinds, onAdd, label }: { kinds: EntryKind[]; onAdd: AddItem; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-primary w-full" onClick={() => setOpen(true)}>
        {label ?? '+ Add from books'}
      </button>
      {open && <CatalogPicker kinds={kinds} onAdd={onAdd} onClose={() => setOpen(false)} />}
    </>
  )
}

export function CatalogPicker({
  kinds,
  onAdd,
  onClose,
}: {
  kinds: EntryKind[]
  onAdd: AddItem
  onClose: () => void
}) {
  const entries = useLiveQuery(() => db.catalog.where('kind').anyOf(kinds).toArray(), [kinds.join()])
  const books = useLiveQuery(() => db.books.toArray())
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<EntryKind | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return (entries ?? [])
      .filter((e) => kind === 'all' || e.kind === kind)
      .filter((e) => words.every((w) => `${e.name} ${e.category}`.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [entries, query, kind])

  const bookById = new Map((books ?? []).map((b) => [b.id, b]))
  const indexing = books?.some((b) => b.indexedPages < b.pageCount || b.extractedVersion === 0)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden border-line bg-surface sm:max-h-[85vh] sm:rounded-lg sm:border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add from your books"
      >
        <div className="flex items-center gap-2 border-b border-line p-3">
          <input
            autoFocus
            type="search"
            className="input flex-1 py-2 text-base"
            placeholder={`Search ${kinds.map((k) => KIND_LABELS[k].toLowerCase()).join(', ')}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
        {kinds.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2 text-xs">
            {(['all', ...kinds] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded px-2 py-1 ${kind === k ? 'bg-accent/20 text-accent' : 'text-muted hover:text-fg'}`}
              >
                {k === 'all' ? 'All' : KIND_LABELS[k]}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {entries && entries.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">
              {indexing ? (
                'Your books are still being read. This takes a minute after adding a PDF; keep this tab open.'
              ) : (
                <>
                  Nothing found yet. Add your rulebook PDFs in the{' '}
                  <Link to="/library" className="text-accent hover:underline">
                    Library
                  </Link>{' '}
                  and they become a catalog here.
                </>
              )}
            </div>
          ) : (
            <ul>
              {filtered.slice(0, MAX_RESULTS).map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  book={bookById.get(entry.bookId)}
                  open={selected === entry.id}
                  added={added.includes(entry.id)}
                  onToggle={() => setSelected(selected === entry.id ? null : entry.id)}
                  onAdd={(rating, grade) => {
                    const { list, item } = toCharacterItem(entry, bookById.get(entry.bookId), { rating, grade })
                    onAdd(list, item)
                    setAdded((a) => [...a, entry.id])
                    setSelected(null)
                  }}
                />
              ))}
              {filtered.length > MAX_RESULTS && (
                <li className="p-3 text-center text-xs text-muted">
                  {filtered.length - MAX_RESULTS} more; type to narrow the list.
                </li>
              )}
              {entries && filtered.length === 0 && <li className="p-6 text-center text-sm text-muted">No matches.</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function EntryRow({
  entry,
  book,
  open,
  added,
  onToggle,
  onAdd,
}: {
  entry: CatalogEntry
  book: Book | undefined
  open: boolean
  added: boolean
  onToggle: () => void
  onAdd: (rating: number, grade: GradeId) => void
}) {
  const range = ratingRange(entry)
  const [rating, setRating] = useState(range?.min ?? 0)
  const [grade, setGrade] = useState<GradeId>('standard')
  const needsOptions = !!range || entry.kind === 'augmentation'

  return (
    <li className="border-b border-line/60">
      <div className="flex items-start gap-3 px-3 py-2 hover:bg-white/[0.03]">
        <button className="min-w-0 flex-1 text-left" onClick={needsOptions ? onToggle : () => onAdd(0, 'standard')}>
          <div className="text-sm">
            {entry.name}
            {added && <span className="ml-2 text-xs text-accent">✓ added</span>}
          </div>
          <div className="truncate text-xs text-muted">
            {entry.category} · {entrySummary(entry)}
          </div>
        </button>
        {book && (
          <Link
            to={`/book/${book.id}?pdf=${entry.page}`}
            className="shrink-0 pt-0.5 text-xs text-accent hover:underline"
            title="Read the rules on this page"
          >
            {book.code || book.title} {pdfPageToPrinted(book, entry.page)}
          </Link>
        )}
        <button
          className="btn shrink-0 px-2 text-xs"
          onClick={needsOptions ? onToggle : () => onAdd(0, 'standard')}
          aria-label={`Add ${entry.name}`}
        >
          {needsOptions ? (open ? 'Cancel' : 'Add…') : 'Add'}
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap items-end gap-3 bg-bg/50 px-3 py-3 text-sm">
          {range && (
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                {entry.kind === 'quality' || entry.kind === 'adeptPower' ? 'Level' : 'Rating'}
              </span>
              <select className="input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
          {entry.kind === 'augmentation' && (
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Grade</span>
              <select className="input" value={grade} onChange={(e) => setGrade(e.target.value as GradeId)}>
                {(Object.keys(AUGMENTATION_GRADES) as GradeId[]).map((g) => (
                  <option key={g} value={g}>
                    {AUGMENTATION_GRADES[g].name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="btn btn-primary" onClick={() => onAdd(rating, grade)}>
            Add
          </button>
        </div>
      )}
    </li>
  )
}
