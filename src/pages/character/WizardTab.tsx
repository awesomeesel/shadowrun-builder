import { noAutofillField } from '../../components/noAutofill'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, BookOpen, Flag, Plus, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router'
import { pdfPageToPrinted } from '../../books/pages'
import type { RulesTopic } from '../../books/rulesPages'
import { useRulesPages } from '../../books/useRulesPages'
import { SuggestionChips } from '../../components/CatalogPicker'
import { Section } from '../../components/ui'
import { db } from '../../db/db'
import { ContactSchema, type Character } from '../../model/character'
import { evaluateBuild, finishBuild, type BuildEvaluation } from '../../rules/sr6/build'
import {
  CREATION_RULES,
  MAGIC_TYPES,
  PRIORITY_CATEGORY_LABELS,
  PRIORITY_TABLE,
  type PriorityCategory,
} from '../../rules/sr6/creation'
import { METATYPES } from '../../rules/sr6/metatypes'
import { ROLES_BY_ID, type RoleDef } from '../../rules/sr6/roles'
import { SKILLS_BY_ID } from '../../rules/sr6/skills'
import { TRADITIONS, type TraditionId } from '../../rules/sr6/special'
import { addFromCatalog } from './addFromCatalog'
import { AttributesSection, BudgetBar, IssueList, KarmaSection, PrioritiesSection, SkillsSection } from './BuildTab'
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
import { GuidePanel, RolePicker, type CheckItem } from './wizardGuide'

interface Step {
  id: string
  title: string
  rules?: RulesTopic
  /** One or two sentences: what this step decides. */
  intro: ReactNode
  tips: ReactNode[]
  roleAdvice?: string
  roleActions?: ReactNode
  checklist: CheckItem[]
  content: ReactNode
}

const hasError = (e: BuildEvaluation, pattern: RegExp) =>
  e.issues.some((i) => i.severity === 'error' && pattern.test(i.message))

/** Step-by-step priority build: one decision at a time, with tips and the budget always visible. */
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
  const role: RoleDef | undefined = ROLES_BY_ID.get(build.role)
  const magicType = MAGIC_TYPES[build.magicType]
  const casts = ['magician', 'aspected', 'mysticAdept'].includes(build.magicType)
  const props = { character, update }
  const buildProps = { build, character, updateBuild }
  const errors = evaluation.issues.filter((i) => i.severity === 'error')
  const onAdd = addFromCatalog(update)
  const p = PRIORITY_TABLE

  const booksTip = hasCatalog ? (
    'Use "+ Add from books" to pick from your rulebooks: stats and page links are filled in for you.'
  ) : (
    <>
      Add your rulebook PDFs in the{' '}
      <Link to="/library" className="text-accent hover:underline">
        Library
      </Link>{' '}
      to pick items straight from your books instead of typing them in.
    </>
  )

  const chips = (list: RoleDef['gear']) => (hasCatalog ? <SuggestionChips suggestions={list} onAdd={onAdd} /> : null)

  function applyRole(id: string) {
    const picked = ROLES_BY_ID.get(id)
    update((c) => ({
      ...c,
      build: { ...c.build!, role: id },
      concept: c.concept || picked?.name || '',
    }))
  }

  function applySuggestedPriorities(r: RoleDef) {
    updateBuild((b, c) => {
      b.priorities = { ...r.priorities }
      b.magicType = r.magicType
      if (r.tradition) c.tradition = r.tradition
      if (!p[r.priorities.metatype].metatypes.includes(c.metatype)) c.metatype = r.metatypes[0]
    })
  }

  function addSuggestedSkills(r: RoleDef) {
    updateBuild((b, c) => {
      for (const skillId of r.keySkills) {
        if (c.skills.some((s) => s.skillId === skillId)) continue
        const id = crypto.randomUUID()
        c.skills = [...c.skills, { id, skillId, rating: 1, specialization: '', expertise: '' }]
        b.skills[id] = { adjustment: 0, points: 1, karma: 0 }
      }
    })
  }

  function addSuggestedContacts(r: RoleDef) {
    update((c: Character) => ({
      ...c,
      contacts: [
        ...c.contacts,
        ...r.contacts
          .filter((name) => !c.contacts.some((existing) => existing.role === name))
          .map((name) => ContactSchema.parse({ name: '', role: name, connection: 2, loyalty: 2 })),
      ],
    }))
  }

  const prioritiesSet = !hasError(evaluation, /Priority|isn't available|needs Magic/)
  const steps: Step[] = [
    {
      id: 'concept',
      title: 'Concept',
      rules: 'concept',
      intro: 'Start with an idea: who is your runner, and what do they bring to a team?',
      tips: [
        'A shadowrun team needs muscle, magic, a hacker, a driver and someone who talks. Pick a job the rest of your group doesn’t cover.',
        'Answer three questions: where did they grow up, why do they run the shadows, and what would make them walk away from a job?',
        'A street name is what people call them on the job. A real name is optional; many runners hide theirs.',
      ],
      checklist: [
        { done: character.name.trim() !== '' && character.name !== 'Unnamed runner', label: 'Street name chosen' },
        { done: character.concept.trim() !== '', label: 'One-line concept' },
        { done: build.role !== '' || character.concept.trim() !== '', label: 'Role picked (optional)' },
      ],
      content: (
        <>
          <RolePicker value={build.role} onChange={applyRole} />
          <BasicsSection {...props} showMetatype={false} />
        </>
      ),
    },
    {
      id: 'priorities',
      title: 'Priorities',
      rules: 'priorities',
      intro:
        'Rank five areas from A (most) to E (least). This is the biggest decision you make: it sets how many points you get for everything else.',
      tips: [
        `Metatype: higher priority unlocks more metatypes and more adjustment points (A gives ${p.A.adjustmentPoints}, E gives ${p.E.adjustmentPoints}).`,
        `Attributes and Skills give points to spend (A: ${p.A.attributePoints} attribute / ${p.A.skillPoints} skill points).`,
        `Magic/Resonance: only matters for mages, adepts and technomancers. Mundane characters should put it at E.`,
        `Resources: starting nuyen, from ${p.E.nuyen.toLocaleString()}¥ at E to ${p.A.nuyen.toLocaleString()}¥ at A. Cyberware, decks and vehicles are expensive.`,
        'Picking a letter that is already used swaps the two, so you never have duplicates.',
      ],
      roleAdvice: role?.advice.priorities ?? (role ? `Suggested for a ${role.name.toLowerCase()}.` : undefined),
      roleActions: role && (
        <div className="grid gap-2">
          <div className="text-xs text-muted">
            {(Object.entries(role.priorities) as [PriorityCategory, string][])
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([category, level]) => `${level}: ${PRIORITY_CATEGORY_LABELS[category]}`)
              .join(' · ')}
          </div>
          <button className="btn btn-primary justify-self-start" onClick={() => applySuggestedPriorities(role)}>
            <Sparkles className="size-4" /> Use these priorities
          </button>
        </div>
      ),
      checklist: [
        { done: prioritiesSet, label: 'Each letter used once' },
        {
          done: p[build.priorities.metatype].metatypes.includes(character.metatype),
          label: `${METATYPES[character.metatype].name} allowed at Metatype ${build.priorities.metatype}`,
        },
        {
          done: !hasError(evaluation, /needs Magic/),
          label: magicType.attribute ? `${magicType.name} has Magic/Resonance` : 'Mundane (no magic)',
        },
      ],
      content: (
        <>
          <PrioritiesSection {...buildProps} />
          {casts && (
            <Section title="Tradition">
              <p className="mb-2 text-sm text-muted">
                Your tradition decides which attribute helps resist drain: Logic for hermetic mages, Charisma for
                shamans.
              </p>
              <select
                {...noAutofillField}
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
      intro: `Raise your attributes with ${evaluation.attributePoints.total} attribute points and ${evaluation.adjustmentPoints.total} adjustment points. Karma can buy more, but it's expensive.`,
      tips: [
        'Attribute points only go on the eight physical and mental attributes.',
        `Adjustment points go on Edge${magicType.attribute ? `, ${magicType.attribute === 'magic' ? 'Magic' : 'Resonance'}` : ''} and attributes your metatype can raise above 6 (like a troll’s Body).`,
        'Only one attribute may start at its maximum.',
        `Karma costs the new rating × ${CREATION_RULES.karmaPerRating} per step, so spend points first and karma last.`,
        'Body and Willpower set how much damage you can take. Edge is your luck: you spend it during play to boost rolls.',
      ],
      roleAdvice: role?.advice.attributes,
      roleActions: role && (
        <p className="text-sm text-muted">
          Key attributes are marked with <span className="text-accent">★</span> in the table below.
        </p>
      ),
      checklist: [
        {
          done: evaluation.attributePoints.remaining === 0,
          label: `Attribute points spent (${evaluation.attributePoints.remaining} left)`,
        },
        {
          done: evaluation.adjustmentPoints.remaining === 0,
          label: `Adjustment points spent (${evaluation.adjustmentPoints.remaining} left)`,
        },
        {
          done: !hasError(evaluation, /maximum|Adjustment points can't|Attribute points can't/),
          label: 'Within maximums',
        },
      ],
      content: <AttributesSection {...buildProps} highlight={role?.keyAttributes} />,
    },
    {
      id: 'skills',
      title: 'Skills',
      rules: 'skills',
      intro: `Spend ${evaluation.skillPoints.total} skill points on active skills, then add knowledge skills and languages.`,
      tips: [
        `Your dice pool is skill + attribute. Ratings go up to ${CREATION_RULES.maxSkillRating} at creation, and only one skill may be at ${CREATION_RULES.maxSkillRating}.`,
        `A specialization (e.g. "Pistols" for Firearms) costs ${CREATION_RULES.specializationSkillPoints} point and gives +2 dice. It's the best deal in the game.`,
        'You can roll many skills without training at attribute −1, but magic and hacking skills need training.',
        'Perception is useful for every runner.',
        `Knowledge skills (e.g. "Seattle gangs") and languages are free up to your Logic, plus your native language.`,
      ],
      roleAdvice: role?.advice.skills,
      roleActions: role && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={() => addSuggestedSkills(role)}>
            <Plus className="size-4" /> Add suggested skills
          </button>
          <span className="text-xs text-muted">
            {role.keySkills.map((s) => SKILLS_BY_ID.get(s)?.name ?? s).join(', ')}
          </span>
        </div>
      ),
      checklist: [
        {
          done: evaluation.skillPoints.remaining === 0,
          label: `Skill points spent (${evaluation.skillPoints.remaining} left)`,
        },
        {
          done: !hasError(evaluation, /skills are at rating|above the creation maximum/),
          label: 'Within skill limits',
        },
        { done: character.languages.some((l) => l.level === 'native'), label: 'Native language added' },
        {
          done: evaluation.freeKnowledge.remaining <= 0,
          label: `Free knowledge skills used (${Math.max(0, evaluation.freeKnowledge.remaining)} left)`,
        },
      ],
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
      intro: 'Qualities are the edges and flaws that make your runner unique.',
      tips: [
        'Positive qualities cost karma. Negative qualities give you karma to spend elsewhere.',
        'Only take a negative quality you’ll enjoy playing. Your GM will use it against you.',
        'A few good qualities beat many small ones. Keep some karma for skills and spells.',
        booksTip,
      ],
      roleAdvice: role?.advice.qualities ?? (role ? 'Popular picks for your role:' : undefined),
      roleActions: role && chips(role.qualities),
      checklist: [
        { done: character.qualities.length > 0, label: 'At least one quality' },
        { done: evaluation.karma.remaining >= 0, label: `Karma not overspent (${evaluation.karma.remaining} left)` },
      ],
      content: <QualitiesSection {...props} />,
    },
    ...(magicType.attribute
      ? [
          {
            id: 'magic',
            title: magicType.attribute === 'resonance' ? 'Resonance' : 'Magic',
            rules: 'magic' as const,
            intro:
              magicType.attribute === 'resonance'
                ? 'Choose the complex forms you can thread in the Matrix.'
                : build.magicType === 'adept'
                  ? 'Choose adept powers. You have power points equal to your Magic.'
                  : 'Choose your spells' + (build.magicType === 'mysticAdept' ? ' and adept powers.' : '.'),
            tips:
              magicType.attribute === 'resonance'
                ? [
                    'Each complex form costs karma at creation.',
                    'Using a complex form causes fading, which you resist with Willpower + Logic.',
                    'You don’t need a cyberdeck: your living persona is built from your Resonance and mental attributes.',
                    booksTip,
                  ]
                : build.magicType === 'adept'
                  ? [
                      'Each power has a power point cost; some cost per level.',
                      'Essence loss from cyberware lowers your Magic, and with it your power points.',
                      booksTip,
                    ]
                  : [
                      'Each spell costs karma. Start with a handful you’ll actually use.',
                      'Casting causes drain, resisted with Willpower + your tradition attribute. Higher-drain spells hurt more.',
                      'A mix works well: one or two attack spells, a heal, and something for stealth or detection.',
                      booksTip,
                    ],
            roleAdvice: role?.advice.magic,
            roleActions: role && chips(role.magic),
            checklist: [
              {
                done: character.spells.length + character.adeptPowers.length + character.complexForms.length > 0,
                label: 'Something chosen',
              },
              { done: !hasError(evaluation, /power points/), label: 'Power points within Magic' },
              {
                done: evaluation.karma.remaining >= 0,
                label: `Karma not overspent (${evaluation.karma.remaining} left)`,
              },
            ],
            content:
              magicType.attribute === 'resonance' ? <ComplexFormsSection {...props} /> : <MagicSection {...props} />,
          },
        ]
      : []),
    {
      id: 'gear',
      title: 'Gear',
      rules: 'gear',
      intro: `Spend your ${evaluation.nuyen.total.toLocaleString()}¥ on weapons, armor, augmentations and tools.`,
      tips: [
        'Armor adds to your Defense Rating. Tick "Worn" on the armor you actually wear.',
        'Everyone needs a commlink. Deckers need a cyberdeck, riggers a control rig and RCC.',
        `Augmentations cost Essence${magicType.attribute ? ` and lower your ${magicType.attribute === 'magic' ? 'Magic' : 'Resonance'}` : ''}. Better grades (alpha, beta) cost less Essence but more money.`,
        `Short on money? Convert up to ${CREATION_RULES.maxKarmaForNuyen} karma into ${CREATION_RULES.nuyenPerKarma.toLocaleString()}¥ each on the Review step.`,
        booksTip,
      ],
      roleAdvice: role?.advice.gear,
      roleActions: role && chips(role.gear),
      checklist: [
        { done: character.weapons.length > 0, label: 'A weapon' },
        { done: character.gear.some((g) => g.armor > 0 && g.equipped), label: 'Armor, worn' },
        { done: character.matrixDevices.length > 0, label: 'A commlink or deck' },
        {
          done: evaluation.nuyen.remaining >= 0,
          label: `Within budget (${evaluation.nuyen.remaining.toLocaleString()}¥ left)`,
        },
      ],
      content: (
        <>
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
      intro: 'Contacts are the people your runner knows. They find work, sell gear and answer questions.',
      tips: [
        'Connection is how powerful and well-connected the contact is. Loyalty is how much they like you.',
        `You get ${evaluation.freeContactKarma.total} free karma for contacts (Charisma × ${CREATION_RULES.contactKarmaPerCharisma}). Each contact costs Connection + Loyalty.`,
        'Every runner should know a fixer: the person who finds jobs and pays you.',
        'Give contacts a name and a line of personality. They make great story hooks.',
      ],
      roleAdvice: role?.advice.contacts ?? (role ? `Useful contacts: ${role.contacts.join(', ')}.` : undefined),
      roleActions: role && (
        <button className="btn btn-primary" onClick={() => addSuggestedContacts(role)}>
          <Plus className="size-4" /> Add {role.contacts.join(', ')}
        </button>
      ),
      checklist: [
        { done: character.contacts.length > 0, label: 'At least one contact' },
        { done: character.contacts.some((c) => /fixer/i.test(c.role)), label: 'A fixer' },
        {
          done: evaluation.freeContactKarma.remaining <= 0,
          label: `Free contact karma used (${Math.max(0, evaluation.freeContactKarma.remaining)} left)`,
        },
      ],
      content: <ContactsSection {...props} />,
    },
    {
      id: 'review',
      title: 'Review',
      rules: 'finishing',
      intro:
        errors.length > 0
          ? 'Almost there. Fix the problems in red, then finish the build.'
          : 'Everything adds up. Check your sheet, then finish the build to start playing.',
      tips: [
        'Leftover karma and nuyen become your starting resources when you finish.',
        'Look at the Sheet tab to see your dice pools before you commit.',
        'After finishing you can still edit everything; the build rules just stop checking.',
      ],
      checklist: [
        { done: errors.length === 0, label: errors.length ? `${errors.length} problem(s) to fix` : 'No problems' },
        { done: evaluation.karma.remaining >= 0, label: `Karma: ${evaluation.karma.remaining} left` },
        { done: evaluation.nuyen.remaining >= 0, label: `Nuyen: ${evaluation.nuyen.remaining.toLocaleString()}¥ left` },
      ],
      content: (
        <>
          <KarmaSection build={build} evaluation={evaluation} updateBuild={updateBuild} />
          <section className="card relative flex flex-wrap items-center gap-3 overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-10 -bottom-16 size-48 rounded-full bg-accent/15 blur-3xl" />
            <div className="mr-auto">
              <div className="font-display text-xl">Ready to hit the streets?</div>
              <p className="text-sm text-muted">
                Check the{' '}
                <Link to=".." relative="path" className="text-accent hover:underline">
                  Sheet
                </Link>{' '}
                first if you want to see your dice pools.
              </p>
            </div>
            <button
              className="btn btn-primary px-4 py-2"
              disabled={errors.length > 0}
              onClick={() => {
                if (confirm('Finish the build? Leftover karma and nuyen become starting resources.')) {
                  update(finishBuild)
                  navigate('..', { relative: 'path' })
                }
              }}
            >
              <Flag className="size-4" /> Finish build
            </button>
          </section>
        </>
      ),
    },
  ]

  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === params.get('step')),
  )
  const step = steps[index]
  const go = (i: number) => {
    setParams({ step: steps[i].id }, { replace: true })
    window.scrollTo({ top: 0 })
  }
  const rulesPage = step.rules ? rules[step.rules] : undefined
  const stepDone = (s: Step) => s.checklist.every((c) => c.done)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Build steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(i)}
            aria-current={i === index ? 'step' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              i === index
                ? 'border-accent bg-accent/20 text-accent'
                : stepDone(s)
                  ? 'border-accent/30 text-fg'
                  : 'border-line text-muted hover:text-fg'
            }`}
          >
            <span
              className={`grid size-4 place-items-center rounded-full text-[10px] ${stepDone(s) ? 'bg-accent text-bg' : 'bg-raised'}`}
            >
              {stepDone(s) ? '✓' : i + 1}
            </span>
            {s.title}
          </button>
        ))}
      </nav>

      <BudgetBar evaluation={evaluation} />

      <div>
        <div className="text-xs tracking-widest text-muted uppercase">
          Step {index + 1} of {steps.length}
        </div>
        <h2 className="font-display text-3xl font-semibold">{step.title}</h2>
        <p className="mt-1 max-w-3xl text-muted">{step.intro}</p>
        {rulesPage && (
          <Link
            to={`/book/${rulesPage.book.id}?pdf=${rulesPage.page}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <BookOpen className="size-4" /> Read the rules ({rulesPage.book.code || rulesPage.book.title}{' '}
            {pdfPageToPrinted(rulesPage.book, rulesPage.page)})
          </Link>
        )}
      </div>

      <GuidePanel
        tips={step.tips}
        role={role}
        roleAdvice={step.roleAdvice}
        actions={step.roleActions}
        checklist={step.checklist}
      />

      {(step.id === 'review' || errors.length > 0) && <IssueList evaluation={evaluation} />}

      <div className="flex min-w-0 flex-col gap-4">{step.content}</div>

      <div className="flex justify-between gap-3 border-t border-line pt-4">
        <button className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
          <ArrowLeft className="size-4" /> Back
        </button>
        {index < steps.length - 1 && (
          <button className="btn btn-primary" onClick={() => go(index + 1)}>
            Next: {steps[index + 1].title} <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
