import { X } from 'lucide-react'
import type { Roll } from '../rules/sr6/play'

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

/** Result panel for a roll: the dice, hit count and any glitch. */
export function RollResult({
  label,
  roll,
  bonus,
  onClose,
  onReroll,
}: {
  label: string
  roll: Roll
  /** Added to the dice total, for initiative rolls. */
  bonus?: number
  onClose: () => void
  onReroll: () => void
}) {
  const total = roll.dice.reduce((a, b) => a + b, 0)
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[26rem] sm:p-0">
      <div className="card border-accent/40 p-4 shadow-[0_0_40px_-12px_var(--color-accent)]">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-muted">
              {label} · {roll.pool} {roll.pool === 1 ? 'die' : 'dice'}
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
          </div>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close roll">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {roll.dice.map((d, i) => (
            <DieFace key={i} value={d} />
          ))}
        </div>
        <button className="btn mt-3 w-full" onClick={onReroll}>
          Roll again
        </button>
      </div>
    </div>
  )
}
