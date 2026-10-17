import { useEffect, type ReactNode } from 'react'
import { DieFace } from '../../../components/Dice'
import type { Roll } from '../../../rules/sr6/play'

/** One roll inside a step-by-step dialog: a button until rolled, then the dice and hits. */
export function RollStep({
  label,
  pool,
  roll,
  onRoll,
  disabled = false,
  children,
}: {
  label: string
  pool: number
  roll: Roll | null
  onRoll: () => void
  disabled?: boolean
  /** Shown under the result, e.g. what the hits mean. */
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-line bg-bg/40 p-3 text-sm">
      {roll ? (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {roll.dice.map((d, i) => (
              <DieFace key={i} value={d} className="size-7" />
            ))}
          </div>
          <div>
            {label}: <strong className="text-accent">{roll.hits}</strong> {roll.hits === 1 ? 'hit' : 'hits'}
            {roll.criticalGlitch ? (
              <span className="ml-2 font-semibold text-danger">Critical glitch!</span>
            ) : (
              roll.glitch && <span className="ml-2 text-danger">Glitch</span>
            )}
          </div>
        </>
      ) : (
        <button className="btn btn-primary w-full" onClick={onRoll} disabled={disabled}>
          Roll {label.toLowerCase()} ({pool} {pool === 1 ? 'die' : 'dice'})
        </button>
      )}
      {children && <div className="mt-2 text-xs text-muted">{children}</div>}
    </div>
  )
}

/** Shared frame for the step-by-step play dialogs. */
export function PlayDialog({
  title,
  icon,
  onClose,
  children,
  footer,
}: {
  title: string
  icon: ReactNode
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <h2 className="flex items-center gap-2 font-display text-xl">
          {icon} {title}
        </h2>
        <div className="mt-4 grid gap-4 text-sm">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  )
}

/** −/+ number control used in the play dialogs. */
export function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex items-center gap-2">
        <button
          className="btn size-9 p-0"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Lower ${label}`}
        >
          −
        </button>
        <span className="w-8 text-center font-display text-2xl tabular-nums">{value}</span>
        <button
          className="btn size-9 p-0"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Raise ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

/** The Centering metamagic: + Initiate Grade dice on a drain roll, for a Minor Action (p. 167). */
export function CenteringToggle({
  dice,
  checked,
  onChange,
}: {
  dice: number
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  if (dice <= 0) return null
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        className="size-4 accent-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Centering: +{dice} dice on the drain roll (a Minor Action)
    </label>
  )
}
