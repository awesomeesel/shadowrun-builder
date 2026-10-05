import type { ReactNode } from 'react'
import { NumberInput } from './ui'

interface Identified {
  id: string
}

// Tailwind needs literal class names, so spans map to fixed classes.
const SPAN_CLASS = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  8: 'sm:col-span-8',
  12: 'sm:col-span-12',
} as const

type Span = keyof typeof SPAN_CLASS

type Setter<T> = (patch: Partial<T>) => void

export type FieldDef<T> = {
  label: string
  /** Width on the 12-column desktop grid. */
  span: Span
  /** Take the full width on phones instead of half. */
  wide?: boolean
} & (
  | { kind: 'text'; key: keyof T & string; placeholder?: string }
  | { kind: 'number'; key: keyof T & string; min?: number }
  | { kind: 'checkbox'; key: keyof T & string }
  | { kind: 'select'; key: keyof T & string; options: { value: string; label: string }[] }
  | { kind: 'custom'; render: (item: T, set: Setter<T>) => ReactNode }
)

/**
 * Editable list of records, one card per item with a responsive field grid.
 * Used for qualities, contacts, gear and other repeating sections.
 */
export function ListEditor<T extends Identified>({
  items,
  onChange,
  fields,
  newItem,
  addLabel,
  emptyText,
}: {
  items: T[]
  onChange: (items: T[]) => void
  fields: FieldDef<T>[]
  newItem: () => T
  addLabel: string
  emptyText: string
}) {
  const patch = (id: string, change: Partial<T>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...change } : item)))

  return (
    <div>
      {items.length === 0 && <p className="mb-3 text-sm text-muted">{emptyText}</p>}
      <ul className="mb-3 grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2 rounded border border-line/70 bg-bg/40 p-2">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-12">
              {fields.map((field) => (
                <label
                  key={field.label}
                  className={`block ${SPAN_CLASS[field.span]} ${field.wide ? 'col-span-2' : ''}`}
                >
                  <span className="mb-0.5 block text-[11px] text-muted">{field.label}</span>
                  {renderField(field, item, (change) => patch(item.id, change))}
                </label>
              ))}
            </div>
            <button
              className="self-start px-1 text-muted hover:text-danger"
              aria-label="Remove"
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button className="btn w-full" onClick={() => onChange([...items, newItem()])}>
        + {addLabel}
      </button>
    </div>
  )
}

function renderField<T>(field: FieldDef<T>, item: T, set: Setter<T>): ReactNode {
  if (field.kind === 'custom') return field.render(item, set)

  const value = item[field.key]
  const setValue = (v: unknown) => set({ [field.key]: v } as Partial<T>)

  switch (field.kind) {
    case 'text':
      return (
        <input
          className="input w-full"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
      )
    case 'number':
      return <NumberInput value={Number(value ?? 0)} min={field.min} onChange={setValue} />
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="mt-2 size-4 accent-accent"
          checked={Boolean(value)}
          onChange={(e) => setValue(e.target.checked)}
        />
      )
    case 'select':
      return (
        <select className="input w-full" value={String(value)} onChange={(e) => setValue(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
  }
}
