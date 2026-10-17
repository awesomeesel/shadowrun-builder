import { X } from 'lucide-react'
import { useState } from 'react'
import { EDGE_BOOSTS, type EdgeBoost, type Roll } from '../rules/sr6/play'

// Pip positions on a 3x3 grid for each face.
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
}

/** One die face. Hits glow in the accent colour, ones in red. */
export function DieFace({ value, className = 'size-9' }: { value: number; className?: string }) {
  const hit = value >= 5
  const one = value === 1
  const color = hit ? 'var(--color-accent)' : one ? 'var(--color-danger)' : '#8b98ad'
  return (
    <svg viewBox="0 0 36 36" className={className} aria-label={`${value}`}>
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="7"
        fill={hit ? 'rgb(62 232 181 / 0.15)' : one ? 'rgb(255 92 122 / 0.12)' : '#121722'}
        stroke={color}
        strokeWidth="1.5"
      />
      {PIPS[value].map(([cx, cy], i) => (
        <circle key={i} cx={9 + cx * 9} cy={9 + cy * 9} r="3" fill={color} />
      ))}
    </svg>
  )
}

/** What the roll panel needs to offer Edge boosts. */
export interface EdgeOptions {
  available: number
  onBoost: (boost: EdgeBoost, die: number) => void
  /** Initiative rolls can buy +3 for 1 Edge. */
  onInitiativeBoost?: () => void
}

/** Result panel for a roll: the dice, hit count, glitches, and Edge boosts to change it. */
export function RollResult({
  label,
  roll,
  bonus,
  info,
  edge,
  onClose,
  onReroll,
}: {
  label: string
  roll: Roll
  /** Added to the dice total, for initiative rolls. */
  bonus?: number
  /** Extra line under the result, e.g. the weapon's damage and Attack Rating. */
  info?: string
  edge?: EdgeOptions
  onClose: () => void
  onReroll: () => void
}) {
  const [picking, setPicking] = useState<'rerollOne' | 'plusOne' | null>(null)
  const total = roll.dice.reduce((a, b) => a + b, 0)
  const afford = (cost: number) => !!edge && edge.available >= cost
  const pick = (die: number) => {
    if (!picking || !edge) return
    edge.onBoost(picking, die)
    setPicking(null)
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[28rem] sm:p-0">
      <div className="card max-h-[80vh] overflow-y-auto border-accent/40 p-4 shadow-[0_0_40px_-12px_var(--color-accent)]">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-muted">
              {label} · {roll.pool} {roll.pool === 1 ? 'die' : 'dice'}
              {roll.dice.length > roll.pool && ` + ${roll.dice.length - roll.pool} exploded`}
              {roll.edge > 0 && ` · ${roll.edge} Edge spent`}
            </div>
            {bonus !== undefined ? (
              <div className="font-display text-3xl font-semibold text-accent">
                {bonus + total} <span className="text-base text-muted">initiative</span>
              </div>
            ) : (
              <div
                className={`font-display text-3xl font-semibold ${roll.criticalGlitch || roll.glitch ? 'text-danger' : 'text-accent'}`}
              >
                {roll.hits} {roll.hits === 1 ? 'hit' : 'hits'}
                {roll.criticalGlitch ? ' · CRITICAL GLITCH' : roll.glitch ? ' · glitch' : ''}
              </div>
            )}
            {info && <div className="mt-0.5 text-sm text-muted">{info}</div>}
          </div>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close roll">
            <X className="size-5" />
          </button>
        </div>
        {picking && (
          <p className="mb-2 text-sm text-amber">
            Tap the die to {picking === 'rerollOne' ? 'reroll' : 'raise by 1'}.{' '}
            <button className="underline" onClick={() => setPicking(null)}>
              Cancel
            </button>
          </p>
        )}
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {roll.dice.map((d, i) => (
            <button
              key={i}
              disabled={!picking || (picking === 'plusOne' && d === 6)}
              onClick={() => pick(i)}
              className={picking ? 'rounded-lg ring-amber/70 hover:ring-2 disabled:opacity-40' : ''}
              aria-label={`Die ${i + 1}: ${d}`}
            >
              <DieFace value={d} />
            </button>
          ))}
          {roll.autoHits > 0 && (
            <span className="chip self-center border-accent/50 text-accent">+{roll.autoHits} bought</span>
          )}
        </div>
        {edge && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-1.5 text-xs text-muted">Spend Edge ({edge.available} left)</div>
            <div className="flex flex-wrap gap-1.5">
              {bonus !== undefined ? (
                edge.onInitiativeBoost && (
                  <button className="btn text-xs" disabled={!afford(1)} onClick={edge.onInitiativeBoost}>
                    +3 initiative · 1
                  </button>
                )
              ) : (
                <>
                  <button
                    className="btn text-xs"
                    disabled={!afford(EDGE_BOOSTS.rerollOne.cost)}
                    onClick={() => setPicking('rerollOne')}
                  >
                    {EDGE_BOOSTS.rerollOne.label} · {EDGE_BOOSTS.rerollOne.cost}
                  </button>
                  <button
                    className="btn text-xs"
                    disabled={!afford(EDGE_BOOSTS.plusOne.cost)}
                    onClick={() => setPicking('plusOne')}
                  >
                    {EDGE_BOOSTS.plusOne.label} · {EDGE_BOOSTS.plusOne.cost}
                  </button>
                  <button
                    className="btn text-xs"
                    disabled={!afford(EDGE_BOOSTS.autoHit.cost)}
                    onClick={() => edge.onBoost('autoHit', -1)}
                  >
                    {EDGE_BOOSTS.autoHit.label} · {EDGE_BOOSTS.autoHit.cost}
                  </button>
                  <button
                    className="btn text-xs"
                    disabled={!afford(EDGE_BOOSTS.rerollFailures.cost) || roll.glitch}
                    title={roll.glitch ? 'Not allowed after a glitch' : undefined}
                    onClick={() => edge.onBoost('rerollFailures', -1)}
                  >
                    {EDGE_BOOSTS.rerollFailures.label} · {EDGE_BOOSTS.rerollFailures.cost}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <button className="btn mt-3 w-full" onClick={onReroll}>
          Roll again
        </button>
      </div>
    </div>
  )
}
