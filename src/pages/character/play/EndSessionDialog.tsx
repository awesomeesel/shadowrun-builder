import { Flag, HeartPulse } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { keepDriveSignedIn } from '../../../cloud/cloud'
import { endSession, sessionEntries } from '../../../rules/sr6/play'
import type { CharacterContext } from '../CharacterPage'
import { HealDialog } from './HealDialog'

const boxes = (n: number) => `${n} ${n === 1 ? 'box' : 'boxes'}`

export function EndSessionDialog({ character, update, onClose }: CharacterContext & { onClose: () => void }) {
  const [clearStun, setClearStun] = useState(true)
  const [clearPhysical, setClearPhysical] = useState(false)
  const [healing, setHealing] = useState(false)
  const [heat, setHeat] = useState(0)
  const [reputation, setReputation] = useState(0)
  const stepper = (label: string, value: number, set: (n: number) => void, hint: string) => (
    <div className="flex items-center gap-2" title={hint}>
      <span className="flex-1 text-muted">{label}</span>
      <button className="btn size-7 p-0" onClick={() => set(value - 1)} aria-label={`Less ${label}`}>
        −
      </button>
      <span className="w-8 text-center tabular-nums">{value > 0 ? `+${value}` : value}</span>
      <button className="btn size-7 p-0" onClick={() => set(value + 1)} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  )
  const entries = sessionEntries(character)
  const nuyen = entries.reduce((s, e) => s + e.nuyen, 0)
  const karma = entries.reduce((s, e) => s + e.karma, 0)
  const line = (label: string, value: ReactNode) => (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
  return (
    <>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
        <div
          className="card w-full max-w-md p-5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="End session"
        >
          <h2 className="font-display text-xl">End {character.play.session?.title || 'session'}?</h2>
          <div className="mt-3 grid gap-1 text-sm">
            {line('Nuyen this session', `${nuyen >= 0 ? '+' : ''}${nuyen.toLocaleString()}¥`)}
            {line('Karma this session', `${karma >= 0 ? '+' : ''}${karma}`)}
            {line('Physical damage', boxes(character.damage.physical))}
            {line('Stun damage', boxes(character.damage.stun))}
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={clearStun}
                onChange={(e) => setClearStun(e.target.checked)}
              />
              Recover all Stun damage
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={clearPhysical}
                onChange={(e) => setClearPhysical(e.target.checked)}
              />
              Heal all Physical damage (downtime between runs)
            </label>
            {(character.damage.physical > 0 || character.damage.stun > 0 || character.damage.overflow > 0) && (
              <button className="btn justify-self-start text-xs" onClick={() => setHealing(true)}>
                <HeartPulse className="size-3.5" /> Heal step by step instead (first aid, medkit, magic, rest)…
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {stepper('Heat gained', heat, setHeat, 'Heat goes up when a run gets loud or leaves a trail.')}
            {stepper('Reputation gained', reputation, setReputation, 'Reputation changes with how the run went.')}
          </div>
          <p className="mt-3 text-xs text-muted">
            Everything else (Edge, ammo, money and karma) is kept as it is now. The session goes into the log.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>
              Keep playing
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                keepDriveSignedIn()
                update((c) => endSession(c, { clearStun, clearPhysical, heat, reputation }))
                onClose()
              }}
            >
              <Flag className="size-4" /> End session
            </button>
          </div>
        </div>
      </div>
      {healing && <HealDialog character={character} update={update} onClose={() => setHealing(false)} />}
    </>
  )
}
