import { Swords } from 'lucide-react'
import { Section } from '../../../components/ui'
import type { Character, Combat } from '../../../model/character'
import { computeDerived } from '../../../rules/sr6/derived'
import { formatInitiative } from '../../../rules/sr6/format'
import { MAX_EDGE_GAIN_PER_ROUND, minorActions, nextRound } from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'
import type { QuickPool } from './types'

/** A fight in progress: initiative, the combat round, and Major/Minor actions left this round. */
export function CombatSection({
  character,
  update,
  onRoll,
}: {
  character: Character
  update: Update
  onRoll: (quick: QuickPool) => void
}) {
  const derived = computeDerived(character)
  const combat = character.play.combat
  const initiative: QuickPool = {
    label: 'Initiative',
    pool: derived.initiative.dice,
    initiativeScore: derived.initiative.score,
    startsCombat: true,
  }
  const setCombat = (change: Partial<Combat>) =>
    update((c) => ({ ...c, play: { ...c.play, combat: c.play.combat && { ...c.play.combat, ...change } } }))

  if (!combat) {
    return (
      <Section title="Combat" icon={<Swords className="size-4" />}>
        <p className="mb-3 text-sm text-muted">
          When a fight breaks out, roll initiative. The tracker then counts rounds and the actions you have left.
        </p>
        <button className="btn btn-primary w-full" onClick={() => onRoll(initiative)}>
          Roll initiative ({formatInitiative(derived.initiative)}) and start
        </button>
      </Section>
    )
  }

  const maxMinor = minorActions(derived.initiative.dice)
  const pips = (count: number, left: number, onSet: (left: number) => void, kind: string) => (
    <div className="flex gap-1.5">
      {Array.from({ length: count }, (_, i) => {
        const available = i < left
        return (
          <button
            key={i}
            aria-label={`${kind} action ${i + 1}: ${available ? 'available' : 'used'}`}
            onClick={() => onSet(available ? i : i + 1)}
            className={`size-7 rounded-md border transition-colors ${
              available ? 'border-accent bg-accent/25' : 'border-line bg-bg'
            }`}
          />
        )
      })}
    </div>
  )

  return (
    <Section title={`Combat · round ${combat.round}`} icon={<Swords className="size-4" />}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] text-muted">Initiative</div>
          <div className="flex items-center gap-1.5">
            <button
              className="btn size-7 p-0"
              onClick={() => setCombat({ initiative: combat.initiative - 1 })}
              aria-label="Lower initiative"
            >
              −
            </button>
            <span className="w-8 text-center font-display text-2xl text-accent tabular-nums">{combat.initiative}</span>
            <button
              className="btn size-7 p-0"
              onClick={() => setCombat({ initiative: combat.initiative + 1 })}
              aria-label="Raise initiative"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Major</div>
          {pips(1, combat.majorLeft, (majorLeft) => setCombat({ majorLeft }), 'Major')}
        </div>
        <div>
          <div className="text-[11px] text-muted">Minor</div>
          {pips(maxMinor, combat.minorLeft, (minorLeft) => setCombat({ minorLeft }), 'Minor')}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Tap a box to use an action. A Major action can be used as a Minor one, and 4 Minor actions make a Major one. You
        can gain at most {MAX_EDGE_GAIN_PER_ROUND} Edge per round
        {combat.edgeGained > 0 && ` (${combat.edgeGained} gained this round)`}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => update(nextRound)}>
          Next round
        </button>
        <button className="btn" onClick={() => onRoll(initiative)}>
          Reroll initiative
        </button>
        <button className="btn ml-auto" onClick={() => update((c) => ({ ...c, play: { ...c.play, combat: null } }))}>
          End combat
        </button>
      </div>
    </Section>
  )
}
