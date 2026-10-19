import { Minus, Plus, X } from 'lucide-react'
import { noAutofillField } from './noAutofill'
import type { Bonuses } from '../model/character'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS, type AttributeId } from '../rules/sr6/attributes'
import { BONUS_KINDS } from '../rules/sr6/bonuses'

type NumberKey = (typeof BONUS_KINDS)[number]['key'] | 'initiativeDice' | 'unarmedDamageSet'

/** Every kind of bonus, as it reads in the list. */
const CHOICES: { id: string; label: string }[] = [
  { id: 'defenseRating', label: 'Defense Rating' },
  { id: 'unarmedAttackRating', label: 'Unarmed Attack Rating' },
  { id: 'unarmedDamage', label: 'Unarmed damage (added)' },
  { id: 'unarmedDamageSet', label: 'Unarmed DV becomes (bone lacing)' },
  { id: 'unarmedPhysical', label: 'Unarmed damage is Physical' },
  { id: 'physicalBoxes', label: 'Physical boxes (condition monitor)' },
  { id: 'stunBoxes', label: 'Stun boxes (condition monitor)' },
  { id: 'physicalResistance', label: 'Physical damage resistance (soak dice)' },
  { id: 'initiativeDice', label: 'Initiative dice' },
  ...ATTRIBUTE_IDS.filter((a) => a !== 'magic' && a !== 'resonance').map((a) => ({
    id: `attr:${a}`,
    label: ATTRIBUTE_LABELS[a].name,
  })),
]

const labelOf = (id: string) => CHOICES.find((c) => c.id === id)?.label ?? id

/** The bonuses that are set, as editor rows. */
function rows(value: Bonuses): { id: string; amount: number | null }[] {
  const out: { id: string; amount: number | null }[] = []
  for (const a of ATTRIBUTE_IDS) if (value.attributes[a]) out.push({ id: `attr:${a}`, amount: value.attributes[a]! })
  for (const c of CHOICES) {
    if (c.id.startsWith('attr:')) continue
    if (c.id === 'unarmedPhysical') {
      if (value.unarmedPhysical) out.push({ id: c.id, amount: null })
    } else if (value[c.id as NumberKey]) out.push({ id: c.id, amount: value[c.id as NumberKey] })
  }
  return out
}

function set(value: Bonuses, id: string, amount: number | null): Bonuses {
  if (id === 'unarmedPhysical') return { ...value, unarmedPhysical: !!amount }
  if (id.startsWith('attr:')) {
    const a = id.slice(5) as AttributeId
    const attributes = { ...value.attributes }
    if (amount) attributes[a] = amount
    else delete attributes[a]
    return { ...value, attributes }
  }
  return { ...value, [id]: amount ?? 0 }
}

/**
 * Bonuses an augmentation, power or adjustment gives: pick what it raises,
 * then how much. Counted everywhere the number is used (Sheet, Play, GM).
 */
export function BonusEditor({ value, onChange }: { value: Bonuses; onChange: (value: Bonuses) => void }) {
  const current = rows(value)
  const unused = CHOICES.filter((c) => !current.some((r) => r.id === c.id))
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {current.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2 py-1 text-sm">
          <span className="min-w-0 flex-1 truncate">{labelOf(r.id)}</span>
          {r.amount !== null && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                className="btn size-7 p-0"
                onClick={() =>
                  onChange(
                    set(value, r.id, r.id === 'unarmedDamageSet' ? Math.max(1, r.amount! - 1) : r.amount! - 1 || -1),
                  )
                }
                aria-label={`Lower ${labelOf(r.id)}`}
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-8 text-center font-semibold text-accent tabular-nums">
                {r.amount > 0 && r.id !== 'unarmedDamageSet' ? '+' : ''}
                {r.amount}
              </span>
              <button
                type="button"
                className="btn size-7 p-0"
                onClick={() => onChange(set(value, r.id, r.amount! + 1 || 1))}
                aria-label={`Raise ${labelOf(r.id)}`}
              >
                <Plus className="size-3.5" />
              </button>
            </span>
          )}
          <button
            type="button"
            className="text-muted hover:text-danger"
            onClick={() => onChange(set(value, r.id, r.id === 'unarmedPhysical' ? null : 0))}
            aria-label={`Remove ${labelOf(r.id)}`}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <select
        {...noAutofillField}
        className="input min-w-0 py-1.5 text-sm text-muted"
        value=""
        onChange={(e) => {
          const id = e.target.value
          if (id) onChange(set(value, id, 1))
        }}
        aria-label="Add a bonus"
      >
        <option value="">+ Add bonus…</option>
        {unused.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  )
}
