import { noAutofill } from './noAutofill'
import { useState, type ReactNode } from 'react'

export function Section({
  title,
  children,
  className = '',
  aside,
  icon,
}: {
  title: string
  children: ReactNode
  className?: string
  aside?: ReactNode
  icon?: ReactNode
}) {
  return (
    <section className={`card min-w-0 p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm tracking-widest text-accent uppercase">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  )
}

/**
 * Integer input that lets the field be cleared while typing; the last valid
 * number is kept and the field shows it again on blur.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...noAutofill}
      type="number"
      inputMode="numeric"
      className={`input w-full text-center ${className}`}
      value={draft ?? String(value)}
      min={min}
      max={max}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = parseInt(e.target.value, 10)
        if (!Number.isNaN(parsed)) onChange(parsed)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

/** Decimal input that accepts a comma or a dot, e.g. "0,5" or "1.25". */
export function DecimalInput({
  value,
  onChange,
  min = 0,
  max,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...noAutofill}
      className={`input w-full text-center ${className}`}
      inputMode="decimal"
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = parseFloat(e.target.value.replace(',', '.'))
        if (!Number.isNaN(parsed) && parsed >= min && (max === undefined || parsed <= max)) onChange(parsed)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
