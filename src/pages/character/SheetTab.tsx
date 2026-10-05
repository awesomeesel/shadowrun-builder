import { useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { Section } from '../../components/ui'
import type { Character } from '../../model/character'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS } from '../../rules/sr6/attributes'
import {
  computeDerived,
  ownedSkillPools,
  untrainedSkillPools,
  type ConditionMonitor,
  type Initiative,
  type SkillPool,
  weaponPool,
} from '../../rules/sr6/derived'
import { METATYPES } from '../../rules/sr6/metatypes'
import type { CharacterContext } from './CharacterPage'

type DamageTrack = keyof Character['damage']

export function SheetTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  const derived = computeDerived(character)
  const wounds = derived.woundModifier
  const [showUntrained, setShowUntrained] = useState(false)

  const setDamage = (track: DamageTrack, filled: number) =>
    update((c) => ({ ...c, damage: { ...c.damage, [track]: filled } }))

  const visibleAttributes = ATTRIBUTE_IDS.filter(
    (a) => !((a === 'magic' || a === 'resonance') && character.attributes[a] === 0),
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card flex gap-4 p-4 lg:col-span-2">
        {character.portrait && (
          <img src={character.portrait} alt="" className="size-20 shrink-0 rounded object-cover sm:size-24" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">
            {[METATYPES[character.metatype].name, character.concept].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12">
            {visibleAttributes.map((a) => (
              <Stat key={a} label={ATTRIBUTE_LABELS[a].short} value={character.attributes[a]} />
            ))}
            <Stat label="ESS" value={derived.essence.toFixed(2).replace(/\.?0+$/, '')} />
          </div>
        </div>
      </section>

      <Section title="Combat">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Initiative" value={formatInitiative(derived.initiative)} large />
          <Stat label="Defense Rating" value={derived.defenseRating} large hint={armorHint(derived.armor)} />
          <Stat label="Unarmed AR" value={derived.unarmedAttackRating} large />
          <Stat
            label="Wound mod."
            value={wounds === 0 ? '—' : wounds}
            large
            tone={wounds < 0 ? 'danger' : undefined}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <PoolRow label="Defense (REA + INT)" pool={derived.pools.defense} wounds={wounds} />
          <PoolRow label="Damage resistance (BOD)" pool={derived.pools.damageResistance} />
          {character.attributes.magic > 0 && (
            <div className="col-span-2 flex justify-between">
              <dt className="text-muted">Astral initiative</dt>
              <dd>{formatInitiative(derived.astralInitiative)}</dd>
            </div>
          )}
        </dl>
      </Section>

      <Section title="Condition">
        <div className="grid gap-4">
          <MonitorTrack
            label="Physical"
            monitor={derived.physicalMonitor}
            onChange={(n) => setDamage('physical', n)}
          />
          <MonitorTrack label="Stun" monitor={derived.stunMonitor} onChange={(n) => setDamage('stun', n)} />
          {derived.physicalMonitor.filled >= derived.physicalMonitor.boxes && (
            <MonitorTrack
              label="Overflow"
              monitor={derived.overflow}
              onChange={(n) => setDamage('overflow', n)}
              showModifiers={false}
            />
          )}
        </div>
      </Section>

      <Section
        title="Skills"
        className="lg:row-span-2"
        aside={
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showUntrained} onChange={(e) => setShowUntrained(e.target.checked)} />
            Show untrained
          </label>
        }
      >
        <SkillTable
          pools={[...ownedSkillPools(character), ...(showUntrained ? untrainedSkillPools(character) : [])]}
          wounds={wounds}
        />
      </Section>

      <Section title="Attribute tests">
        <dl className="grid gap-y-1 text-sm">
          <PoolRow label="Composure (WIL + CHA)" pool={derived.pools.composure} wounds={wounds} />
          <PoolRow label="Judge Intentions (WIL + INT)" pool={derived.pools.judgeIntentions} wounds={wounds} />
          <PoolRow label="Memory (LOG + INT)" pool={derived.pools.memory} wounds={wounds} />
          <PoolRow label="Lift / Carry (BOD + WIL)" pool={derived.pools.liftCarry} wounds={wounds} />
        </dl>
      </Section>

      {character.weapons.length > 0 && (
        <Section title="Weapons" className="lg:col-span-2">
          <WeaponTable character={character} wounds={wounds} />
        </Section>
      )}

      {character.qualities.length > 0 && (
        <Section title="Qualities">
          <ul className="grid gap-1 text-sm">
            {character.qualities.map((q) => (
              <li key={q.id}>
                <span className={q.kind === 'negative' ? 'text-danger' : ''}>{q.name || 'Unnamed quality'}</span>
                {q.rating > 1 && <span className="text-muted"> {q.rating}</span>}
                {q.notes && <div className="text-xs text-muted">{q.notes}</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {character.gear.length > 0 && (
        <Section title="Armor & gear">
          <ul className="grid gap-1 text-sm">
            {character.gear.map((g) => (
              <li key={g.id} className="flex justify-between gap-3">
                <span>
                  {g.quantity > 1 && <span className="text-muted">{g.quantity}× </span>}
                  {g.name || 'Unnamed item'}
                  {g.rating > 0 && <span className="text-muted"> (R{g.rating})</span>}
                  {g.notes && <div className="text-xs text-muted">{g.notes}</div>}
                </span>
                {g.armor > 0 && (
                  <span className={`shrink-0 text-xs ${g.equipped ? 'text-accent' : 'text-muted'}`}>
                    +{g.armor} DR{g.equipped ? '' : ' (not worn)'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {character.contacts.length > 0 && (
        <Section title="Contacts">
          <ul className="grid gap-1 text-sm">
            {character.contacts.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>
                  {c.name || 'Unnamed contact'}
                  {c.role && <span className="text-muted"> · {c.role}</span>}
                  {c.notes && <div className="text-xs text-muted">{c.notes}</div>}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums" title="Connection / Loyalty">
                  C{c.connection} L{c.loyalty}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(character.languages.length > 0 || character.knowledgeSkills.length > 0) && (
        <Section title="Knowledge & languages">
          <ul className="grid gap-1 text-sm">
            {character.languages.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>{l.name || 'Unnamed language'}</span>
                <span className="text-xs text-muted capitalize">{l.level}</span>
              </li>
            ))}
            {character.knowledgeSkills.map((k) => (
              <li key={k.id}>{k.name || 'Unnamed knowledge skill'}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Resources">
        <dl className="grid gap-y-1 text-sm">
          <Row label="Nuyen" value={`${character.nuyen.toLocaleString()} ¥`} />
          <Row label="Karma available" value={character.karma.available} />
          <Row label="Career karma" value={character.karma.career} />
        </dl>
      </Section>
    </div>
  )
}

function formatInitiative({ score, dice }: Initiative) {
  return `${score} + ${dice}D6`
}

function armorHint(armor: number) {
  return armor > 0 ? `incl. armor ${armor}` : 'no armor equipped'
}

function Stat({
  label,
  value,
  large = false,
  hint,
  tone,
}: {
  label: string
  value: string | number
  large?: boolean
  hint?: string
  tone?: 'danger'
}) {
  return (
    <div className="rounded border border-line bg-bg/60 px-2 py-1.5 text-center" title={hint}>
      <div className="text-[10px] tracking-wider text-muted uppercase">{label}</div>
      <div className={`${large ? 'text-xl' : 'text-lg'} font-semibold tabular-nums ${tone === 'danger' ? 'text-danger' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** A dice pool, with the wound modifier applied when one is given. */
function PoolRow({ label, pool, wounds = 0 }: { label: string; pool: number; wounds?: number }) {
  return <Row label={label} value={formatPool(pool, wounds)} />
}

function formatPool(pool: number, wounds: number) {
  return Math.max(0, pool + wounds)
}

function MonitorTrack({
  label,
  monitor,
  onChange,
  showModifiers = true,
}: {
  label: string
  monitor: ConditionMonitor
  onChange: (filled: number) => void
  showModifiers?: boolean
}) {
  const filled = Math.min(monitor.filled, monitor.boxes)
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {filled} / {monitor.boxes}
          {filled > 0 && (
            <button className="ml-3 text-muted hover:text-fg" onClick={() => onChange(0)}>
              Clear
            </button>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: monitor.boxes }, (_, i) => {
          const box = i + 1
          const isFilled = box <= filled
          const endsStep = showModifiers && box % 3 === 0
          return (
            <button
              key={box}
              aria-label={`${label} box ${box}`}
              // Clicking the last filled box un-fills it; any other box fills up to it.
              onClick={() => onChange(box === filled ? box - 1 : box)}
              className={`relative size-7 rounded-sm border text-[10px] ${
                isFilled ? 'border-danger bg-danger/70 text-bg' : 'border-line bg-bg hover:border-accent/60'
              } ${endsStep ? 'mr-2' : ''}`}
            >
              {endsStep ? `-${box / 3}` : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SkillTable({ pools, wounds }: { pools: SkillPool[]; wounds: number }) {
  if (pools.length === 0) {
    return (
      <p className="text-sm text-muted">
        No skills yet.{' '}
        <Link to="edit" className="text-accent hover:underline">
          Add some
        </Link>
      </p>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="pb-1 font-normal">Skill</th>
          <th className="pb-1 text-center font-normal">Rating</th>
          <th className="pb-1 text-right font-normal">Pool</th>
        </tr>
      </thead>
      <tbody>
        {pools.map((p) => (
          <tr key={p.skill.id} className={`border-t border-line/60 ${p.owned ? '' : 'text-muted'}`}>
            <td className="py-1.5">
              {p.skill.name}{' '}
              <span className="text-xs text-muted">{ATTRIBUTE_LABELS[p.skill.attribute].short}</span>
              {p.owned?.specialization && (
                <div className="text-xs text-muted">
                  {p.owned.specialization} (+2)
                </div>
              )}
              {p.owned?.expertise && <div className="text-xs text-muted">{p.owned.expertise} (+3)</div>}
            </td>
            <td className="py-1.5 text-center tabular-nums">{p.rating || '–'}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">
              {p.pool === null ? <span className="font-normal text-muted">n/a</span> : formatPool(p.pool, wounds)}
              {p.specializationPool !== null && (
                <div className="text-xs font-normal text-muted">{formatPool(p.specializationPool, wounds)}</div>
              )}
              {p.expertisePool !== null && (
                <div className="text-xs font-normal text-muted">{formatPool(p.expertisePool, wounds)}</div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const RANGE_LABELS = ['Close', 'Near', 'Med', 'Far', 'Ext']

function WeaponTable({ character, wounds }: { character: Character; wounds: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-1 font-normal">Weapon</th>
            <th className="pb-1 text-center font-normal">DV</th>
            {RANGE_LABELS.map((r) => (
              <th key={r} className="pb-1 text-center font-normal">
                {r}
              </th>
            ))}
            <th className="pb-1 text-center font-normal">Mode</th>
            <th className="pb-1 text-center font-normal">Ammo</th>
            <th className="pb-1 text-right font-normal">Pool</th>
          </tr>
        </thead>
        <tbody>
          {character.weapons.map((w) => {
            const { pool, bonus } = weaponPool(character, w)
            return (
              <tr key={w.id} className="border-t border-line/60">
                <td className="py-1.5">
                  {w.name || 'Unnamed weapon'}
                  {w.notes && <div className="text-xs text-muted">{w.notes}</div>}
                </td>
                <td className="py-1.5 text-center">{w.damage || '–'}</td>
                {w.attackRatings.map((ar, i) => (
                  <td key={i} className="py-1.5 text-center tabular-nums">
                    {ar ?? <span className="text-muted">–</span>}
                  </td>
                ))}
                <td className="py-1.5 text-center text-xs">{w.modes || '–'}</td>
                <td className="py-1.5 text-center text-xs">{w.ammo || '–'}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums" title={bonus ? `includes +${bonus} specialization` : undefined}>
                  {pool === null ? <span className="font-normal text-muted">n/a</span> : formatPool(pool, wounds)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
