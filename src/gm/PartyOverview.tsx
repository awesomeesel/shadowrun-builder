import { Table2 } from 'lucide-react'
import type { SharedSheet } from '../db/db'
import type { Character } from '../model/character'
import { MAGIC_TYPES, type MagicTypeId } from '../rules/sr6/creation'
import { computeDerived, ownedSkillPools, untrainedSkillPools } from '../rules/sr6/derived'
import { formatInitiative } from '../rules/sr6/format'

interface Column {
  label: string
  /** How it's worked out, shown on hover. */
  hint: string
  value: (c: Character, d: ReturnType<typeof computeDerived>) => string | number
}

/** Perception pool, trained or not, with the best specialization if any. */
function perception(c: Character): string {
  const pool = [...ownedSkillPools(c), ...untrainedSkillPools(c)].find((p) => p.skill.id === 'perception')
  if (!pool || pool.pool === null) return '–'
  return pool.specializationPool !== null ? `${pool.pool} (${pool.specializationPool})` : String(pool.pool)
}

/** Magic or resonance type: from the build, or worked out from what the sheet has. */
function awakening(c: Character, d: ReturnType<typeof computeDerived>): MagicTypeId {
  if (c.build?.magicType) return c.build.magicType
  if (d.attributes.resonance > 0) return 'technomancer'
  if (d.attributes.magic <= 0) return 'mundane'
  const casts = c.spells.length > 0
  const powers = c.adeptPowers.length > 0
  return casts && powers ? 'mysticAdept' : powers ? 'adept' : 'magician'
}

/** What a runner brings beyond the mundane: magic, resonance, a deck. */
function special(c: Character, d: ReturnType<typeof computeDerived>): string {
  const type = awakening(c, d)
  const parts: string[] = []
  if (type !== 'mundane') parts.push(MAGIC_TYPES[type].name)
  // Magicians and mystic adepts perceive astrally; adepts need the power.
  const astral =
    type === 'magician' || type === 'mysticAdept' || c.adeptPowers.some((p) => /astral perception/i.test(p.name))
  if (astral) parts.push('astral')
  // A deck or RCC is worth knowing about; everyone has a commlink.
  const device = d.matrix?.device
  if (device && (device.kind === 'cyberdeck' || device.kind === 'rcc')) parts.push(device.name)
  return parts.join(' · ') || 'Mundane'
}

const COLUMNS: Column[] = [
  { label: 'Initiative', hint: 'Initiative Score + dice', value: (_, d) => formatInitiative(d.initiative) },
  { label: 'Defense Rating', hint: 'Defense Rating against Attack Ratings', value: (_, d) => d.defenseRating },
  { label: 'Defense', hint: 'Defense test: Reaction + Intuition', value: (_, d) => d.pools.defense },
  { label: 'Soak', hint: 'Damage resistance: Body (+ bonuses)', value: (_, d) => d.pools.physicalDamageResistance },
  { label: 'Perception', hint: 'Perception + Intuition (with specialization)', value: (c) => perception(c) },
  {
    label: 'Surprise',
    hint: 'Surprise test: Reaction + Intuition (Core Rulebook p. 108)',
    value: (_, d) => d.attributes.reaction + d.attributes.intuition,
  },
  { label: 'Composure', hint: 'Willpower + Charisma', value: (_, d) => d.pools.composure },
  { label: 'Judge Intentions', hint: 'Willpower + Intuition', value: (_, d) => d.pools.judgeIntentions },
  { label: 'Memory', hint: 'Logic + Intuition', value: (_, d) => d.pools.memory },
  {
    label: 'Edge',
    hint: 'Edge now / Edge rating',
    value: (c, d) => `${c.play.edge ?? d.attributes.edge}/${d.attributes.edge}`,
  },
  { label: 'Heat', hint: 'Heat', value: (c) => c.heat },
  { label: 'Reputation', hint: 'Reputation', value: (c) => c.reputation },
]

/**
 * The numbers a GM checks or rolls in secret, for the whole group at once.
 * Pools are before wound modifiers; the Wounds column shows those.
 */
export function PartyOverview({ runners }: { runners: SharedSheet[] }) {
  const rows = runners.map((s) => ({ sheet: s, d: computeDerived(s.character) }))
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
        <Table2 className="size-5 text-accent" /> Party overview
        <span className="text-xs font-normal text-muted">dice pools before wound modifiers</span>
      </h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="sticky left-0 bg-surface px-3 py-2 font-normal">Runner</th>
              {COLUMNS.map((col) => (
                <th key={col.label} className="px-2 py-2 text-center font-normal whitespace-nowrap" title={col.hint}>
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-normal" title="Wound modifier from current damage">
                Wounds
              </th>
              <th className="px-3 py-2 font-normal">Special</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sheet, d }) => (
              <tr key={sheet.id} className="border-b border-line/50 last:border-0">
                <td className="sticky left-0 bg-surface px-3 py-2 font-semibold whitespace-nowrap">
                  {sheet.character.name}
                </td>
                {COLUMNS.map((col) => (
                  <td key={col.label} className="px-2 py-2 text-center whitespace-nowrap">
                    {col.value(sheet.character, d)}
                  </td>
                ))}
                <td className={`px-2 py-2 text-center ${d.woundModifier < 0 ? 'text-danger' : 'text-muted'}`}>
                  {d.woundModifier < 0 ? d.woundModifier : '–'}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">{special(sheet.character, d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
