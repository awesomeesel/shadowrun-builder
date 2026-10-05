import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router'
import { pdfPageToPrinted } from '../../books/pages'
import type { RulesTopic } from '../../books/rulesPages'
import { useRulesPages } from '../../books/useRulesPages'
import { Section } from '../../components/ui'
import { db } from '../../db/db'
import { evaluateBuild, finishBuild } from '../../rules/sr6/build'
import { MAGIC_TYPES, PRIORITY_TABLE } from '../../rules/sr6/creation'
import { TRADITIONS, type TraditionId } from '../../rules/sr6/special'
import {
  AttributesSection,
  BudgetBar,
  IssueList,
  KarmaSection,
  PrioritiesSection,
  SkillsSection,
} from './BuildTab'
import type { CharacterContext } from './CharacterPage'
import {
  AugmentationsSection,
  ComplexFormsSection,
  ContactsSection,
  GearSection,
  KnowledgeSection,
  MagicSection,
  MatrixDevicesSection,
  QualitiesSection,
  VehiclesSection,
  WeaponsSection,
} from './EditLists'
import { BasicsSection } from './EditTab'
import { makeUpdateBuild } from './updateBuild'

interface Step {
  id: string
  title: string
  rules?: RulesTopic
  intro: ReactNode
  content: ReactNode
}

/** Step-by-step priority build: one decision at a time, with the budget always visible. */
export function WizardTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rules = useRulesPages()
  const hasCatalog = (useLiveQuery(() => db.catalog.count()) ?? 0) > 0
  const build = character.build
  const evaluation = evaluateBuild(character)

  if (!build || !evaluation || character.mode !== 'build') {
    return (
      <p className="text-sm text-muted">
        This character is finished.{' '}
        <Link to=".." relative="path" className="text-accent hover:underline">
          Back to the sheet
        </Link>
      </p>
    )
  }

  const updateBuild = makeUpdateBuild(update)
  const magicType = MAGIC_TYPES[build.magicType]
  const casts = ['magician', 'aspected', 'mysticAdept'].includes(build.magicType)
  const props = { character, update }
  const buildProps = { build, character, updateBuild }
  const errors = evaluation.issues.filter((i) => i.severity === 'error')

  const booksHint = hasCatalog ? null : (
    <p className="text-sm text-muted">
      Tip: add your rulebook PDFs in the{' '}
      <Link to="/library" className="text-accent hover:underline">
        Library
      </Link>{' '}
      to pick items straight from your books instead of typing them in.
    </p>
  )

  const steps: Step[] = [
    {
      id: 'concept',
      title: 'Concept',
      rules: 'concept',
      intro: 'Who is your runner? A street name and a one-line concept ("ork street samurai with a code of honor") are enough to start.',
      content: <BasicsSection {...props} showMetatype={false} />,
    },
    {
      id: 'priorities',
      title: 'Priorities',
      rules: 'priorities',
      intro:
        'Rank five areas from A (most important) to E. Your metatype choice depends on the Metatype priority; awakened characters need Magic/Resonance D or better.',
      content: (
        <>
          <PrioritiesSection {...buildProps} />
          {casts && (
            <Section title="Tradition">
              <select
                className="input w-full sm:w-64"
                value={character.tradition}
                onChange={(e) => {
                  const tradition = e.target.value as TraditionId
                  update((c) => ({ ...c, tradition }))
                }}
              >
                {(Object.keys(TRADITIONS) as TraditionId[]).map((t) => (
                  <option key={t} value={t}>
                    {TRADITIONS[t].name}
                  </option>
                ))}
              </select>
            </Section>
          )}
        </>
      ),
    },
    {
      id: 'attributes',
      title: 'Attributes',
      rules: 'attributes',
      intro: `Spend ${PRIORITY_TABLE[build.priorities.attributes].attributePoints} attribute points on physical and mental attributes, and ${PRIORITY_TABLE[build.priorities.metatype].adjustmentPoints} adjustment points on Edge${magicType.attribute ? `, ${magicType.attribute === 'magic' ? 'Magic' : 'Resonance'}` : ''} or your metatype's special attributes. Only one attribute may start at its maximum.`,
      content: <AttributesSection {...buildProps} />,
    },
    {
      id: 'skills',
      title: 'Skills',
      rules: 'skills',
      intro: `Spend ${PRIORITY_TABLE[build.priorities.skills].skillPoints} skill points. A specialization costs 1 point. You also get free knowledge skills and one native language.`,
      content: (
        <>
          <SkillsSection {...buildProps} />
          <KnowledgeSection {...props} />
        </>
      ),
    },
    {
      id: 'qualities',
      title: 'Qualities',
      rules: 'qualities',
      intro: 'Positive qualities cost karma; negative qualities give karma back. Pick a few that fit your concept.',
      content: (
        <>
          {booksHint}
          <QualitiesSection {...props} />
        </>
      ),
    },
    ...(magicType.attribute
      ? [
          {
            id: 'magic',
            title: magicType.attribute === 'resonance' ? 'Resonance' : 'Magic',
            rules: 'magic' as const,
            intro:
              magicType.attribute === 'resonance'
                ? 'Choose your complex forms. Each one costs karma.'
                : build.magicType === 'adept'
                  ? 'Choose adept powers worth up to your Magic in power points.'
                  : 'Choose your spells (each costs karma)' + (build.magicType === 'mysticAdept' ? ' and adept powers.' : '.'),
            content: (
              <>
                {booksHint}
                {magicType.attribute === 'resonance' ? <ComplexFormsSection {...props} /> : <MagicSection {...props} />}
              </>
            ),
          },
        ]
      : []),
    {
      id: 'gear',
      title: 'Gear',
      rules: 'gear',
      intro: `You have ${evaluation.nuyen.total.toLocaleString()}¥. Buy weapons, armor, augmentations and anything else you need. Augmentations cost Essence${magicType.attribute ? ', which lowers your ' + (magicType.attribute === 'magic' ? 'Magic' : 'Resonance') : ''}.`,
      content: (
        <>
          {booksHint}
          <WeaponsSection {...props} />
          <GearSection {...props} />
          <AugmentationsSection {...props} />
          <MatrixDevicesSection {...props} />
          <VehiclesSection {...props} />
        </>
      ),
    },
    {
      id: 'contacts',
      title: 'Contacts',
      rules: 'contacts',
      intro: 'Who do you know? Each contact has a Connection (how useful they are) and a Loyalty (how much they like you).',
      content: <ContactsSection {...props} />,
    },
    {
      id: 'review',
      title: 'Review',
      rules: 'finishing',
      intro:
        errors.length > 0
          ? 'Fix the problems below, then finish the build. Leftover karma and nuyen become your starting resources.'
          : 'Everything adds up. Finish the build to turn this into a playable character.',
      content: (
        <>
          <KarmaSection build={build} evaluation={evaluation} updateBuild={updateBuild} />
          <section className="card flex flex-wrap items-center gap-3 p-4">
            <p className="mr-auto text-sm text-muted">
              Check the{' '}
              <Link to=".." relative="path" className="text-accent hover:underline">
                Sheet
              </Link>{' '}
              to see your dice pools before finishing.
            </p>
            <button
              className="btn btn-primary"
              disabled={errors.length > 0}
              onClick={() => {
                if (confirm('Finish the build? Leftover karma and nuyen become starting resources.')) {
                  update(finishBuild)
                  navigate('..', { relative: 'path' })
                }
              }}
            >
              Finish build
            </button>
          </section>
        </>
      ),
    },
  ]

  const index = Math.max(0, steps.findIndex((s) => s.id === params.get('step')))
  const step = steps[index]
  const go = (i: number) => {
    setParams({ step: steps[i].id }, { replace: true })
    window.scrollTo({ top: 0 })
  }
  const rulesPage = step.rules ? rules[step.rules] : undefined

  return (
    <div className="grid grid-cols-1 gap-4">
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Build steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(i)}
            aria-current={i === index ? 'step' : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
              i === index
                ? 'border-accent bg-accent/20 text-accent'
                : i < index
                  ? 'border-line text-fg'
                  : 'border-line text-muted'
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </nav>

      <BudgetBar evaluation={evaluation} />

      <div>
        <h2 className="font-display text-2xl">{step.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {step.intro}
          {rulesPage && (
            <>
              {' '}
              <Link to={`/book/${rulesPage.book.id}?pdf=${rulesPage.page}`} className="whitespace-nowrap text-accent hover:underline">
                Read the rules ({rulesPage.book.code || rulesPage.book.title} {pdfPageToPrinted(rulesPage.book, rulesPage.page)})
              </Link>
            </>
          )}
        </p>
      </div>

      {(step.id === 'review' || errors.length > 0) && <IssueList evaluation={evaluation} />}

      <div className="grid grid-cols-1 gap-4">{step.content}</div>

      <div className="flex justify-between gap-3 border-t border-line pt-4">
        <button className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
          ← Back
        </button>
        {index < steps.length - 1 && (
          <button className="btn btn-primary" onClick={() => go(index + 1)}>
            Next: {steps[index + 1].title} →
          </button>
        )}
      </div>
    </div>
  )
}
