import { Package, Plus, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NumberInput } from '../components/ui'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import type { Campaign, SharedSheet } from '../db/db'
import type { Participant } from '../model/encounter'
import { gmSends, sendToRunner } from '../share/messages'
import { lootFrom, splitNuyen } from './loot'

/**
 * After a fight: pick what the runners take from the enemies (suggested from
 * their stat blocks), add anything else, and send it. Items go to the runner
 * who picks them up; nuyen is split between the runners you choose. Players
 * accept it onto their sheets like any reward.
 */
export function LootDialog({
  campaign,
  runners,
  participants,
  isDown,
  title,
  onClose,
}: {
  campaign: Campaign
  /** Runners shared live in the campaign. */
  runners: SharedSheet[]
  participants: Participant[]
  isDown: (p: Participant) => boolean
  title: string
  onClose: () => void
}) {
  const sources = lootFrom(participants, isDown)
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(sources.flatMap((s) => (s.down ? s.items.map((_, i) => `${s.id}:${i}`) : []))),
  )
  const [extra, setExtra] = useState<string[]>([])
  const [newItem, setNewItem] = useState('')
  const [nuyen, setNuyen] = useState(0)
  const [taker, setTaker] = useState(runners[0]?.id ?? '')
  const [sharers, setSharers] = useState<string[]>(runners.map((r) => r.id))
  const [note, setNote] = useState(title)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (key: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const items = [...sources.flatMap((s) => s.items.filter((_, i) => picked.has(`${s.id}:${i}`))), ...extra]
  const shares = splitNuyen(nuyen, sharers.length)
  const allowed = gmSends(campaign).rewards
  const empty = items.length === 0 && nuyen === 0

  const send = async () => {
    setBusy(true)
    setError('')
    const sent: string[] = []
    const failed: string[] = []
    for (const runner of runners) {
      const mine = runner.id === taker ? items : []
      const index = sharers.indexOf(runner.id)
      const cash = index >= 0 ? shares[index] : 0
      if (mine.length === 0 && cash === 0) continue
      try {
        await sendToRunner(campaign, runner, { kind: 'loot', items: mine, nuyen: cash, note: note.trim() })
        sent.push(runner.character.name)
      } catch (e) {
        failed.push(`${runner.character.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setBusy(false)
    if (failed.length) setError(`Couldn’t send to ${failed.join('; ')}`)
    if (sent.length) setResult(`Sent to ${sent.join(', ')}. It goes on their sheets when they accept.`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        className="card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 text-sm sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!empty && !busy) void send()
        }}
        aria-label="Loot"
      >
        <div className="mb-3 flex items-center">
          <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
            <Package className="size-5 text-accent" /> Loot
          </h2>
          <button type="button" className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {!allowed && (
          <p className="mb-3 rounded-lg border border-amber/50 bg-amber/10 p-2 text-xs">
            Sending karma and nuyen is switched off for this campaign (on the campaign page), and loot counts as a
            reward.
          </p>
        )}
        {runners.length === 0 ? (
          <p className="text-muted">Loot goes to runners shared live in the campaign; none are yet.</p>
        ) : (
          <div className="grid gap-4">
            {sources.length > 0 ? (
              <div className="grid gap-2">
                <div className="text-xs text-muted">
                  From the enemies’ stat blocks. Those who are down are ticked; tick what the runners actually take.
                </div>
                {sources.map((s) => {
                  const keys = s.items.map((_, i) => `${s.id}:${i}`)
                  const all = keys.every((k) => picked.has(k))
                  return (
                    <div key={s.id} className="rounded-lg border border-line p-2">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-semibold">{s.name}</span>
                        {s.down && <span className="chip border-danger/50 text-[10px] text-danger">Down</span>}
                        <button
                          type="button"
                          className="ml-auto text-xs text-muted hover:text-fg"
                          onClick={() => keys.forEach((k) => toggle(k, !all))}
                        >
                          {all ? 'None' : 'All'}
                        </button>
                      </div>
                      <div className="grid gap-0.5">
                        {s.items.map((item, i) => (
                          <label key={i} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 accent-accent"
                              checked={picked.has(`${s.id}:${i}`)}
                              onChange={(e) => toggle(`${s.id}:${i}`, e.target.checked)}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">
                No enemies with stat blocks from the books here; add what they carried below.
              </p>
            )}

            <div>
              <div className="mb-1 text-xs text-muted">Anything else</div>
              {extra.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {extra.map((item, i) => (
                    <li key={i} className="chip">
                      {item}
                      <button
                        type="button"
                        className="ml-1 text-muted hover:text-danger"
                        onClick={() => setExtra(extra.filter((_, j) => j !== i))}
                        aria-label={`Remove ${item}`}
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  {...noAutofill}
                  className="input min-w-0 flex-1 py-1"
                  placeholder="Keycard, a briefcase of data chips…"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newItem.trim()) {
                      e.preventDefault()
                      setExtra([...extra, newItem.trim()])
                      setNewItem('')
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn py-1 text-xs"
                  disabled={!newItem.trim()}
                  onClick={() => {
                    setExtra([...extra, newItem.trim()])
                    setNewItem('')
                  }}
                >
                  <Plus className="size-3.5" /> Add
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <div className="mb-1 text-xs text-muted">Items go to</div>
                <select
                  {...noAutofillField}
                  className="input w-full"
                  value={taker}
                  onChange={(e) => setTaker(e.target.value)}
                >
                  {runners.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.character.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="mb-1 text-xs text-muted">Cash and credsticks (nuyen)</div>
                <NumberInput value={nuyen} min={0} onChange={setNuyen} />
              </label>
            </div>
            {nuyen > 0 && (
              <div>
                <div className="mb-1 text-xs text-muted">Split the nuyen between</div>
                <div className="flex flex-wrap gap-3">
                  {runners.map((r) => {
                    const index = sharers.indexOf(r.id)
                    return (
                      <label key={r.id} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-accent"
                          checked={index >= 0}
                          onChange={(e) =>
                            setSharers(e.target.checked ? [...sharers, r.id] : sharers.filter((id) => id !== r.id))
                          }
                        />
                        {r.character.name}
                        {index >= 0 && <span className="text-xs text-muted">{shares[index].toLocaleString()}¥</span>}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            <label>
              <div className="mb-1 text-xs text-muted">Note (shown to the players)</div>
              <input {...noAutofill} className="input w-full" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            {result && <p className="text-xs text-accent">{result}</p>}
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" disabled={busy || empty || !allowed}>
                <Send className="size-4" /> {busy ? 'Sending…' : 'Send loot'}
              </button>
              <span className="text-xs text-muted">
                {items.length} {items.length === 1 ? 'item' : 'items'}
                {nuyen > 0 && ` · ${nuyen.toLocaleString()}¥`}
              </span>
            </div>
          </div>
        )}
      </form>
    </div>,
    document.body,
  )
}
