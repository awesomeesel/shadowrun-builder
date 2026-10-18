import { Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import type { Campaign, SharedSheet } from '../db/db'
import { STATUSES, STATUS_BY_NAME } from '../rules/sr6/statuses'
import { allowed, describeMessage, sendToRunner, type GmMessage } from '../share/messages'
import { Counter } from '../pages/character/play/RollStep'

type Kind = GmMessage['kind']

const LABELS: Record<Kind, string> = { damage: 'Damage', status: 'Status', edge: 'Edge', reward: 'Karma & nuyen' }

/**
 * GM: send damage, a status, Edge or a reward to one shared runner. The player
 * sees it on their character and accepts or declines it.
 */
export function SendDialog({
  campaign,
  sheet,
  kinds = ['damage', 'status', 'edge', 'reward'],
  onClose,
}: {
  campaign: Campaign
  sheet: SharedSheet
  /** Which tabs to offer (an encounter leaves out rewards). */
  kinds?: Kind[]
  onClose: () => void
}) {
  const offered = kinds.filter((k) => allowed(campaign, k))
  const [kind, setKind] = useState<Kind>(offered[0] ?? 'damage')
  const [value, setValue] = useState(6)
  const [type, setType] = useState<'P' | 'S'>('P')
  const [resist, setResist] = useState(true)
  const [status, setStatus] = useState(STATUSES[0].name)
  const [level, setLevel] = useState(1)
  const [rounds, setRounds] = useState('')
  const [edge, setEdge] = useState(1)
  const [karma, setKarma] = useState(0)
  const [nuyen, setNuyen] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const def = STATUS_BY_NAME.get(status.toLowerCase())
  const message = (): GmMessage => {
    switch (kind) {
      case 'damage':
        return { kind, value, type, resist, note: note.trim() }
      case 'status':
        return {
          kind,
          name: status,
          value: def?.value ? level : 0,
          rounds: rounds ? Math.max(1, parseInt(rounds, 10) || 1) : null,
          note: note.trim(),
        }
      case 'edge':
        return { kind, amount: edge, note: note.trim() }
      case 'reward':
        return { kind, karma, nuyen, note: note.trim() }
    }
  }
  const empty = kind === 'reward' && karma === 0 && nuyen === 0

  const send = async () => {
    setBusy(true)
    setError('')
    const m = message()
    try {
      await sendToRunner(campaign, sheet, m)
      setResult(`Sent “${describeMessage(m)}” to ${sheet.character.name}. It changes their sheet once they accept.`)
      // The note belongs to this message, not the next one.
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Send to ${sheet.character.name}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <Send className="size-5 text-accent" />
          <h2 className="mr-auto font-display text-xl">Send to {sheet.character.name}</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {offered.length === 0 ? (
          <p className="text-sm text-muted">
            Sending is switched off for this campaign. Turn it on on the campaign page.
          </p>
        ) : (
          <div className="grid gap-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {offered.map((k) => (
                <button
                  key={k}
                  className={`chip cursor-pointer ${kind === k ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                  onClick={() => {
                    setKind(k)
                    setResult('')
                  }}
                >
                  {LABELS[k]}
                </button>
              ))}
            </div>

            {kind === 'damage' && (
              <>
                <div className="flex flex-wrap items-end gap-5">
                  <Counter label="Damage" value={value} min={1} max={40} onChange={setValue} />
                  <div>
                    <div className="mb-1 text-xs text-muted">Type</div>
                    <div className="flex gap-1">
                      {(['P', 'S'] as const).map((t) => (
                        <button
                          key={t}
                          className={`btn px-3 ${type === t ? 'border-accent text-accent' : ''}`}
                          onClick={() => setType(t)}
                        >
                          {t === 'P' ? 'Physical' : 'Stun'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={resist} onChange={(e) => setResist(e.target.checked)} />
                  <span>
                    The player rolls to resist it
                    <span className="block text-xs text-muted">
                      Send the DV plus your net hits; they soak it. Untick to put the boxes straight on.
                    </span>
                  </span>
                </label>
              </>
            )}

            {kind === 'status' && (
              <div className="flex flex-wrap items-end gap-3">
                <label>
                  <div className="mb-1 text-xs text-muted">Status</div>
                  <select
                    {...noAutofillField}
                    className="input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </select>
                </label>
                {def?.value && (
                  <Counter
                    label={def.value === 'level' ? 'Level' : 'Number'}
                    value={level}
                    min={1}
                    max={def.value === 'level' ? 4 : 20}
                    onChange={setLevel}
                  />
                )}
                <label>
                  <div className="mb-1 text-xs text-muted">Rounds (empty: until removed)</div>
                  <input
                    {...noAutofill}
                    type="number"
                    min={1}
                    className="input w-24"
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                  />
                </label>
                {def && <p className="basis-full text-xs text-muted">{def.effect}</p>}
              </div>
            )}

            {kind === 'edge' && (
              <div className="flex flex-wrap items-end gap-3">
                <Counter label="Edge" value={edge} min={-3} max={3} onChange={setEdge} />
                <p className="text-xs text-muted">
                  For a clever plan or great roleplay. Negative takes Edge away. They can’t go above 7.
                </p>
              </div>
            )}

            {kind === 'reward' && (
              <div className="flex flex-wrap gap-3">
                <label>
                  <div className="mb-1 text-xs text-muted">Karma</div>
                  <input
                    {...noAutofill}
                    type="number"
                    min={0}
                    className="input w-24"
                    value={karma}
                    onChange={(e) => setKarma(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-muted">Nuyen</div>
                  <input
                    {...noAutofill}
                    type="number"
                    min={0}
                    step={500}
                    className="input w-32"
                    value={nuyen}
                    onChange={(e) => setNuyen(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </label>
              </div>
            )}

            <label>
              <div className="mb-1 text-xs text-muted">Note (optional, the player sees it)</div>
              <input
                {...noAutofill}
                className="input w-full"
                placeholder={kind === 'damage' ? 'Ganger 2, burst fire' : kind === 'reward' ? 'The Renraku job' : ''}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {result && <p className="text-xs text-accent">{result}</p>}
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={busy || empty} onClick={() => void send()}>
                <Send className="size-4" /> {busy ? 'Sending…' : `Send ${describeMessage(message()) || ''}`}
              </button>
              <button className="btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
