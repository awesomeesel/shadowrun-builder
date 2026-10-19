import { Minus, Package, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { noAutofillField } from '../../../components/noAutofill'
import { NumberInput } from '../../../components/ui'
import type { Character, Weapon } from '../../../model/character'
import {
  addSpares,
  ammoPrice,
  AMMO_BY_ID,
  AMMO_TYPES,
  loadedType,
  pricePer10,
  reload,
  spareRounds,
  stopCounting,
} from '../../../rules/sr6/ammo'
import { addLedgerEntry } from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'

/** Ammo for one weapon: what's loaded, spare rounds by type, and buying more. */
export function AmmoDialog({
  character,
  weapon,
  capacity,
  update,
  onClose,
}: {
  character: Character
  weapon: Weapon
  capacity: number
  update: Update
  onClose: () => void
}) {
  const loaded = loadedType(character, weapon)
  const rounds = character.play.ammo[weapon.id] ?? capacity
  const spares = spareRounds(character, weapon)
  const counting = spares !== undefined
  const [buyType, setBuyType] = useState(loaded.id)
  const [buyRounds, setBuyRounds] = useState(Math.max(10, Math.ceil((capacity * 2) / 10) * 10))
  const [pay, setPay] = useState(true)
  const type = AMMO_BY_ID.get(buyType) ?? AMMO_TYPES[0]
  const price = ammoPrice(weapon, type, buyRounds)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const buy = () =>
    update((c) => {
      const stocked = addSpares(c, weapon.id, type.id, buyRounds)
      return pay
        ? addLedgerEntry(stocked, { nuyen: -price, note: `${buyRounds} ${type.name} rounds for ${weapon.name}` })
        : stocked
    })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 text-sm sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Ammo for ${weapon.name}`}
      >
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto font-display text-xl">Ammo · {weapon.name || 'Weapon'}</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-1 text-xs text-muted">
          Loaded: {rounds}/{capacity} {loaded.name}. Pick a type to reload with it
          {counting ? '; rounds left in the magazine go back with the spares.' : '.'}
        </div>
        <ul className="mb-4 grid gap-1.5">
          {AMMO_TYPES.map((t) => {
            const spare = spares?.[t.id] ?? 0
            const isLoaded = t.id === loaded.id
            return (
              <li
                key={t.id}
                className={`flex items-center gap-2 rounded-lg border p-2 ${isLoaded ? 'border-accent/60 bg-accent/5' : 'border-line'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {t.name}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {[
                        t.attackRating && `AR ${t.attackRating > 0 ? '+' : ''}${t.attackRating}`,
                        t.damage && `DV ${t.damage > 0 ? '+' : ''}${t.damage}`,
                        t.stun && 'Stun',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="text-xs text-muted">{t.note}</div>
                </div>
                {counting && (
                  <span className="flex items-center gap-1">
                    <button
                      className="btn size-7 p-0"
                      onClick={() => update((c) => addSpares(c, weapon.id, t.id, -10))}
                      disabled={spare === 0}
                      aria-label={`10 fewer ${t.name}`}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-9 text-center tabular-nums">{spare}</span>
                    <button
                      className="btn size-7 p-0"
                      onClick={() => update((c) => addSpares(c, weapon.id, t.id, 10))}
                      aria-label={`10 more ${t.name}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </span>
                )}
                <button
                  className="btn px-2 py-1 text-xs"
                  disabled={counting && spare === 0 && !(isLoaded && rounds > 0)}
                  onClick={() => update((c) => reload(c, weapon, capacity, t.id))}
                  title={isLoaded ? 'Top up the magazine' : `Eject and load ${t.name}`}
                >
                  {isLoaded ? 'Reload' : 'Load'}
                </button>
              </li>
            )
          })}
        </ul>

        <label className="mb-4 flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-accent"
            checked={counting}
            onChange={(e) =>
              update((c) => (e.target.checked ? addSpares(c, weapon.id, loaded.id, 0) : stopCounting(c, weapon.id)))
            }
          />
          <span>
            Count spare rounds
            <span className="block text-xs text-muted">
              Reloading then uses up what you carry. Off: reloads are free, as before.
            </span>
          </span>
        </label>

        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Package className="size-4 text-accent" /> Buy rounds
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <div className="mb-1 text-xs text-muted">Type</div>
              <select
                {...noAutofillField}
                className="input py-1.5"
                value={buyType}
                onChange={(e) => setBuyType(e.target.value)}
              >
                {AMMO_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-24">
              <div className="mb-1 text-xs text-muted">Rounds</div>
              <NumberInput value={buyRounds} min={1} onChange={setBuyRounds} />
            </label>
            <div className="text-xs text-muted">
              {pricePer10(weapon)}¥ per 10{type.cost !== 1 && ` × ${type.cost}`}
              <div className="text-base font-semibold text-fg">{price.toLocaleString()}¥</div>
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={pay}
              onChange={(e) => setPay(e.target.checked)}
            />
            Pay for it (off: found or already owned)
          </label>
          <button
            className="btn btn-primary mt-3"
            onClick={buy}
            disabled={buyRounds < 1 || (pay && price > character.nuyen)}
            title={pay && price > character.nuyen ? 'Not enough nuyen' : undefined}
          >
            {pay ? `Buy for ${price.toLocaleString()}¥` : `Add ${buyRounds} rounds`}
          </button>
          {pay && <span className="ml-3 text-xs text-muted">You have {character.nuyen.toLocaleString()}¥</span>}
          {!counting && (
            <p className="mt-2 text-xs text-muted">Buying or adding rounds starts counting spare rounds.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
