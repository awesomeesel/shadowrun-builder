import { Flame, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { SourceLink } from '../../../components/SourceLink'
import { Section } from '../../../components/ui'
import { SustainedSpellSchema, type Character, type Spell } from '../../../model/character'
import { computeDerived } from '../../../rules/sr6/derived'
import {
  applyDamage,
  drainType,
  recordRoll,
  rollPool,
  spellDrain,
  sustainPenalty,
  type Roll,
} from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'
import { CenteringToggle, Counter, PlayDialog, RollStep } from './RollStep'

/** Duration S (sustained) or L (limited) can be kept running. */
const canSustain = (spell: Spell) => /\b[SL]\b|sustain|limited/i.test(spell.duration)
const isArea = (spell: Spell) => /\(A\)|area/i.test(`${spell.range} ${spell.notes}`)

/** The caster's spells with a Cast button each, and the spells being sustained right now. */
export function SpellsSection({ character, update }: { character: Character; update: Update }) {
  const [casting, setCasting] = useState<Spell | null>(null)
  const sustained = character.play.sustained
  const drop = (id: string) =>
    update((c) => ({ ...c, play: { ...c.play, sustained: c.play.sustained.filter((s) => s.id !== id) } }))

  return (
    <Section title="Spells" icon={<Flame className="size-4" />}>
      {sustained.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber/40 bg-amber/5 p-2.5 text-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-amber">
            <Sparkles className="size-3.5" /> Sustaining {sustained.length}: −{-sustainPenalty(character)} dice on
            action tests
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {sustained.map((s) => (
              <li key={s.id} className="chip border-amber/40">
                {s.name}
                <span className="text-muted">· {s.hits} hits</span>
                <button
                  className="ml-1 text-muted hover:text-danger"
                  onClick={() => drop(s.id)}
                  aria-label={`Drop ${s.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {character.spells.length === 0 ? (
        <p className="text-sm text-muted">No spells. Add them on the Edit tab.</p>
      ) : (
        <ul className="grid gap-1.5">
          {character.spells.map((spell) => (
            <li
              key={spell.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {spell.name || 'Unnamed spell'}
                  {spell.source && <SourceLink source={spell.source} className="ml-2" />}
                </div>
                <div className="truncate text-xs text-muted">
                  {[spell.category, spell.range, spell.duration, spell.drain && `Drain ${spell.drain}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button className="btn px-2.5 py-1 text-xs" onClick={() => setCasting(spell)}>
                Cast
              </button>
            </li>
          ))}
        </ul>
      )}
      {casting && <CastDialog character={character} update={update} spell={casting} onClose={() => setCasting(null)} />}
    </Section>
  )
}

/** Casting step by step: adjust the spell, roll Sorcery + Magic, then resist drain (p. 131). */
function CastDialog({
  character,
  update,
  spell,
  onClose,
}: {
  character: Character
  update: Update
  spell: Spell
  onClose: () => void
}) {
  const derived = computeDerived(character)
  const magic = derived.magic
  const [ampUp, setAmpUp] = useState(0)
  const [area, setArea] = useState(0)
  const [cast, setCast] = useState<Roll | null>(null)
  const [drain, setDrain] = useState<Roll | null>(null)
  const [sustain, setSustain] = useState(canSustain(spell))

  const combat = spell.category === 'combat'
  const drainValue = spellDrain(spell.drain, ampUp, area)
  const penalty = derived.woundModifier + sustainPenalty(character)
  const castPool = Math.max(0, (magic?.spellcasting ?? 0) + penalty)
  const [centering, setCentering] = useState(false)
  const drainPool = Math.max(
    0,
    (magic?.drainResistance ?? 0) + derived.woundModifier + (centering ? (magic?.centeringDice ?? 0) : 0),
  )
  const boxes = drain ? Math.max(0, drainValue - drain.hits) : 0
  const type = drainType(boxes, derived.attributes.magic)
  const damage = spell.notes.match(/Damage\s+([PS])/i)?.[1]?.toUpperCase()

  const roll = (label: string, pool: number, set: (r: Roll) => void) => {
    const result = rollPool(pool)
    set(result)
    update((c) => recordRoll(c, label, result))
  }

  return (
    <PlayDialog
      title={`Cast ${spell.name || 'spell'}`}
      icon={<Flame className="size-5 text-accent" />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!cast || !drain}
            onClick={() => {
              update((c) => {
                let next = applyDamage(c, boxes, type)
                if (sustain && cast && cast.hits > 0) {
                  const kept = SustainedSpellSchema.parse({ name: spell.name, hits: cast.hits })
                  next = { ...next, play: { ...next.play, sustained: [...next.play.sustained, kept] } }
                }
                return next
              })
              onClose()
            }}
          >
            {boxes ? `Take ${boxes} ${type === 'P' ? 'Physical' : 'Stun'} and finish` : 'Finish'}
          </button>
        </>
      }
    >
      {!magic?.spellcasting && <p className="text-amber">You have no Sorcery skill, so you can't cast spells.</p>}
      {(combat || isArea(spell)) && !cast && (
        <div className="flex flex-wrap gap-5">
          {combat && <Counter label="Amp Up (+1 damage, +2 drain)" value={ampUp} onChange={setAmpUp} />}
          {isArea(spell) && <Counter label="Bigger area (+2 m, +1 drain)" value={area} onChange={setArea} />}
        </div>
      )}
      <p className="text-muted">
        Drain Value <strong className="text-fg">{drainValue}</strong>
        {(ampUp > 0 || area > 0) && ` (${spell.drain || 0} + adjustments)`}
        {penalty < 0 && ` · −${-penalty} dice from wounds and sustained spells (included)`}
      </p>

      <RollStep
        label="Spellcasting"
        pool={castPool}
        roll={cast}
        disabled={!magic?.spellcasting}
        onRoll={() => roll(`Cast ${spell.name}`, castPool, setCast)}
      >
        Sorcery + Magic. The target rolls to defend; your net hits count.
        {combat &&
          ` Damage: net hits${ampUp ? ` + ${ampUp} Amp Up` : ''}${damage ? ` (${damage})` : ''}; indirect spells (like Fireball) add ⌈Magic / 2⌉ = ${Math.ceil(derived.attributes.magic / 2)}, and the target soaks with Body.`}
      </RollStep>

      {cast && (
        <>
          {!drain && <CenteringToggle dice={magic?.centeringDice ?? 0} checked={centering} onChange={setCentering} />}
          <RollStep
            label="Drain resistance"
            pool={drainPool}
            roll={drain}
            onRoll={() => roll('Drain resistance', drainPool, setDrain)}
          >
            Willpower + your tradition's attribute against Drain {drainValue}. Drain above your Magic (
            {derived.attributes.magic}) is Physical.
          </RollStep>
        </>
      )}

      {drain && (
        <p className="text-base">
          {boxes === 0 ? (
            <span className="text-accent">No drain. Fully resisted.</span>
          ) : (
            <>
              Take <strong className="text-danger">{boxes}</strong> {boxes === 1 ? 'box' : 'boxes'} of{' '}
              {type === 'P' ? 'Physical' : 'Stun'} drain.
            </>
          )}
        </p>
      )}

      {canSustain(spell) && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={sustain}
            onChange={(e) => setSustain(e.target.checked)}
          />
          Keep sustaining it (−2 dice on action tests while it runs)
        </label>
      )}
    </PlayDialog>
  )
}
