import { HeartPulse } from 'lucide-react'
import { useState } from 'react'
import type { Character } from '../../../model/character'
import { computeDerived } from '../../../rules/sr6/derived'
import {
  MEDICAL_CARE_BONUS,
  NO_KIT_PENALTY,
  TREATMENTS,
  heal,
  rest,
  spendHealing,
  treatmentPool,
  treatmentThreshold,
  type Damage,
  type RestResult,
  type Treatment,
} from '../../../rules/sr6/healing'
import { recordRoll, rollPool, type Roll } from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'
import { Counter, PlayDialog, RollStep } from './RollStep'

type Method = Treatment | 'rest'

const describe = (d: Damage) =>
  [d.overflow && `${d.overflow} Overflow`, d.physical && `${d.physical} Physical`, d.stun && `${d.stun} Stun`]
    .filter(Boolean)
    .join(', ') || 'nothing'

/** Heal step by step: first aid, a medkit, healing magic, or rest (pp. 119–121). */
export function HealDialog({
  character,
  update,
  onClose,
  initial = 'firstAid',
}: {
  character: Character
  update: Update
  onClose: () => void
  initial?: Method
}) {
  const derived = computeDerived(character)
  const [method, setMethod] = useState<Method>(initial)
  const [healer, setHealer] = useState<'me' | 'other'>('me')
  const [otherPool, setOtherPool] = useState(8)
  const [kit, setKit] = useState(true)
  const [prefer, setPrefer] = useState<'physical' | 'stun'>('physical')
  const [roll, setRoll] = useState<Roll | null>(null)
  const [restKind, setRestKind] = useState<'stun' | 'physical'>(character.damage.stun ? 'stun' : 'physical')
  const [periods, setPeriods] = useState(restKind === 'stun' ? 4 : 2)
  const [care, setCare] = useState(false)
  const [rested, setRested] = useState<RestResult | null>(null)

  const damage = character.damage
  const { threshold, freeHit } = treatmentThreshold(derived.essence)
  const own = method === 'rest' ? null : treatmentPool(character, method)
  const basePool = healer === 'me' ? (own ?? 0) : otherPool
  const pool = Math.max(0, basePool + (method === 'firstAid' && !kit ? NO_KIT_PENALTY : 0))
  const hits = roll ? roll.hits + (freeHit ? 1 : 0) : 0
  const extra = Math.max(0, hits - threshold)
  const healed: Damage | null =
    method === 'rest' ? (rested?.healed ?? null) : roll ? spendHealing(damage, extra, method, prefer) : null

  const reset = (m: Method) => {
    setMethod(m)
    setRoll(null)
    setRested(null)
  }

  return (
    <PlayDialog
      title="Heal"
      icon={<HeartPulse className="size-5 text-accent" />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!healed}
            onClick={() => {
              if (healed) update((c) => heal(c, healed))
              onClose()
            }}
          >
            {healed && describe(healed) !== 'nothing' ? `Heal ${describe(healed)}` : 'Done'}
          </button>
        </>
      }
    >
      <p>
        Injuries now: <strong>{describe(damage)}</strong>.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(['firstAid', 'medkit', 'magic', 'rest'] as const).map((m) => (
          <button
            key={m}
            className={`chip cursor-pointer ${method === m ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
            onClick={() => reset(m)}
          >
            {m === 'rest' ? 'Rest' : TREATMENTS[m].name}
          </button>
        ))}
      </div>

      {method !== 'rest' ? (
        <>
          <p className="text-xs text-muted">
            {TREATMENTS[method].test}, {TREATMENTS[method].window}, against a threshold of 5 − Essence ={' '}
            <strong className="text-fg">{threshold}</strong>
            {freeHit && ' (fully natural: +1 free hit)'}. Each hit above it heals{' '}
            {method === 'firstAid' ? '1 Stun box, or 1 Physical/Overflow box per 2 hits' : '1 box of any kind'}. Works
            once per set of injuries, and can't heal drain.
          </p>
          {!roll && (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={`chip cursor-pointer ${healer === 'me' ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                  onClick={() => setHealer('me')}
                >
                  I do it{own !== null ? ` (${own} dice)` : ''}
                </button>
                <button
                  className={`chip cursor-pointer ${healer === 'other' ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                  onClick={() => setHealer('other')}
                >
                  A teammate does it
                </button>
              </div>
              {healer === 'me' && own === null && (
                <p className="text-amber">
                  You don't have {method === 'magic' ? 'Sorcery' : 'Biotech'}. Pick “A teammate does it”.
                </p>
              )}
              {healer === 'other' && (
                <Counter label="Their dice pool" value={otherPool} min={0} max={40} onChange={setOtherPool} />
              )}
              {method === 'firstAid' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={kit}
                    onChange={(e) => setKit(e.target.checked)}
                  />
                  Using a first aid kit (without one: −2 dice, no Edge)
                </label>
              )}
            </div>
          )}
          <RollStep
            label={TREATMENTS[method].name}
            pool={pool}
            roll={roll}
            disabled={pool === 0}
            onRoll={() => {
              const r = rollPool(pool)
              setRoll(r)
              update((c) => recordRoll(c, TREATMENTS[method].name, r))
            }}
          >
            {roll && (
              <>
                {hits} {hits === 1 ? 'hit' : 'hits'}
                {freeHit ? ' (with the free hit)' : ''} against threshold {threshold}:{' '}
                <strong className="text-fg">{extra}</strong> to spend.
              </>
            )}
          </RollStep>
          {roll && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Overflow first, then</span>
              {(['physical', 'stun'] as const).map((p) => (
                <button
                  key={p}
                  className={`chip cursor-pointer ${prefer === p ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                  onClick={() => setPrefer(p)}
                >
                  {p === 'physical' ? 'Physical' : 'Stun'}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            Resting means no strenuous activity. Stun: Body + Willpower once per hour. Physical: Body + Body once per
            day, Overflow first. Each hit heals a box; wound modifiers don't apply (except while Overflow remains).
          </p>
          {!rested && (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(['stun', 'physical'] as const).map((k) => (
                  <button
                    key={k}
                    className={`chip cursor-pointer ${restKind === k ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                    onClick={() => {
                      setRestKind(k)
                      setPeriods(k === 'stun' ? 4 : 2)
                    }}
                  >
                    {k === 'stun' ? 'Stun (hours)' : 'Physical (days)'}
                  </button>
                ))}
              </div>
              <Counter
                label={restKind === 'stun' ? 'Hours of rest' : 'Days of rest'}
                value={periods}
                min={1}
                max={restKind === 'stun' ? 24 : 30}
                onChange={setPeriods}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={care}
                  onChange={(e) => setCare(e.target.checked)}
                />
                Someone with Biotech watches over me (+{MEDICAL_CARE_BONUS} dice)
              </label>
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  const result = rest(character, restKind, periods, care)
                  setRested(result)
                  update((c) =>
                    result.rolls.reduce(
                      (acc, r, i) => recordRoll(acc, `Rest (${restKind === 'stun' ? 'hour' : 'day'} ${i + 1})`, r),
                      c,
                    ),
                  )
                }}
              >
                Rest and roll
              </button>
            </div>
          )}
          {rested && (
            <div className="rounded-lg border border-line bg-bg/40 p-3">
              <ul className="grid gap-0.5 text-xs text-muted">
                {rested.rolls.map((r, i) => (
                  <li key={i}>
                    {restKind === 'stun' ? 'Hour' : 'Day'} {i + 1}: {r.hits} {r.hits === 1 ? 'hit' : 'hits'}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                After {rested.periods} {restKind === 'stun' ? 'hour' : 'day'}
                {rested.periods === 1 ? '' : 's'}: heals{' '}
                <strong className="text-accent">{describe(rested.healed)}</strong>.
              </p>
            </div>
          )}
        </>
      )}

      {healed && method !== 'rest' && (
        <p className="text-base">
          Heals <strong className="text-accent">{describe(healed)}</strong>.
        </p>
      )}
    </PlayDialog>
  )
}
