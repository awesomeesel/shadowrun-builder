import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Character } from '../../../model/character'
import { computeDerived } from '../../../rules/sr6/derived'
import { ammoCapacity } from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'

interface Check {
  status: 'ok' | 'warn' | 'info'
  text: ReactNode
  /** A one-tap fix, e.g. "Heal" or "Reload all". */
  fix?: { label: string; apply: (c: Character) => Character }
}

/** What to sort out before a run: injuries, ammo, armor, programs, lifestyle and karma to spend. */
function readyChecks(character: Character): Check[] {
  const d = computeDerived(character)
  const checks: Check[] = []
  const { physical, stun, overflow } = character.damage

  if (physical || stun || overflow) {
    const parts = [
      physical && `${physical} Physical`,
      stun && `${stun} Stun`,
      overflow && `${overflow} Overflow`,
    ].filter(Boolean)
    checks.push({
      status: 'warn',
      text: `Still hurt: ${parts.join(', ')} damage. Heal it if there was downtime since the last run.`,
      fix: { label: 'Heal all', apply: (c) => ({ ...c, damage: { ...c.damage, physical: 0, stun: 0, overflow: 0 } }) },
    })
  } else {
    checks.push({ status: 'ok', text: 'No injuries.' })
  }

  checks.push({ status: 'info', text: `Edge refills to ${d.attributes.edge} when the session starts.` })

  const partly = character.weapons.filter((w) => {
    const capacity = ammoCapacity(w)
    return capacity > 0 && (character.play.ammo[w.id] ?? capacity) < capacity
  })
  if (partly.length) {
    checks.push({
      status: 'warn',
      text: `Not fully loaded: ${partly.map((w) => w.name || 'weapon').join(', ')}.`,
      fix: {
        label: 'Reload all',
        apply: (c) => ({
          ...c,
          play: {
            ...c.play,
            ammo: Object.fromEntries(c.weapons.map((w) => [w.id, ammoCapacity(w)]).filter(([, n]) => n)),
          },
        }),
      },
    })
  } else if (character.weapons.some((w) => ammoCapacity(w) > 0)) {
    checks.push({ status: 'ok', text: 'All weapons loaded.' })
  }

  const armor = character.gear.filter((g) => g.armor > 0)
  const worn = armor.filter((g) => g.equipped)
  if (worn.length) {
    checks.push({
      status: 'ok',
      text: `Wearing ${worn.map((g) => g.name).join(', ')}: Defense Rating ${d.defenseRating}.`,
    })
  } else if (armor.length) {
    checks.push({
      status: 'warn',
      text: `No armor worn. You own ${armor.map((g) => g.name).join(', ')}; tick "Worn" on the Edit tab.`,
    })
  }

  if (d.matrix) {
    for (const warning of d.matrix.warnings) checks.push({ status: 'warn', text: warning })
    if (d.matrix.device && character.programs.length > 0) {
      checks.push({
        status: d.matrix.runningPrograms.length ? 'ok' : 'warn',
        text: `Programs running: ${d.matrix.runningPrograms.map((p) => p.name).join(', ') || 'none'} (${d.matrix.runningPrograms.length}/${d.matrix.programSlots} slots).`,
      })
    }
    if (character.play.matrixDamage) {
      checks.push({
        status: 'warn',
        text: `Your device has ${character.play.matrixDamage} boxes of Matrix damage.`,
        fix: { label: 'Repair', apply: (c) => ({ ...c, play: { ...c.play, matrixDamage: 0 } }) },
      })
    }
  }

  const { sustained, companions } = character.play
  if (sustained.length) {
    checks.push({
      status: 'info',
      text: `Still sustaining ${sustained.map((x) => x.name).join(', ')} (−${sustained.length * 2} dice on action tests).`,
      fix: { label: 'Drop all', apply: (c) => ({ ...c, play: { ...c.play, sustained: [] } }) },
    })
  }
  const fleeting = companions.filter((x) => !x.bound)
  if (fleeting.length) {
    checks.push({
      status: 'warn',
      text: `Unbound spirits and unregistered sprites leave after a day: ${fleeting.length} still listed.`,
      fix: {
        label: 'Send them home',
        apply: (c) => ({ ...c, play: { ...c.play, companions: c.play.companions.filter((x) => x.bound) } }),
      },
    })
  }
  for (const v of character.vehicles) {
    const damage = character.play.vehicleDamage[v.id] ?? 0
    if (damage) {
      checks.push({
        status: 'warn',
        text: `${v.name || 'A vehicle'} has ${damage} boxes of damage.`,
        fix: {
          label: 'Repaired',
          apply: (c) => ({ ...c, play: { ...c.play, vehicleDamage: { ...c.play.vehicleDamage, [v.id]: 0 } } }),
        },
      })
    }
  }

  if (character.lifestyles.length === 0) {
    checks.push({ status: 'info', text: 'No lifestyle recorded. Where does your runner sleep?' })
  } else if (character.lifestyles.every((l) => l.monthsPaid <= 0)) {
    checks.push({ status: 'warn', text: 'Rent is due: no lifestyle has months paid.' })
  }

  if (character.karma.available >= 5) {
    checks.push({ status: 'info', text: `${character.karma.available} karma to spend.` })
  }
  return checks
}

export function ReadyCheck({ character, update }: { character: Character; update: Update }) {
  const checks = readyChecks(character)
  const icon = {
    ok: <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" />,
    warn: <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" />,
    info: <Info className="mt-0.5 size-4 shrink-0 text-muted" />,
  }
  return (
    <ul className="grid gap-1.5 text-sm">
      {checks.map((check, i) => (
        <li key={i} className="flex items-start gap-2">
          {icon[check.status]}
          <span className="min-w-0 flex-1">{check.text}</span>
          {check.fix && (
            <button className="btn shrink-0 px-2 py-0.5 text-xs" onClick={() => update(check.fix!.apply)}>
              {check.fix.label}
            </button>
          )}
        </li>
      ))}
      <li className="mt-1 text-xs text-muted">
        Changed gear or spent karma since last time? Update it on the{' '}
        <Link to="../edit" relative="path" className="text-accent hover:underline">
          Edit tab
        </Link>{' '}
        first.
      </li>
    </ul>
  )
}
