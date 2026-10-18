import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SourceLink } from '../components/SourceLink'
import { EDGE_ACTIONS, type EdgeActionTag } from '../rules/sr6/help'

const FILTERS: [EdgeActionTag | 'all', string][] = [
  ['all', 'All'],
  ['melee', 'Melee'],
  ['ranged', 'Ranged'],
  ['any', 'Any attack or action'],
]

/**
 * Edge actions for the GM's side (p. 47–48): picked before the roll, paid
 * from the NPC's Edge or their grunt group's shared pool.
 */
export function EdgeActionPicker({
  name,
  edge,
  shared,
  usedThisRound,
  onUse,
  onClose,
}: {
  name: string
  edge: number
  /** Paid from a grunt group's pool. */
  shared: boolean
  /** The group already used Edge this round (allowed once per round, p. 203). */
  usedThisRound: boolean
  onUse: (label: string, cost: number) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<EdgeActionTag | 'all'>('all')
  const [open, setOpen] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const actions = EDGE_ACTIONS.filter(
    (a) => a.tag !== 'social' && (filter === 'all' || a.tag === filter || (filter !== 'any' && a.tag === 'any')),
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-4 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Edge action for ${name}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-5 text-amber" />
          <h2 className="mr-auto font-display text-lg">Edge action: {name}</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <p className="mb-2 text-xs text-muted">
          Pick it before rolling the action it goes with. {shared ? 'Group Edge' : 'Edge'}:{' '}
          <span className="text-amber">{edge}</span>. After the roll, the result panel has rerolls and extra hits.
        </p>
        {usedThisRound && (
          <p className="mb-2 rounded bg-amber/10 px-2 py-1 text-xs text-amber">
            This group already used Edge this round. Grunts in a group can use their shared Edge once per round (p.
            203).
          </p>
        )}
        <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              className={`chip cursor-pointer ${filter === id ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="grid gap-1.5">
          {actions.map((a) => (
            <li key={a.name} className="rounded-lg border border-line bg-bg/40 text-sm">
              <div className="flex items-center gap-2 p-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === a.name ? '' : a.name)}>
                  <span className="font-semibold">{a.name}</span> <span className="text-xs text-muted">· {a.with}</span>
                </button>
                <button
                  className="btn shrink-0 px-2 py-1 text-xs"
                  disabled={edge < a.cost}
                  onClick={() => {
                    onUse(a.name, a.cost)
                    onClose()
                  }}
                >
                  Use · {a.cost}
                </button>
              </div>
              {open === a.name && (
                <p className="border-t border-line/60 px-2 py-1.5 text-xs text-muted">
                  {a.text} <SourceLink source={{ book: 'CRB', page: a.page }} />
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
