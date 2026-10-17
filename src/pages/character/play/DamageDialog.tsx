import { ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DieFace } from '../../../components/Dice'
import type { Character } from '../../../model/character'
import { computeDerived } from '../../../rules/sr6/derived'
import { applyDamage, drainType, recordRoll, rollPool, type DamageType, type Roll } from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'

type Source = 'attack' | 'drain' | 'fading' | 'direct'

/**
 * Taking damage step by step: how much and what kind, roll to resist it, then
 * fill the boxes. Stun that doesn't fit spills into Physical, then Overflow.
 */
export function DamageDialog({
  character,
  update,
  onClose,
}: {
  character: Character
  update: Update
  onClose: () => void
}) {
  const derived = computeDerived(character)
  const sources: { id: Source; label: string; pool: number | null }[] = [
    { id: 'attack', label: 'Attack or hazard', pool: null },
    ...(derived.magic?.drainResistance
      ? [{ id: 'drain' as const, label: 'Drain', pool: derived.magic.drainResistance }]
      : []),
    ...(derived.resonance
      ? [{ id: 'fading' as const, label: 'Fading', pool: derived.resonance.fadingResistance }]
      : []),
    { id: 'direct', label: 'No resistance roll', pool: 0 },
  ]
  const [source, setSource] = useState<Source>('attack')
  const [value, setValue] = useState(5)
  const [type, setType] = useState<DamageType>('P')
  const [roll, setRoll] = useState<Roll | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Physical damage is soaked with Body plus bonuses like bone lacing; Stun with Body alone.
  const resistPool =
    source === 'attack'
      ? type === 'P'
        ? derived.pools.physicalDamageResistance
        : derived.pools.damageResistance
      : (sources.find((s) => s.id === source)?.pool ?? 0)
  const boxes = Math.max(0, value - (roll?.hits ?? 0))
  // Drain and Fading are Stun, but Physical when more than Magic/Resonance (pp. 131, 189).
  const finalType: DamageType =
    source === 'drain'
      ? drainType(boxes, derived.attributes.magic)
      : source === 'fading'
        ? drainType(boxes, derived.attributes.resonance)
        : type
  const resisted = source === 'direct' || roll !== null

  const label = { attack: 'Damage resistance', drain: 'Drain resistance', fading: 'Fading resistance', direct: '' }[
    source
  ]
  const doRoll = () => {
    const result = rollPool(resistPool)
    setRoll(result)
    update((c) => recordRoll(c, label, result))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Take damage"
      >
        <h2 className="flex items-center gap-2 font-display text-xl">
          <ShieldAlert className="size-5 text-danger" /> Take damage
        </h2>

        <div className="mt-4 grid gap-4 text-sm">
          <div>
            <div className="mb-1 text-xs text-muted">From</div>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <button
                  key={s.id}
                  className={`chip cursor-pointer ${source === s.id ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                  onClick={() => {
                    setSource(s.id)
                    setRoll(null)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="mb-1 text-xs text-muted">
                {source === 'drain' ? 'Drain Value' : source === 'fading' ? 'Fading Value' : 'Damage (DV + net hits)'}
              </div>
              <div className="flex items-center gap-2">
                <button className="btn size-9 p-0" onClick={() => setValue(Math.max(0, value - 1))} aria-label="Less">
                  −
                </button>
                <span className="w-8 text-center font-display text-2xl tabular-nums">{value}</span>
                <button className="btn size-9 p-0" onClick={() => setValue(value + 1)} aria-label="More">
                  +
                </button>
              </div>
            </div>
            {source !== 'drain' && source !== 'fading' && (
              <div>
                <div className="mb-1 text-xs text-muted">Type</div>
                <div className="flex gap-1.5">
                  {(['P', 'S'] as const).map((t) => (
                    <button
                      key={t}
                      className={`chip cursor-pointer ${type === t ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                      onClick={() => setType(t)}
                    >
                      {t === 'P' ? 'Physical' : 'Stun'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {source !== 'direct' && (
            <div className="rounded-lg border border-line bg-bg/40 p-3">
              {roll ? (
                <>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {roll.dice.map((d, i) => (
                      <DieFace key={i} value={d} className="size-7" />
                    ))}
                  </div>
                  <div>
                    {label}: <strong className="text-accent">{roll.hits}</strong> {roll.hits === 1 ? 'hit' : 'hits'}
                  </div>
                </>
              ) : (
                <button className="btn btn-primary w-full" onClick={doRoll}>
                  Roll {label.toLowerCase()} ({resistPool} {resistPool === 1 ? 'die' : 'dice'})
                </button>
              )}
              <p className="mt-2 text-xs text-muted">
                {source === 'attack'
                  ? `Wound modifiers don't apply to soaking. Physical uses Body${derived.pools.physicalDamageResistance !== derived.pools.damageResistance ? ' plus bonuses like bone lacing' : ''}.`
                  : source === 'drain'
                    ? `Willpower + your tradition's attribute. Drain is Stun, but Physical if more than your Magic (${derived.attributes.magic}).`
                    : `Willpower + Logic. Fading is Stun, but Physical if more than your Resonance (${derived.attributes.resonance}).`}
              </p>
            </div>
          )}

          {resisted && (
            <p className="text-base">
              {boxes === 0 ? (
                <span className="text-accent">No damage. Fully resisted.</span>
              ) : (
                <>
                  Take <strong className="text-danger">{boxes}</strong> {boxes === 1 ? 'box' : 'boxes'} of{' '}
                  {finalType === 'P' ? 'Physical' : 'Stun'} damage.
                </>
              )}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!resisted}
            onClick={() => {
              update((c) => applyDamage(c, boxes, finalType))
              onClose()
            }}
          >
            {boxes === 0 ? 'Done' : 'Apply damage'}
          </button>
        </div>
      </div>
    </div>
  )
}
