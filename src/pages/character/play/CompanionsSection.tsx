import { Ghost, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MonitorTrack } from '../../../components/sheetParts'
import { Section } from '../../../components/ui'
import { CompanionSchema, type Character, type Companion } from '../../../model/character'
import {
  SPIRIT_TYPES,
  SPRITE_TYPES,
  callForth,
  spiritForceLimit,
  spiritStats,
  spriteStats,
  type CallResult,
  type SpiritTypeId,
  type SpriteTypeId,
} from '../../../rules/sr6/companions'
import { computeDerived } from '../../../rules/sr6/derived'
import { formatInitiative } from '../../../rules/sr6/format'
import { applyDamage, drainType, recordRoll, rollPool, sustainPenalty, type Roll } from '../../../rules/sr6/play'
import type { Update } from '../CharacterPage'
import { Counter, PlayDialog, RollStep } from './RollStep'
import type { QuickPool } from './types'

type Kind = Companion['kind']

/** Spirits a magician has summoned, or sprites a technomancer has compiled, with their stats and services. */
export function CompanionsSection({
  character,
  update,
  kind,
  onRoll,
}: {
  character: Character
  update: Update
  kind: Kind
  onRoll: (quick: QuickPool) => void
}) {
  const [calling, setCalling] = useState(false)
  const list = character.play.companions.filter((c) => c.kind === kind)
  const spirit = kind === 'spirit'
  const change = (id: string, patch: Partial<Companion>) =>
    update((c) => ({
      ...c,
      play: { ...c.play, companions: c.play.companions.map((x) => (x.id === id ? { ...x, ...patch } : x)) },
    }))
  const remove = (id: string) =>
    update((c) => ({ ...c, play: { ...c.play, companions: c.play.companions.filter((x) => x.id !== id) } }))

  return (
    <Section title={spirit ? 'Spirits' : 'Sprites'} icon={<Ghost className="size-4" />}>
      {list.length === 0 && (
        <p className="mb-3 text-sm text-muted">
          {spirit
            ? 'No spirits right now. Summon one to scout, fight or help out.'
            : 'No sprites right now. Compile one to help in the Matrix.'}
        </p>
      )}
      <ul className="mb-3 grid gap-3">
        {list.map((companion) => (
          <CompanionCard
            key={companion.id}
            companion={companion}
            onChange={(patch) => change(companion.id, patch)}
            onRemove={() => remove(companion.id)}
            onRoll={onRoll}
          />
        ))}
      </ul>
      <button className="btn btn-primary w-full" onClick={() => setCalling(true)}>
        {spirit ? 'Summon a spirit…' : 'Compile a sprite…'}
      </button>
      {calling && <CallDialog character={character} update={update} kind={kind} onClose={() => setCalling(false)} />}
    </Section>
  )
}

function CompanionCard({
  companion: c,
  onChange,
  onRemove,
  onRoll,
}: {
  companion: Companion
  onChange: (patch: Partial<Companion>) => void
  onRemove: () => void
  onRoll: (quick: QuickPool) => void
}) {
  const spirit = c.kind === 'spirit'
  const spiritDef = spirit ? SPIRIT_TYPES[c.type as SpiritTypeId] : undefined
  const spriteDef = spirit ? undefined : SPRITE_TYPES[c.type as SpriteTypeId]
  if (!spiritDef && !spriteDef) return null
  const name = `${(spiritDef ?? spriteDef)!.name} ${spirit ? 'spirit' : 'sprite'}`
  const rating = `${spirit ? 'Force' : 'Level'} ${c.force}`
  const s = spirit ? spiritStats(c.type as SpiritTypeId, c.force) : undefined
  const m = spirit ? undefined : spriteStats(c.type as SpriteTypeId, c.force)
  const monitor = s?.monitor ?? m!.monitor
  const skills = s?.skills ?? m!.skills
  const initiative = s?.initiative ?? m!.initiative

  return (
    <li className="rounded-lg border border-line bg-bg/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{name}</span>
        <span className="text-muted">{rating}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            className="size-3.5 accent-accent"
            checked={c.bound}
            onChange={(e) => onChange({ bound: e.target.checked })}
          />
          {spirit ? 'Bound' : 'Registered'}
        </label>
        <button className="ml-auto text-muted hover:text-danger" onClick={onRemove} aria-label={`Dismiss ${name}`}>
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted">{spirit ? 'Services' : 'Tasks'} left</span>
        <button
          className="btn size-7 p-0"
          onClick={() => onChange({ services: Math.max(0, c.services - 1) })}
          aria-label="Use one"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center font-display text-lg tabular-nums">{c.services}</span>
        <button className="btn size-7 p-0" onClick={() => onChange({ services: c.services + 1 })} aria-label="Add one">
          <Plus className="size-3.5" />
        </button>
        {c.services === 0 && <span className="text-xs text-amber">None left: it goes home after this.</span>}
      </div>

      <div className="mt-2 text-xs text-muted">
        Initiative {formatInitiative(initiative)}
        {s && ` · Astral ${formatInitiative(s.astralInitiative)} · Defense Rating ${s.defenseRating}`}
        {s &&
          ` · Body ${s.attributes.body}, Agility ${s.attributes.agility}, Reaction ${s.attributes.reaction}, Strength ${s.attributes.strength}`}
        {m && ` · Attack ${m.attack}, Sleaze ${m.sleaze}, Data Processing ${m.dataProcessing}, Firewall ${m.firewall}`}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <button
            key={skill.name}
            className="chip cursor-pointer hover:border-accent/60"
            onClick={() => onRoll({ label: `${name}: ${skill.name}`, pool: skill.pool, ignoreWounds: true })}
          >
            {skill.name} <span className="font-semibold text-accent">{skill.pool}</span>
          </button>
        ))}
        <button
          className="chip cursor-pointer hover:border-accent/60"
          onClick={() =>
            onRoll({ label: `${name}: initiative`, pool: initiative.dice, initiativeScore: initiative.score })
          }
        >
          Initiative
        </button>
      </div>

      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Powers{spiritDef ? ' and attacks' : ''}</summary>
        <p className="mt-1">{(spiritDef?.powers ?? spriteDef!.powers).join(', ')}</p>
        {spiritDef && (
          <>
            <p className="mt-1">Optional (pick per spirit): {spiritDef.optionalPowers.join(', ')}</p>
            <ul className="mt-1">
              {spiritDef.attacks.map((a) => (
                <li key={a}>
                  {a} <span className="text-muted">(F = {c.force})</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>

      <div className="mt-3">
        <MonitorTrack
          label="Damage"
          monitor={{ boxes: monitor, filled: c.damage }}
          showModifiers={false}
          onChange={(damage) => onChange({ damage })}
        />
        {c.damage >= monitor && (
          <p className="mt-1 text-xs text-danger">
            {spirit ? 'Disrupted: the spirit is sent home.' : 'Crashed: the sprite is gone.'}
          </p>
        )}
      </div>
    </li>
  )
}

/** Summon a spirit (Conjuring + Magic) or compile a sprite (Tasking + Resonance), then resist the drain or fading. */
function CallDialog({
  character,
  update,
  kind,
  onClose,
}: {
  character: Character
  update: Update
  kind: Kind
  onClose: () => void
}) {
  const derived = computeDerived(character)
  const spirit = kind === 'spirit'
  const power = spirit ? derived.attributes.magic : derived.attributes.resonance
  const types = Object.entries(spirit ? SPIRIT_TYPES : SPRITE_TYPES)
  const [type, setType] = useState(types[0][0])
  const [force, setForce] = useState(Math.max(1, power))
  const [result, setResult] = useState<CallResult | null>(null)
  const [resist, setResist] = useState<Roll | null>(null)

  const penalty = derived.woundModifier + sustainPenalty(character)
  const basePool = (spirit ? derived.magic?.summoning : derived.resonance?.tasking) ?? 0
  const pool = Math.max(0, basePool + penalty)
  const resistBase = spirit ? derived.magic?.drainResistance : derived.resonance?.compileFadingResistance
  const resistPool = Math.max(0, (resistBase ?? 0) + derived.woundModifier)
  const boxes = result && resist ? Math.max(0, result.drainValue - resist.hits) : 0
  const damageType = drainType(boxes, power)

  const active = character.play.companions.filter((c) => c.kind === kind)
  const usedForce = active.reduce((sum, c) => sum + c.force, 0)
  const limit = spiritForceLimit(derived.attributes.magic)
  const warning = spirit
    ? usedForce + force > limit
      ? `Your active spirits would total Force ${usedForce + force}; the most you can have is Magic × 3 = ${limit}.`
      : ''
    : active.some((c) => !c.bound)
      ? 'You can only have one unregistered sprite at a time.'
      : ''
  const skillName = spirit ? 'Conjuring' : 'Tasking'
  const thing = spirit ? 'spirit' : 'sprite'

  return (
    <PlayDialog
      title={spirit ? 'Summon a spirit' : 'Compile a sprite'}
      icon={<Ghost className="size-5 text-accent" />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!result || !resist}
            onClick={() => {
              update((c) => {
                let next = applyDamage(c, boxes, damageType)
                if (result && result.services > 0) {
                  const companion = CompanionSchema.parse({ kind, type, force, services: result.services })
                  next = { ...next, play: { ...next.play, companions: [...next.play.companions, companion] } }
                }
                return next
              })
              onClose()
            }}
          >
            {result?.services ? `Add ${thing}` : 'Done'}
          </button>
        </>
      }
    >
      {!basePool && <p className="text-amber">You need the {skillName} skill for this.</p>}
      {!result && (
        <div className="flex flex-wrap items-end gap-5">
          <label>
            <div className="mb-1 text-xs text-muted">Type</div>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {types.map(([id, def]) => (
                <option key={id} value={id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
          <Counter
            label={spirit ? 'Force' : 'Level'}
            value={force}
            min={1}
            max={spirit ? 12 : 12}
            onChange={setForce}
          />
        </div>
      )}
      {warning && <p className="text-amber">{warning}</p>}

      <RollStep
        label={spirit ? 'Summoning' : 'Compiling'}
        pool={pool}
        roll={result?.roll ?? null}
        disabled={!basePool}
        onRoll={() => {
          const r = callForth(pool, force)
          setResult(r)
          update((c) => recordRoll(c, `${spirit ? 'Summon' : 'Compile'} ${type} ${force}`, r.roll))
        }}
      >
        {skillName} + {spirit ? 'Magic' : 'Resonance'} against the {thing}'s {force * 2} dice.
        {result && (
          <>
            {' '}
            It rolled <strong className="text-fg">{result.resist.hits}</strong> hits.{' '}
            {result.services > 0 ? (
              <strong className="text-accent">
                {result.services}{' '}
                {spirit ? (result.services === 1 ? 'service' : 'services') : result.services === 1 ? 'task' : 'tasks'}.
              </strong>
            ) : (
              <strong className="text-danger">It didn't answer.</strong>
            )}
          </>
        )}
      </RollStep>

      {result && (
        <RollStep
          label={spirit ? 'Drain resistance' : 'Fading resistance'}
          pool={resistPool}
          roll={resist}
          onRoll={() => {
            const r = rollPool(resistPool)
            setResist(r)
            update((c) => recordRoll(c, spirit ? 'Drain resistance' : 'Fading resistance', r))
          }}
        >
          {spirit ? 'Willpower + your tradition attribute' : 'Willpower + Charisma'} against {result.drainValue} (the{' '}
          {thing}'s hits). Above your {spirit ? 'Magic' : 'Resonance'} ({power}) it's Physical.
        </RollStep>
      )}

      {resist && (
        <p className="text-base">
          {boxes === 0 ? (
            <span className="text-accent">No {spirit ? 'drain' : 'fading'}. Fully resisted.</span>
          ) : (
            <>
              Take <strong className="text-danger">{boxes}</strong> {boxes === 1 ? 'box' : 'boxes'} of{' '}
              {damageType === 'P' ? 'Physical' : 'Stun'} {spirit ? 'drain' : 'fading'}.
            </>
          )}
        </p>
      )}
    </PlayDialog>
  )
}
