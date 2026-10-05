import { useState, type ReactNode } from 'react'

export function Section({
  title,
  children,
  className = '',
  aside,
}: {
  title: string
  children: ReactNode
  className?: string
  aside?: ReactNode
}) {
  return (
    <section className={`card p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm tracking-widest text-accent uppercase">{title}</h2>
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
