import { Clock, Dices, Flag, HeartPulse, Minus, NotebookPen, Play, Plus, ShieldAlert, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { keepDriveSignedIn } from '../../cloud/cloud'
import { RollResult } from '../../components/Dice'
import { noAutofill, noAutofillField } from '../../components/noAutofill'
import { MonitorTrack, Stat } from '../../components/sheetParts'
import { Section } from '../../components/ui'
import { computeDerived, ownedSkillPools } from '../../rules/sr6/derived'
import { formatInitiative, formatPool } from '../../rules/sr6/format'
import {
  EDGE_BOOSTS,
  EDGE_POOL_BOOST_COST,
  MAX_EDGE_GAIN_PER_ROUND,
  boostRoll,
  recordRoll,
  rollPool,
  startCombat,
  startSession,
  sustainPenalty,
  type EdgeBoost,
  type Roll,
} from '../../rules/sr6/play'
import type { CharacterContext } from './CharacterPage'
import { AttackSection } from './play/AttackSection'
import { CombatSection } from './play/CombatSection'
import { CompanionsSection } from './play/CompanionsSection'
import { DamageDialog } from './play/DamageDialog'
import { EndSessionDialog } from './play/EndSessionDialog'
import { HealDialog } from './play/HealDialog'
import { MatrixPlay } from './play/MatrixPlay'
import { LedgerList, MoneySection } from './play/Money'
import { ReadyCheck } from './play/ReadyCheck'
import { SessionLog } from './play/SessionLog'
import { SpellsSection } from './play/SpellsSection'
import type { QuickPool } from './play/types'
import { VehiclesSection } from './play/VehiclesSection'
import { StatusList } from './play/StatusList'
import { EdgeActions } from './play/EdgeActions'
import { NewPlayerTips, QualityReminders } from './play/Guidance'
import { HelpButton } from '../../components/Help'
import { PLAY_HELP, SKILL_HELP } from '../../rules/sr6/help'

/** Edge can never be above 7 (p. 45). */
const MAX_EDGE = 7

/** The at-the-table view: damage, Edge, combat, attacks, dice and money, wrapped in a session. */
export function PlayTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  return character.play.session ? (
    <ActiveSession character={character} update={update} />
  ) : (
    <NoSession character={character} update={update} />
  )
}

function NoSession({ character, update }: CharacterContext) {
  const [title, setTitle] = useState(`Session ${character.sessions.length + 1}`)
  const [healing, setHealing] = useState(false)
  return (
    <div className="grid gap-4">
      <section className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-neon/15 blur-3xl" />
        <h2 className="font-display text-2xl">Ready for a run?</h2>
        <p className="mt-1 mb-4 max-w-xl text-sm text-muted">
          Start a session when you sit down to play. You get a play screen for damage, Edge, combat, attacks, dice and
          money. When you end the session, a summary goes into the log below.
        </p>
        <ReadyCheck character={character} update={update} onHeal={() => setHealing(true)} />
        {character.play.statuses.length > 0 && <StatusList character={character} update={update} />}
        <div className="mt-5 flex flex-wrap gap-2">
          <input
            {...noAutofill}
            className="input min-w-0 flex-1 py-2 sm:max-w-xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Session name"
          />
          <button
            className="btn btn-primary px-4 py-2"
            onClick={() => {
              keepDriveSignedIn()
              update((c) => startSession(c, title.trim()))
            }}
          >
            <Play className="size-4" /> Start session
          </button>
        </div>
      </section>
      <SessionLog character={character} update={update} />
      <LedgerList update={update} entries={character.ledger} title="All money & karma changes" />
      {healing && <HealDialog character={character} update={update} initial="rest" onClose={() => setHealing(false)} />}
    </div>
  )
}

function ActiveSession({ character, update }: CharacterContext) {
  const derived = computeDerived(character)
  const wounds = derived.woundModifier
  const session = character.play.session!
  const [roll, setRoll] = useState<{ quick: QuickPool; result: Roll; bonus?: number } | null>(null)
  const [ending, setEnding] = useState(false)
  const [hurt, setHurt] = useState(false)
  const [healing, setHealing] = useState(false)
  /** Dice added to (or taken from) the next test, e.g. for cover or a smartlink. */
  const [modifier, setModifier] = useState(0)
  /** The 4-Edge boost: add Edge to the next test and make 6s explode. */
  const [edgeDice, setEdgeDice] = useState(false)
  const edge = character.play.edge ?? derived.attributes.edge
  const combat = character.play.combat

  const setEdge = (value: number) =>
    update((c) => ({ ...c, play: { ...c.play, edge: Math.max(0, Math.min(MAX_EDGE, value)) } }))

  /** Roll, show the result and remember it for the session summary. */
  const doRoll = (quick: QuickPool) => {
    if (quick.initiativeScore !== undefined) {
      const result = rollPool(quick.pool)
      const total = quick.initiativeScore + result.dice.reduce((a, b) => a + b, 0)
      setRoll({ quick, result, bonus: quick.initiativeScore })
      update((c) => {
        const recorded = recordRoll(c, quick.label, result, total)
        if (!quick.startsCombat) return recorded
        return recorded.play.combat
          ? { ...recorded, play: { ...recorded.play, combat: { ...recorded.play.combat, initiative: total } } }
          : startCombat(recorded, total)
      })
      return
    }
    const boosted = edgeDice && edge >= EDGE_POOL_BOOST_COST
    // Wounds and sustained spells lower action tests, not resistance rolls.
    const base = quick.ignoreWounds ? quick.pool : formatPool(quick.pool, wounds + sustainPenalty(character))
    const pool = Math.max(0, base + modifier + (boosted ? derived.attributes.edge : 0))
    const result = rollPool(pool, undefined, { explode: boosted, edge: boosted ? EDGE_POOL_BOOST_COST : 0 })
    const label = [quick.label, modifier ? `${modifier > 0 ? '+' : ''}${modifier}` : '', boosted ? 'Edge' : '']
      .filter(Boolean)
      .join(' · ')
    setRoll({ quick: { ...quick, label }, result })
    setModifier(0)
    setEdgeDice(false)
    update((c) => {
      const recorded = recordRoll(c, label, result)
      if (!boosted) return recorded
      return { ...recorded, play: { ...recorded.play, edge: Math.max(0, edge - EDGE_POOL_BOOST_COST) } }
    })
  }

  const boost = (kind: EdgeBoost, die: number) => {
    if (!roll) return
    const result = boostRoll(roll.result, kind, die)
    if (result === roll.result) return
    setRoll({ ...roll, result })
    update((c) => {
      const recorded = recordRoll(c, roll.quick.label, result, null, true)
      return { ...recorded, play: { ...recorded.play, edge: Math.max(0, edge - EDGE_BOOSTS[kind].cost) } }
    })
  }

  const boostInitiative = () => {
    if (!roll || roll.bonus === undefined) return
    const bonus = roll.bonus + 3
    setRoll({ ...roll, bonus })
    const total = bonus + roll.result.dice.reduce((a, b) => a + b, 0)
    update((c) => {
      const recorded = recordRoll(c, roll.quick.label, roll.result, total, true)
      const fight = roll.quick.startsCombat && recorded.play.combat
      return {
        ...recorded,
        play: {
          ...recorded.play,
          edge: Math.max(0, edge - 1),
          combat: fight ? { ...fight, initiative: total } : recorded.play.combat,
        },
      }
    })
  }

  const gainEdge = () =>
    update((c) => ({
      ...c,
      play: {
        ...c.play,
        edge: Math.min(MAX_EDGE, (c.play.edge ?? edge) + 1),
        combat: c.play.combat && { ...c.play.combat, edgeGained: c.play.combat.edgeGained + 1 },
      },
    }))
  const edgeCapped = !!combat && combat.edgeGained >= MAX_EDGE_GAIN_PER_ROUND

  const pools: QuickPool[] = [
    { label: 'Defense', pool: derived.pools.defense, help: PLAY_HELP.defense },
    {
      label: 'Damage resistance',
      pool: derived.pools.damageResistance,
      ignoreWounds: true,
      help: PLAY_HELP.damageResistance,
    },
    ...(derived.pools.physicalDamageResistance !== derived.pools.damageResistance
      ? [
          {
            label: 'Resist Physical',
            pool: derived.pools.physicalDamageResistance,
            ignoreWounds: true,
            help: PLAY_HELP.damageResistance,
          },
        ]
      : []),
    // Each skill, and its specialization as its own pool so the +2 isn't forgotten.
    ...ownedSkillPools(character).flatMap((s) => {
      if (s.pool === null) return []
      const help = SKILL_HELP[s.skill.id]
      const spec = s.owned?.specialization.trim()
      return [
        { label: s.skill.name, pool: s.pool, help },
        ...(spec && s.specializationPool !== null
          ? [{ label: `↳ ${spec}`, pool: s.specializationPool, help: PLAY_HELP.specialization }]
          : []),
      ]
    }),
    ...(derived.magic?.spellcasting ? [{ label: 'Spellcasting', pool: derived.magic.spellcasting }] : []),
    ...(derived.resonance?.tasking ? [{ label: 'Tasking', pool: derived.resonance.tasking }] : []),
    { label: 'Composure', pool: derived.pools.composure, help: PLAY_HELP.composure },
    { label: 'Judge Intentions', pool: derived.pools.judgeIntentions, help: PLAY_HELP.judgeIntentions },
    { label: 'Memory', pool: derived.pools.memory, help: PLAY_HELP.memory },
    { label: 'Lift / Carry', pool: derived.pools.liftCarry, help: PLAY_HELP.liftCarry },
  ]

  const addTimestamp = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    update((c) => {
      const s = c.play.session
      if (!s) return c
      const notes = `${s.notes}${s.notes && !s.notes.endsWith('\n') ? '\n' : ''}[${time}] `
      return { ...c, play: { ...c.play, session: { ...s, notes } } }
    })
  }

  return (
    <div className="grid gap-4 pb-64 sm:pb-8 lg:grid-cols-2">
      <section className="card flex flex-wrap items-center gap-3 border-accent/30 p-3 lg:col-span-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <div className="mr-auto min-w-0">
          <div className="truncate font-display text-lg">{session.title || 'Session'}</div>
          <div className="text-xs text-muted">Started {new Date(session.startedAt).toLocaleString()}</div>
        </div>
        <button className="btn" onClick={() => setEnding(true)}>
          <Flag className="size-4" /> End session
        </button>
      </section>

      <NewPlayerTips />

      <Section title="Status" icon={<HeartPulse className="size-4" />}>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat
            label="Initiative"
            value={formatInitiative(derived.initiative)}
            help={<HelpButton entry={PLAY_HELP.initiative} />}
          />
          <Stat
            label="Defense Rating"
            value={derived.defenseRating}
            help={<HelpButton entry={PLAY_HELP.defenseRating} />}
          />
          <Stat
            label="Wounds"
            value={wounds === 0 ? '—' : wounds}
            tone={wounds < 0 ? 'danger' : undefined}
            help={<HelpButton entry={PLAY_HELP.wounds} />}
          />
        </div>
        <div className="grid gap-4">
          <MonitorTrack
            size="large"
            label="Physical"
            help={<HelpButton entry={PLAY_HELP.physical} />}
            monitor={derived.physicalMonitor}
            onChange={(n) => update((c) => ({ ...c, damage: { ...c.damage, physical: n } }))}
          />
          <MonitorTrack
            size="large"
            label="Stun"
            help={<HelpButton entry={PLAY_HELP.stun} />}
            monitor={derived.stunMonitor}
            onChange={(n) => update((c) => ({ ...c, damage: { ...c.damage, stun: n } }))}
          />
          {(derived.physicalMonitor.filled >= derived.physicalMonitor.boxes || derived.overflow.filled > 0) && (
            <MonitorTrack
              size="large"
              label="Overflow"
              monitor={derived.overflow}
              showModifiers={false}
              onChange={(n) => update((c) => ({ ...c, damage: { ...c.damage, overflow: n } }))}
            />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn w-full border-danger/40" onClick={() => setHurt(true)}>
            <ShieldAlert className="size-4 text-danger" /> Take damage…
          </button>
          <button className="btn w-full" onClick={() => setHealing(true)}>
            <HeartPulse className="size-4 text-accent" /> Heal…
          </button>
        </div>
        <StatusList character={character} update={update} />
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="flex items-center gap-1 text-muted">
              <Sparkles className="size-3.5" /> Edge <HelpButton entry={PLAY_HELP.edge} />
            </span>
            <button className="text-muted hover:text-fg" onClick={() => setEdge(derived.attributes.edge)}>
              Reset to {derived.attributes.edge}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn size-10 p-0" onClick={() => setEdge(edge - 1)} aria-label="Spend Edge">
              <Minus className="size-4" />
            </button>
            <div className="flex flex-1 justify-center gap-1.5">
              {Array.from({ length: MAX_EDGE }, (_, i) => (
                <button
                  key={i}
                  aria-label={`Set Edge to ${i + 1}`}
                  onClick={() => setEdge(i + 1 === edge ? i : i + 1)}
                  className={`size-6 rotate-45 rounded-sm border transition-all ${
                    i < edge
                      ? 'border-amber bg-amber/80 shadow-[0_0_10px_-2px_var(--color-amber)]'
                      : 'border-line bg-bg'
                  }`}
                />
              ))}
            </div>
            <button
              className="btn size-10 p-0"
              onClick={gainEdge}
              disabled={edge >= MAX_EDGE || edgeCapped}
              aria-label="Gain Edge"
              title={edgeCapped ? `At most ${MAX_EDGE_GAIN_PER_ROUND} Edge can be gained per combat round` : undefined}
            >
              <Plus className="size-4" />
            </button>
          </div>
          {edgeCapped && (
            <p className="mt-1 text-center text-xs text-muted">
              {MAX_EDGE_GAIN_PER_ROUND} Edge gained this round, the most allowed.
            </p>
          )}
        </div>
      </Section>

      <CombatSection character={character} update={update} onRoll={doRoll} />

      <AttackSection character={character} update={update} wounds={wounds} onRoll={doRoll} />

      <EdgeActions character={character} update={update} edge={edge} setEdge={setEdge} />

      <Section title="Roll dice" icon={<Dices className="size-4" />}>
        <p className="mb-3 text-xs text-muted">
          <span className="mr-1 inline-flex items-center gap-0.5 text-fg">
            How a test works <HelpButton entry={PLAY_HELP.howToRoll} />
          </span>
          Tap a pool to roll it; ⓘ says what it’s for.
          {wounds < 0 && ` Your wound modifier (${wounds}) is included, except when soaking.`}
          {character.play.sustained.length > 0 &&
            ` Sustained spells: −${-sustainPenalty(character)} dice (included).`}{' '}
          After the roll you can spend Edge to change it.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-bg/40 p-2 text-sm">
          <span className="text-muted">Next roll</span>
          <button className="btn size-8 p-0" onClick={() => setModifier(modifier - 1)} aria-label="One die fewer">
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center tabular-nums">{modifier > 0 ? `+${modifier}` : modifier}</span>
          <button className="btn size-8 p-0" onClick={() => setModifier(modifier + 1)} aria-label="One die more">
            <Plus className="size-4" />
          </button>
          <span className="text-xs text-muted">dice</span>
          <label
            className={`ml-auto flex items-center gap-1.5 text-xs ${edge < EDGE_POOL_BOOST_COST ? 'opacity-50' : ''}`}
            title="4-Edge boost: add your Edge rating as dice, and 6s explode"
          >
            <input
              type="checkbox"
              className="size-4 accent-amber"
              checked={edgeDice}
              disabled={edge < EDGE_POOL_BOOST_COST}
              onChange={(e) => setEdgeDice(e.target.checked)}
            />
            +{derived.attributes.edge} Edge dice, 6s explode ({EDGE_POOL_BOOST_COST} Edge)
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {pools.map((p, i) => (
            <div
              key={`${p.label}-${i}`}
              className="flex items-center rounded-lg border border-line bg-bg/60 hover:border-accent/60"
            >
              <button
                onClick={() => doRoll(p)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-2.5 text-left text-sm"
              >
                <span className="truncate">{p.label}</span>
                <span className="shrink-0 font-display text-base font-semibold text-accent tabular-nums">
                  {p.ignoreWounds ? p.pool : formatPool(p.pool, wounds + sustainPenalty(character))}
                </span>
              </button>
              <HelpButton entry={p.help} className="mx-1" />
              {!p.help && <span className="w-2" />}
            </div>
          ))}
        </div>
        <CustomRoll onRoll={(pool) => doRoll({ label: 'Custom roll', pool, ignoreWounds: true })} />
      </Section>

      {(derived.magic?.spellcasting || character.spells.length > 0 || character.play.sustained.length > 0) && (
        <SpellsSection character={character} update={update} />
      )}
      {(derived.magic?.summoning || character.play.companions.some((c) => c.kind === 'spirit')) && (
        <CompanionsSection character={character} update={update} kind="spirit" onRoll={doRoll} />
      )}
      {(derived.resonance?.tasking || character.play.companions.some((c) => c.kind === 'sprite')) && (
        <CompanionsSection character={character} update={update} kind="sprite" onRoll={doRoll} />
      )}
      {/* A plain commlink doesn't need the hacking tools; decks, consoles, programs and living personas do. */}
      {derived.matrix && (derived.matrix.device?.kind !== 'commlink' || character.programs.length > 0) && (
        <MatrixPlay character={character} update={update} matrix={derived.matrix} onRoll={doRoll} />
      )}
      {character.vehicles.length > 0 && <VehiclesSection character={character} update={update} onRoll={doRoll} />}

      <MoneySection character={character} update={update} />

      <QualityReminders character={character} />

      <Section title="Session notes" icon={<NotebookPen className="size-4" />}>
        <textarea
          {...noAutofillField}
          className="input min-h-32 w-full"
          placeholder="Who you met, what you found, who owes you…"
          value={session.notes}
          onChange={(e) => {
            const notes = e.target.value
            update((c) => ({ ...c, play: { ...c.play, session: c.play.session && { ...c.play.session, notes } } }))
          }}
        />
        <button className="btn mt-2 text-xs" onClick={addTimestamp}>
          <Clock className="size-3.5" /> Add the time
        </button>
      </Section>

      {roll && (
        <RollResult
          label={roll.quick.label}
          roll={roll.result}
          bonus={roll.bonus}
          info={roll.quick.info}
          edge={{ available: edge, onBoost: boost, onInitiativeBoost: boostInitiative }}
          onClose={() => setRoll(null)}
          onReroll={() => doRoll(roll.quick)}
        />
      )}
      {hurt && <DamageDialog character={character} update={update} onClose={() => setHurt(false)} />}
      {healing && <HealDialog character={character} update={update} onClose={() => setHealing(false)} />}
      {ending && <EndSessionDialog character={character} update={update} onClose={() => setEnding(false)} />}
    </div>
  )
}

/** Roll any number of dice, e.g. for a test the app doesn't know. Wound modifiers aren't added. */
function CustomRoll({ onRoll }: { onRoll: (pool: number) => void }) {
  const [pool, setPool] = useState(6)
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
      <span className="mr-auto text-muted">Any pool</span>
      <button className="btn size-9 p-0" onClick={() => setPool(Math.max(1, pool - 1))} aria-label="Fewer dice">
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center font-display text-lg tabular-nums">{pool}</span>
      <button className="btn size-9 p-0" onClick={() => setPool(pool + 1)} aria-label="More dice">
        <Plus className="size-4" />
      </button>
      <button className="btn btn-primary" onClick={() => onRoll(pool)}>
        <Dices className="size-4" /> Roll
      </button>
    </div>
  )
}
