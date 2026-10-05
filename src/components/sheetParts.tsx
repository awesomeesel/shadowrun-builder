import type { ReactNode } from 'react'
import type { ConditionMonitor } from '../rules/sr6/derived'
import { formatPool } from '../rules/sr6/format'

/** A labelled number tile. */
export function Stat({
  label,
  value,
  large = false,
  hint,
  tone,
  icon,
}: {
  label: string
  value: string | number
  large?: boolean
  hint?: string
  tone?: 'danger' | 'accent'
  icon?: ReactNode
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-line bg-gradient-to-b from-raised to-bg/60 px-2 py-1.5 text-center"
      title={hint}
    >
      <div className="flex items-center justify-center gap-1 text-[10px] tracking-wider text-muted uppercase">
        {icon}
        {label}
      </div>
      <div
        className={`${large ? 'text-xl' : 'text-lg'} font-display font-semibold tabular-nums ${
          tone === 'danger' ? 'text-danger' : tone === 'accent' ? 'text-accent' : ''
        }`}
      >
        {value}
      </div>
    </div>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** A dice pool, with the wound modifier applied when one is given. */
export function PoolRow({ label, pool, wounds = 0 }: { label: string; pool: number; wounds?: number }) {
  return <Row label={label} value={formatPool(pool, wounds)} />
}

/** Clickable condition monitor: tap a box to fill up to it, tap the last filled box to clear one. */
export function MonitorTrack({
  label,
  monitor,
  onChange,
  showModifiers = true,
  size = 'normal',
}: {
  label: string
  monitor: ConditionMonitor
  onChange: (filled: number) => void
  showModifiers?: boolean
  size?: 'normal' | 'large'
}) {
  const filled = Math.min(monitor.filled, monitor.boxes)
  const box = size === 'large' ? 'size-9 text-xs' : 'size-7 text-[10px]'
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {filled} / {monitor.boxes}
          {filled > 0 && (
            <button className="ml-3 text-muted hover:text-fg" onClick={() => onChange(0)}>
              Clear
            </button>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: monitor.boxes }, (_, i) => {
          const n = i + 1
          const isFilled = n <= filled
          const endsStep = showModifiers && n % 3 === 0
          return (
            <button
              key={n}
              aria-label={`${label} box ${n}`}
              onClick={() => onChange(n === filled ? n - 1 : n)}
              className={`${box} rounded-md border font-semibold transition-colors ${
                isFilled
                  ? 'border-danger bg-danger/80 text-bg shadow-[0_0_10px_-2px_var(--color-danger)]'
                  : 'border-line bg-bg hover:border-accent/60'
              } ${endsStep ? 'mr-2' : ''}`}
            >
              {isFilled ? '✕' : endsStep ? `-${n / 3}` : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}
