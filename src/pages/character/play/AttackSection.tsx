import { Crosshair, Package, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { NumberInput, Section } from '../../../components/ui'
import { WeaponSchema, type Character, type Weapon } from '../../../model/character'
import { damageWith, loadedType, reload, spareRounds } from '../../../rules/sr6/ammo'
import { computeDerived, weaponPool } from '../../../rules/sr6/derived'
import { formatPool } from '../../../rules/sr6/format'
import {
  ammoCapacity,
  edgeFromRatings,
  firingModes,
  parseDamage,
  shotWith,
  sustainPenalty,
  type FiringMode,
} from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'
import { AmmoDialog } from './AmmoDialog'
import type { QuickPool } from './types'

const RANGES = ['Close', 'Near', 'Medium', 'Far', 'Extreme'] as const

/** Weapons ready to use: pick a range and firing mode, roll the attack, and keep track of rounds. */
export function AttackSection({
  character,
  update,
  wounds,
  onRoll,
}: {
  character: Character
  update: Update
  wounds: number
  onRoll: (quick: QuickPool) => void
}) {
  const [range, setRange] = useState(1)
  const [targetDefense, setTargetDefense] = useState(0)
  const [ammoFor, setAmmoFor] = useState<Weapon | null>(null)
  const derived = computeDerived(character)
  // Sustained spells are −2 dice each on action tests, on top of wounds.
  const penalty = wounds + sustainPenalty(character)
  const unarmed = WeaponSchema.parse({ name: 'Unarmed', skillId: 'close-combat', specialization: 'Unarmed' })
  const unarmedPool = weaponPool(character, unarmed).pool

  const setAmmo = (weapon: Weapon, rounds: number) =>
    update((c) => ({
      ...c,
      play: { ...c.play, ammo: { ...c.play.ammo, [weapon.id]: Math.max(0, Math.min(ammoCapacity(weapon), rounds)) } },
    }))

  /** Attack Rating line, with who gains Edge against the target's Defense Rating. */
  const ratingText = (attackRating: number | null) => {
    if (attackRating === null) return `out of range at ${RANGES[range]}`
    const edge = targetDefense > 0 ? edgeFromRatings(attackRating, targetDefense) : null
    const versus = targetDefense > 0 ? ` vs DR ${targetDefense}` : ''
    const gain = edge === 'attacker' ? ': you gain 1 Edge' : edge === 'defender' ? ': the target gains 1 Edge' : ''
    return `AR ${attackRating}${versus}${gain}`
  }

  const attack = (weapon: Weapon, pool: number, attackRating: number | null, mode?: FiringMode) => {
    // Only guns with a magazine have ammo types.
    const ammo = ammoCapacity(weapon) > 0 ? loadedType(character, weapon) : null
    const printed = parseDamage(weapon.damage)
    const damage = printed && ammo ? damageWith(printed, ammo) : printed
    const extra = mode?.damage ?? 0
    const dv = damage ? `DV ${damage.value + extra}${damage.type} + net hits` : 'DV + net hits'
    const modeText = mode && mode.id !== 'SS' ? ` · ${mode.label}, ${mode.rounds} rounds` : ''
    const ammoText = ammo && ammo.id !== 'regular' ? ` · ${ammo.name}` : ''
    const rating = attackRating === null ? null : attackRating + (mode?.attackRating ?? 0)
    onRoll({ label: `${weapon.name || 'Weapon'}${modeText}${ammoText}`, pool, info: `${dv} · ${ratingText(rating)}` })
    if (mode) setAmmo(weapon, (character.play.ammo[weapon.id] ?? ammoCapacity(weapon)) - mode.rounds)
  }

  const weapons = character.weapons.flatMap((w) => {
    const pool = weaponPool(character, w).pool
    return pool === null ? [] : [{ weapon: w, pool }]
  })

  return (
    <Section title="Attack" icon={<Crosshair className="size-4" />}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1 text-[11px] text-muted">Range</div>
          <div className="flex flex-wrap gap-1">
            {RANGES.map((r, i) => (
              <button
                key={r}
                onClick={() => setRange(i)}
                className={`chip cursor-pointer ${i === range ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <label className="w-28">
          <span className="mb-1 block text-[11px] text-muted" title="The target's Defense Rating, if the GM tells you">
            Target's DR
          </span>
          <NumberInput value={targetDefense} min={0} onChange={setTargetDefense} />
        </label>
      </div>

      <ul className="grid gap-3">
        {weapons.map(({ weapon, pool }) => {
          const capacity = ammoCapacity(weapon)
          const loaded = character.play.ammo[weapon.id] ?? capacity
          const modes = capacity > 0 ? firingModes(weapon) : []
          const ammo = capacity > 0 ? loadedType(character, weapon) : null
          const printedRating = weapon.attackRatings[range] ?? null
          const attackRating = printedRating === null ? null : printedRating + (ammo?.attackRating ?? 0)
          const printed = parseDamage(weapon.damage)
          const damage = printed && ammo ? damageWith(printed, ammo) : printed
          const spares = spareRounds(character, weapon)
          const spareTotal = spares ? Object.values(spares).reduce((a, b) => a + b, 0) : null
          const canReload = spares === undefined || (spares[ammo?.id ?? 'regular'] ?? 0) > 0
          return (
            <li key={weapon.id} className="rounded-lg border border-line bg-bg/40 p-2.5 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{weapon.name || 'Weapon'}</span>
                <span className="text-xs text-muted">
                  {formatPool(pool, penalty)} dice · {damage ? `${damage.value}${damage.type}` : weapon.damage || '—'} ·{' '}
                  {ratingText(attackRating)}
                </span>
              </div>
              {capacity > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className={`h-full rounded-full ${loaded === 0 ? 'bg-danger' : 'bg-accent'}`}
                      style={{ width: `${(loaded / capacity) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 text-right tabular-nums">
                    {loaded}
                    <span className="text-xs text-muted">/{capacity}</span>
                  </span>
                  <button
                    className="btn px-2 py-1"
                    onClick={() => update((c) => reload(c, weapon, capacity))}
                    disabled={!canReload || loaded === capacity}
                    aria-label={`Reload ${weapon.name}`}
                    title={canReload ? 'Reload' : `No spare ${ammo?.name ?? ''} rounds`}
                  >
                    <RotateCcw className="size-4" />
                  </button>
                </div>
              )}
              {capacity > 0 && (
                <button
                  className="mt-1 flex items-center gap-1.5 text-xs text-muted hover:text-fg"
                  onClick={() => setAmmoFor(weapon)}
                  title="Change ammo type, count spare rounds, buy more"
                >
                  <Package className="size-3.5" />
                  <span className={ammo && ammo.id !== 'regular' ? 'text-accent' : ''}>{ammo?.name}</span>
                  {spareTotal !== null ? ` · ${spareTotal} spare` : ' · spare rounds not counted'}
                  <span className="underline">Ammo…</span>
                </button>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {modes.length > 0 ? (
                  modes.map((m) => {
                    const shot = shotWith(m, loaded)
                    return (
                      <button
                        key={m.id}
                        className="btn px-2.5 py-1 text-xs"
                        disabled={loaded === 0}
                        title={`${m.rounds} ${m.rounds === 1 ? 'round' : 'rounds'}${m.attackRating ? `, AR ${m.attackRating}` : ''}${m.damage ? `, DV +${m.damage}` : ''}`}
                        onClick={() => attack(weapon, pool, attackRating, shot)}
                      >
                        {m.label}
                        <span className="text-muted">· {shot.rounds}</span>
                      </button>
                    )
                  })
                ) : (
                  <button className="btn px-2.5 py-1 text-xs" onClick={() => attack(weapon, pool, attackRating)}>
                    Attack
                  </button>
                )}
                {capacity > 0 && (
                  <button
                    className="btn px-2.5 py-1 text-xs text-muted"
                    onClick={() => setAmmo(weapon, loaded - 1)}
                    disabled={loaded === 0}
                  >
                    −1 round
                  </button>
                )}
              </div>
              {capacity > 0 && loaded === 0 && (
                <p className="mt-1 text-xs text-danger">
                  {canReload
                    ? 'Empty. Reload first.'
                    : 'Empty, and no spare rounds of this type. Ammo… to load or buy.'}
                </p>
              )}
            </li>
          )
        })}
        {unarmedPool !== null && (
          <li className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg/40 p-2.5 text-sm">
            <span className="font-semibold">Unarmed</span>
            <span className="mr-auto text-xs text-muted">
              {formatPool(unarmedPool, penalty)} dice · {derived.unarmedDamage.value}
              {derived.unarmedDamage.type} · {ratingText(range === 0 ? derived.unarmedAttackRating : null)}
            </span>
            <button
              className="btn px-2.5 py-1 text-xs"
              onClick={() =>
                attack(
                  { ...unarmed, damage: `${derived.unarmedDamage.value}${derived.unarmedDamage.type}` },
                  unarmedPool,
                  range === 0 ? derived.unarmedAttackRating : null,
                )
              }
            >
              Attack
            </button>
          </li>
        )}
      </ul>
      {ammoFor && (
        <AmmoDialog
          character={character}
          weapon={ammoFor}
          capacity={ammoCapacity(ammoFor)}
          update={update}
          onClose={() => setAmmoFor(null)}
        />
      )}
      <p className="mt-3 text-xs text-muted">
        Damage is the DV plus your net hits; the target soaks some of it. Attack Rating 4 or more above the target's
        Defense Rating gives you 1 Edge (4 or more below gives it to them).
      </p>
    </Section>
  )
}
