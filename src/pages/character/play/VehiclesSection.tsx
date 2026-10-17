import { Car } from 'lucide-react'
import { MonitorTrack } from '../../../components/sheetParts'
import { Section } from '../../../components/ui'
import type { Character } from '../../../model/character'
import { formatInitiative } from '../../../rules/sr6/format'
import {
  controlRigRating,
  droneInitiative,
  handlingPenalty,
  vehicleMonitor,
  vehiclePools,
  vehicleRatings,
} from '../../../rules/sr6/vehicles'
import type { Update } from '../CharacterPage'
import type { QuickPool } from './types'

/** Vehicles and drones at the table: damage, handling, and the rolls for driving, shooting and dodging. */
export function VehiclesSection({
  character,
  update,
  onRoll,
}: {
  character: Character
  update: Update
  onRoll: (quick: QuickPool) => void
}) {
  const rig = controlRigRating(character)
  const setDamage = (id: string, damage: number) =>
    update((c) => ({ ...c, play: { ...c.play, vehicleDamage: { ...c.play.vehicleDamage, [id]: damage } } }))

  return (
    <Section title="Vehicles & drones" icon={<Car className="size-4" />}>
      <p className="mb-3 text-xs text-muted">
        {rig
          ? `Your control rig (rating ${rig}) adds ${rig} dice when you're jumped in. Jumped in, you use Intuition and Logic instead of physical attributes.`
          : 'Without a control rig you drive by hand or by remote with Piloting + Reaction.'}
      </p>
      <ul className="grid gap-3">
        {character.vehicles.map((v) => {
          const damage = character.play.vehicleDamage[v.id] ?? 0
          const monitor = vehicleMonitor(v)
          const penalty = handlingPenalty(damage)
          const ratings = vehicleRatings(character, v)
          const init = v.kind === 'drone' ? droneInitiative(character, v) : null
          return (
            <li key={v.id} className="rounded-lg border border-line bg-bg/40 p-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{v.name || 'Unnamed vehicle'}</span>
                <span className="text-xs text-muted">
                  {[
                    `Handling ${v.handling || '–'}${penalty ? ` (+${penalty} from damage)` : ''}`,
                    `Body ${v.body}`,
                    `Armor ${v.armor}`,
                    v.kind === 'drone' && `Pilot ${v.pilot}`,
                    `Sensor ${v.sensor}`,
                    `AR ${ratings.attack} / DR ${ratings.defense}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {v.kind === 'drone' && v.autosofts && <div className="text-xs text-muted">Autosofts: {v.autosofts}</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {vehiclePools(character, v).map((p) => (
                  <button
                    key={p.label}
                    className="chip cursor-pointer hover:border-accent/60"
                    title={p.formula}
                    // The drone's own rolls don't suffer the rigger's wounds.
                    onClick={() =>
                      onRoll({
                        label: `${v.name}: ${p.label}`,
                        pool: p.pool,
                        info: p.formula,
                        ignoreWounds: p.label.startsWith('Drone'),
                      })
                    }
                  >
                    {p.label} <span className="font-semibold text-accent">{p.pool}</span>
                  </button>
                ))}
                {init && (
                  <>
                    <button
                      className="chip cursor-pointer hover:border-accent/60"
                      onClick={() =>
                        onRoll({ label: `${v.name}: initiative`, pool: init.own.dice, initiativeScore: init.own.score })
                      }
                    >
                      Drone initiative <span className="text-accent">{formatInitiative(init.own)}</span>
                    </button>
                    {rig > 0 && (
                      <button
                        className="chip cursor-pointer hover:border-accent/60"
                        onClick={() =>
                          onRoll({
                            label: `${v.name}: jumped-in initiative`,
                            pool: init.jumped.dice,
                            initiativeScore: init.jumped.score,
                          })
                        }
                      >
                        Jumped in <span className="text-accent">{formatInitiative(init.jumped)}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="mt-3">
                <MonitorTrack
                  label="Damage"
                  monitor={{ boxes: monitor, filled: damage }}
                  showModifiers={false}
                  onChange={(n) => setDamage(v.id, n)}
                />
                {damage >= monitor && <p className="mt-1 text-xs text-danger">Broken down. It needs repairs.</p>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Every 3 boxes of damage make Handling 1 worse. Wound modifiers don't apply to the drone's own rolls.
      </p>
    </Section>
  )
}
