import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router'
import { Section } from '../../components/ui'
import type { Build, Character } from '../../model/character'
import {
  ATTRIBUTE_IDS,
  ATTRIBUTE_LABELS,
  MENTAL_ATTRIBUTES,
  PHYSICAL_ATTRIBUTES,
  type AttributeId,
} from '../../rules/sr6/attributes'
import {
  applyBuild,
  buildAttributeValue,
  canUseAdjustment,
  evaluateBuild,
  finishBuild,
  type Budget,
  type BuildEvaluation,
} from '../../rules/sr6/build'
import {
  CREATION_RULES,
  MAGIC_TYPES,
  PRIORITY_CATEGORIES,
  PRIORITY_CATEGORY_LABELS,
  PRIORITY_LEVELS,
  PRIORITY_TABLE,
  type MagicTypeId,
  type PriorityCategory,
  type PriorityLevel,
} from '../../rules/sr6/creation'
import { METATYPE_IDS, METATYPES, attributeMaximum } from '../../rules/sr6/metatypes'
import { SKILLS, SKILLS_BY_ID } from '../../rules/sr6/skills'
import type { CharacterContext } from './CharacterPage'

type UpdateBuild = (change: (build: Build, character: Character) => void) => void

export function BuildTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  const navigate = useNavigate()
  const build = character.build
  const evaluation = evaluateBuild(character)

  if (!build || !evaluation || character.mode !== 'build') {
    return (
      <p className="text-sm text-muted">
        This character isn't being built with priorities.{' '}
        <Link to=".." relative="path" className="text-accent hover:underline">
          Back to the sheet
        </Link>
      </p>
    )
  }

  /** Mutate a copy of the build (and character, for metatype), then re-derive attributes and skills. */
  const updateBuild: UpdateBuild = (change) =>
    update((c) => {
      const next = { ...c, build: structuredClone(c.build!) }
      change(next.build, next)
      return applyBuild(next)
    })

  const errors = evaluation.issues.filter((i) => i.severity === 'error')

  function finish() {
    const message =
      'Finish character creation? Leftover karma and nuyen become starting resources, and the build tab closes. ' +
      'Attributes and skills can still be edited freely afterwards.'
    if (confirm(message)) {
      update(finishBuild)
      navigate('..', { relative: 'path' })
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BudgetBar evaluation={evaluation} />

      <IssueList evaluation={evaluation} />

      <PrioritiesSection build={build} character={character} updateBuild={updateBuild} />
      <AttributesSection build={build} character={character} updateBuild={updateBuild} />
      <SkillsSection build={build} character={character} updateBuild={updateBuild} />
      <KarmaSection build={build} evaluation={evaluation} updateBuild={updateBuild} />

      <section className="card flex flex-wrap items-center gap-3 p-4 lg:col-span-2">
        <p className="mr-auto text-sm text-muted">
          Qualities, contacts, knowledge skills, gear, augmentations, spells and other items are entered on the{' '}
          <Link to="../edit" relative="path" className="text-accent hover:underline">
            Edit
          </Link>{' '}
          tab and counted here automatically.
        </p>
        <button
          className="btn btn-primary"
          onClick={finish}
          disabled={errors.length > 0}
          title={errors.length > 0 ? 'Fix the errors first' : undefined}
        >
          Finish build
        </button>
      </section>
    </div>
  )
}

function BudgetBar({ evaluation }: { evaluation: BuildEvaluation }) {
  const items: [string, Budget, string?][] = [
    ['Adjustment', evaluation.adjustmentPoints],
    ['Attributes', evaluation.attributePoints],
    ['Skills', evaluation.skillPoints],
    ['Karma', evaluation.karma],
    ['Nuyen', evaluation.nuyen, '¥'],
  ]
  return (
    <div className="sticky top-[5.6rem] z-[5] grid grid-cols-3 gap-2 rounded-lg border border-line bg-bg/95 p-2 backdrop-blur sm:grid-cols-5 lg:col-span-2">
      {items.map(([label, b, unit]) => (
        <div key={label} className="text-center" title={`${b.spent.toLocaleString()} of ${b.total.toLocaleString()} spent`}>
          <div className="text-[10px] tracking-wider text-muted uppercase">{label}</div>
          <div
            className={`font-semibold tabular-nums ${
              b.remaining < 0 ? 'text-danger' : b.remaining === 0 ? 'text-muted' : 'text-accent'
            }`}
          >
            {b.remaining.toLocaleString()}
            {unit && <span className="ml-0.5 text-xs">{unit}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function IssueList({ evaluation }: { evaluation: BuildEvaluation }) {
  const [showWarnings, setShowWarnings] = useState(false)
  const errors = evaluation.issues.filter((i) => i.severity === 'error')
  const warnings = evaluation.issues.filter((i) => i.severity === 'warning')
  if (errors.length === 0 && warnings.length === 0) {
    return <p className="text-sm text-accent lg:col-span-2">✓ The build is valid.</p>
  }
  return (
    <div className="text-sm lg:col-span-2">
      <ul className="grid gap-1">
        {errors.map((i) => (
          <li key={i.message} className="text-danger">
            ✕ {i.message}
          </li>
        ))}
        {showWarnings &&
          warnings.map((i) => (
            <li key={i.message} className="text-muted">
              • {i.message}
            </li>
          ))}
      </ul>
      {warnings.length > 0 && (
        <button className="mt-1 text-xs text-muted hover:text-fg" onClick={() => setShowWarnings(!showWarnings)}>
          {showWarnings ? 'Hide' : 'Show'} {warnings.length} note{warnings.length === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}

function priorityDescription(category: PriorityCategory, level: PriorityLevel): string {
  const row = PRIORITY_TABLE[level]
  switch (category) {
    case 'metatype':
      return `${row.metatypes.map((m) => METATYPES[m].name).join(', ')} · ${row.adjustmentPoints} adj.`
    case 'attributes':
      return `${row.attributePoints} points`
    case 'skills':
      return `${row.skillPoints} points`
    case 'magic':
      return row.magicRating ? `Magic/Resonance ${row.magicRating}` : 'Mundane'
    case 'resources':
      return `${row.nuyen.toLocaleString()} ¥`
  }
}

function PrioritiesSection({
  build,
  character,
  updateBuild,
}: {
  build: Build
  character: Character
  updateBuild: UpdateBuild
}) {
  // Picking a letter another category already has swaps the two, so priorities stay unique.
  function choose(category: PriorityCategory, level: PriorityLevel) {
    updateBuild((b) => {
      const other = PRIORITY_CATEGORIES.find((c) => c !== category && b.priorities[c] === level)
      if (other) b.priorities[other] = b.priorities[category]
      b.priorities[category] = level
    })
  }

  return (
    <Section title="Priorities" className="lg:col-span-2">
      <div className="grid gap-3">
        {PRIORITY_CATEGORIES.map((category) => (
          <div key={category} className="grid items-center gap-2 sm:grid-cols-[9rem_auto_1fr]">
            <span className="text-sm">{PRIORITY_CATEGORY_LABELS[category]}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={PRIORITY_CATEGORY_LABELS[category]}>
              {PRIORITY_LEVELS.map((level) => {
                const active = build.priorities[category] === level
                return (
                  <button
                    key={level}
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(category, level)}
                    className={`size-8 rounded border text-sm font-semibold ${
                      active ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted hover:border-accent/50'
                    }`}
                  >
                    {level}
                  </button>
                )
              })}
            </div>
            <span className="text-xs text-muted">{priorityDescription(category, build.priorities[category])}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Metatype</span>
          <select
            className="input w-full"
            value={character.metatype}
            onChange={(e) => {
              const metatype = e.target.value as Character['metatype']
              updateBuild((_, c) => {
                c.metatype = metatype
              })
            }}
          >
            {METATYPE_IDS.map((m) => (
              <option key={m} value={m}>
                {METATYPES[m].name}
                {PRIORITY_TABLE[build.priorities.metatype].metatypes.includes(m) ? '' : ' (needs higher priority)'}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Magic / Resonance</span>
          <select
            className="input w-full"
            value={build.magicType}
            onChange={(e) => {
              const magicType = e.target.value as MagicTypeId
              updateBuild((b) => {
                b.magicType = magicType
              })
            }}
          >
            {(Object.keys(MAGIC_TYPES) as MagicTypeId[]).map((m) => (
              <option key={m} value={m}>
                {MAGIC_TYPES[m].name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Section>
  )
}

/** −/+ control. Reports a delta rather than a new value so fast clicks never act on a stale value. */
function Stepper({
  value,
  onStep,
  disabled = false,
  label,
}: {
  value: number
  onStep: (delta: 1 | -1) => void
  disabled?: boolean
  label: string
}) {
  if (disabled) return <span className="block text-center text-muted">–</span>
  return (
    <div className="flex items-center justify-center gap-0.5 sm:gap-1">
      <button
        className="size-6 rounded border border-line text-muted hover:border-accent/60 hover:text-fg sm:size-7 disabled:opacity-30"
        onClick={() => onStep(-1)}
        disabled={value <= 0}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="w-4 text-center tabular-nums sm:w-5">{value}</span>
      <button
        className="size-6 rounded border border-line text-muted hover:border-accent/60 hover:text-fg sm:size-7"
        onClick={() => onStep(1)}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  )
}

function AttributesSection({
  build,
  character,
  updateBuild,
}: {
  build: Build
  character: Character
  updateBuild: UpdateBuild
}) {
  const awakened = MAGIC_TYPES[build.magicType].attribute
  const rows: AttributeId[] = [...ATTRIBUTE_IDS].filter(
    (a) => (a !== 'magic' && a !== 'resonance') || awakened === a,
  )
  const step = (attribute: AttributeId, field: 'adjustment' | 'points' | 'karma', delta: number) =>
    updateBuild((b) => {
      b.attributes[attribute][field] = Math.max(0, b.attributes[attribute][field] + delta)
    })

  return (
    <Section title="Attributes">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 text-left font-normal">Attribute</th>
            <th className="pb-2 font-normal">Adj.</th>
            <th className="pb-2 font-normal">Points</th>
            <th className="pb-2 font-normal">Karma</th>
            <th className="pb-2 text-right font-normal">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((attribute) => {
            const alloc = build.attributes[attribute]
            const label = ATTRIBUTE_LABELS[attribute]
            const value = buildAttributeValue(build, attribute)
            const max = attributeMaximum(character.metatype, attribute)
            const takesPoints = (PHYSICAL_ATTRIBUTES as readonly string[]).includes(attribute) ||
              (MENTAL_ATTRIBUTES as readonly string[]).includes(attribute)
            return (
              <tr key={attribute} className="border-t border-line/60">
                <td className="py-1">
                  <span className="hidden sm:inline">{label.name} </span>
                  <span className="text-xs text-muted">{label.short}</span>
                </td>
                <td className="py-1">
                  <Stepper
                    label={`${label.name} adjustment`}
                    value={alloc.adjustment}
                    disabled={!canUseAdjustment(character, build, attribute) && alloc.adjustment === 0}
                    onStep={(d) => step(attribute, 'adjustment', d)}
                  />
                </td>
                <td className="py-1">
                  <Stepper
                    label={`${label.name} points`}
                    value={alloc.points}
                    disabled={!takesPoints && alloc.points === 0}
                    onStep={(d) => step(attribute, 'points', d)}
                  />
                </td>
                <td className="py-1">
                  <Stepper label={`${label.name} karma`} value={alloc.karma} onStep={(d) => step(attribute, 'karma', d)} />
                </td>
                <td className={`py-1 text-right font-semibold tabular-nums ${value > max ? 'text-danger' : ''}`}>
                  {value}
                  <span className="text-xs font-normal text-muted">/{max}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Section>
  )
}

function SkillsSection({
  build,
  character,
  updateBuild,
}: {
  build: Build
  character: Character
  updateBuild: UpdateBuild
}) {
  const available = SKILLS.filter((s) => !character.skills.some((cs) => cs.skillId === s.id))
  const stepAlloc = (id: string, field: 'points' | 'karma', delta: number) =>
    updateBuild((b) => {
      const alloc = (b.skills[id] ??= { adjustment: 0, points: 0, karma: 0 })
      alloc[field] = Math.max(0, alloc[field] + delta)
    })
  const setText = (id: string, field: 'specialization' | 'expertise', value: string) =>
    updateBuild((_, c) => {
      c.skills = c.skills.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    })

  return (
    <Section title="Skills">
      {character.skills.length === 0 && <p className="mb-3 text-sm text-muted">No skills yet.</p>}
      <ul className="mb-3 grid gap-2">
        {character.skills.map((skill) => {
          const def = SKILLS_BY_ID.get(skill.skillId)
          const alloc = build.skills[skill.id] ?? { points: 0, karma: 0 }
          return (
            <li key={skill.id} className="rounded border border-line/70 bg-bg/40 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1">
                  {def?.name ?? skill.skillId}
                  {def && <span className="ml-1 text-xs text-muted">{ATTRIBUTE_LABELS[def.attribute].short}</span>}
                </span>
                <span className="text-xs text-muted">Points</span>
                <Stepper label={`${def?.name} points`} value={alloc.points} onStep={(d) => stepAlloc(skill.id, 'points', d)} />
                <span className="text-xs text-muted">Karma</span>
                <Stepper label={`${def?.name} karma`} value={alloc.karma} onStep={(d) => stepAlloc(skill.id, 'karma', d)} />
                <span className="w-6 text-right font-semibold tabular-nums">{skill.rating}</span>
                <button
                  className="px-1 text-muted hover:text-danger"
                  aria-label={`Remove ${def?.name ?? 'skill'}`}
                  onClick={() =>
                    updateBuild((b, c) => {
                      c.skills = c.skills.filter((s) => s.id !== skill.id)
                      delete b.skills[skill.id]
                    })
                  }
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder={`Specialization (${CREATION_RULES.specializationSkillPoints} pt)`}
                  value={skill.specialization}
                  onChange={(e) => setText(skill.id, 'specialization', e.target.value)}
                />
                <input
                  className="input"
                  placeholder={`Expertise (${CREATION_RULES.expertiseKarma} karma)`}
                  value={skill.expertise}
                  onChange={(e) => setText(skill.id, 'expertise', e.target.value)}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {available.length > 0 && (
        <select
          className="input w-full"
          value=""
          onChange={(e) => {
            const skillId = e.target.value
            if (!skillId) return
            const id = crypto.randomUUID()
            updateBuild((b, c) => {
              c.skills = [...c.skills, { id, skillId, rating: 1, specialization: '', expertise: '' }]
              b.skills[id] = { adjustment: 0, points: 1, karma: 0 }
            })
          }}
        >
          <option value="">+ Add skill…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </Section>
  )
}

function KarmaSection({
  build,
  evaluation,
  updateBuild,
}: {
  build: Build
  evaluation: BuildEvaluation
  updateBuild: UpdateBuild
}) {
  const b = evaluation.karma.breakdown
  const rows: [string, number, string?][] = [
    ['Attributes', b.attributes],
    ['Skills, expertise', b.skills],
    ['Qualities (positive − negative)', b.qualities],
    [
      'Knowledge & languages',
      b.knowledge,
      `${evaluation.freeKnowledge.spent} of ${evaluation.freeKnowledge.total} free used`,
    ],
    ['Contacts', b.contacts, `${evaluation.freeContactKarma.spent} of ${evaluation.freeContactKarma.total} free karma used`],
    ['Spells, complex forms, power points', b.magic],
    ['Converted to nuyen', b.nuyen],
  ]
  return (
    <Section title="Karma & resources" className="lg:col-span-2">
      <dl className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-x-8">
        <div className="flex justify-between">
          <dt className="text-muted">Starting karma</dt>
          <dd className="tabular-nums">{evaluation.karma.total}</dd>
        </div>
        {rows.map(([label, value, hint]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">
              {label}
              {hint && <span className="block text-xs">{hint}</span>}
            </dt>
            <dd className="tabular-nums">{value > 0 ? `−${value}` : value < 0 ? `+${-value}` : '0'}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-1 font-semibold">
          <dt>Karma left</dt>
          <dd className={`tabular-nums ${evaluation.karma.remaining < 0 ? 'text-danger' : ''}`}>
            {evaluation.karma.remaining}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">
          Convert karma to nuyen ({CREATION_RULES.nuyenPerKarma.toLocaleString()} ¥ each, max{' '}
          {CREATION_RULES.maxKarmaForNuyen})
        </span>
        <Stepper
          label="karma converted to nuyen"
          value={build.karmaForNuyen}
          onStep={(d) =>
            updateBuild((draft) => {
              draft.karmaForNuyen = Math.min(CREATION_RULES.maxKarmaForNuyen, Math.max(0, draft.karmaForNuyen + d))
            })
          }
        />
        <span className="ml-auto text-muted">
          Gear, augmentations & vehicles: {evaluation.nuyen.spent.toLocaleString()} / {evaluation.nuyen.total.toLocaleString()} ¥
        </span>
      </div>
    </Section>
  )
}
