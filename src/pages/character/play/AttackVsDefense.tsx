import { Minus, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { noAutofill } from '../../../components/noAutofill'
import { edgeFromRatings } from '../../../rules/sr6/play'

/**
 * Under an attack's result: compare your Attack Rating with the target's
 * Defense Rating (the GM says what it is). 4 or more apart, the higher side
 * gains 1 Edge (p. 106). Fill it in only when it matters.
 */
export function AttackVsDefense({
  attackRating,
  defense,
  setDefense,
  canGain,
  onGain,
}: {
  attackRating: number
  /** The target's Defense Rating, kept between attacks on the same target; null until the GM says. */
  defense: number | null
  setDefense: (dr: number | null) => void
  /** False when the 2 Edge a round are used up, or Edge is full. */
  canGain: boolean
  onGain: () => void
}) {
  const [taken, setTaken] = useState(false)
  const who = defense === null ? null : edgeFromRatings(attackRating, defense)

  return (
    <div className="mb-3 rounded-lg border border-line bg-bg/50 p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Your AR <b className="text-accent">{attackRating}</b> vs their DR
        </span>
        <span className="flex items-center gap-1">
          <button
            className="btn size-7 p-0"
            onClick={() => setDefense(Math.max(0, (defense ?? attackRating) - 1))}
            aria-label="Lower DR"
          >
            <Minus className="size-3.5" />
          </button>
          <input
            {...noAutofill}
            type="number"
            inputMode="numeric"
            min={0}
            className="input w-14 px-1 py-0.5 text-center font-display text-lg tabular-nums"
            placeholder="?"
            value={defense ?? ''}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              setDefense(Number.isFinite(value) ? Math.max(0, value) : null)
            }}
            aria-label="Target’s Defense Rating"
          />
          <button
            className="btn size-7 p-0"
            onClick={() => setDefense((defense ?? attackRating) + 1)}
            aria-label="Raise DR"
          >
            <Plus className="size-3.5" />
          </button>
          {defense !== null && (
            <button className="ml-1 text-xs text-muted hover:text-fg" onClick={() => setDefense(null)}>
              New target
            </button>
          )}
        </span>
      </div>
      {defense !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {who === 'attacker' ? (
            <>
              <span className="text-accent">4 or more above: you gain 1 Edge.</span>
              <button
                className="btn btn-primary ml-auto px-2.5 py-1 text-xs"
                disabled={taken || !canGain}
                onClick={() => {
                  onGain()
                  setTaken(true)
                }}
                title={canGain ? undefined : 'At most 2 Edge a round, and 7 in all'}
              >
                <Sparkles className="size-3.5" />{' '}
                {taken ? 'Edge taken' : canGain ? 'Take 1 Edge' : 'Can’t gain more now'}
              </button>
            </>
          ) : who === 'defender' ? (
            <span className="text-amber">4 or more below: the target gains 1 Edge. Tell the GM.</span>
          ) : (
            <span className="text-muted">Less than 4 apart: no Edge either way.</span>
          )}
        </div>
      )}
      {defense === null && (
        <p className="mt-1 text-xs text-muted">If the GM tells you the target’s Defense Rating, see who gains Edge.</p>
      )}
    </div>
  )
}
