import { BarChart3, BookOpen, Flame, GraduationCap, Radio, Sparkles, Star, Target, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router'
import { AddFromBooks } from '../../components/CatalogPicker'
import { noAutofill, noAutofillField } from '../../components/noAutofill'
import { Stat } from '../../components/sheetParts'
import { NumberInput, Section } from '../../components/ui'
import { QualitySchema, type Character, type Quality } from '../../model/character'
import {
  ADVANCEMENT,
  addExpertise,
  addSpecialization,
  buy,
  buyQuality,
  learnComplexForm,
  learnKnowledge,
  learnLanguage,
  learnSpell,
  raiseAttribute,
  raiseSkill,
  removeNegativeQuality,
  whyNot,
  type Purchase,
} from '../../rules/sr6/advancement'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS } from '../../rules/sr6/attributes'
import { attributeMaximum } from '../../rules/sr6/metatypes'
import { SKILLS, SKILLS_BY_ID } from '../../rules/sr6/skills'
import type { CharacterContext } from './CharacterPage'

/** Spend karma between runs at the book's prices; every purchase goes into the karma history. */
export function KarmaTab() {
  const { character, update } = useOutletContext<CharacterContext>()
  /** Characters as they were before each purchase this visit, newest last, for Undo. */
  const [history, setHistory] = useState<{ before: Character; label: string }[]>([])

  const purchase = (p: Purchase) => {
    if (whyNot(character, p)) return
    setHistory((h) => [...h, { before: character, label: p.label }])
    update((c) => buy(c, p))
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    update(() => last.before)
  }
  const props = { character, purchase }
  const spent = character.ledger.filter((e) => e.purchase)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card flex flex-wrap items-center gap-4 p-4 lg:col-span-2">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Karma to spend" value={character.karma.available} tone="accent" large />
          <Stat label="Career karma" value={character.karma.career} large />
        </div>
        <p className="min-w-0 flex-1 text-sm text-muted">
          Spend karma earned on runs. Prices and suggested training times are from the Core Rulebook (pp. 67–68). Your
          GM decides when training is done.
        </p>
        {history.length > 0 && (
          <button className="btn" onClick={undo} title={`Undo: ${history[history.length - 1].label}`}>
            <Undo2 className="size-4" /> Undo “{history[history.length - 1].label}”
          </button>
        )}
      </section>

      <AttributesShop {...props} />
      <SkillsShop {...props} />
      <SpecializationShop {...props} />
      <KnowledgeShop {...props} />
      <QualitiesShop {...props} />
      {character.attributes.magic > 0 && <SpellShop {...props} />}
      {character.attributes.resonance > 0 && <ComplexFormShop {...props} />}

      {spent.length > 0 && (
        <Section title="Bought with karma" icon={<Sparkles className="size-4" />} className="lg:col-span-2">
          <ul className="grid gap-1 text-sm">
            {[...spent].reverse().map((e) => (
              <li key={e.id} className="flex gap-2 rounded-md bg-bg/50 px-2 py-1">
                <span className="min-w-0 flex-1 truncate">{e.note}</span>
                <span className="text-xs text-muted">{new Date(e.date).toLocaleDateString()}</span>
                <span className="text-danger tabular-nums">−{-e.karma} karma</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

interface ShopProps {
  character: Character
  purchase: (p: Purchase) => void
}

/** A buy button that shows the price, and why it's disabled when it is. */
function BuyButton({ character, purchase, p, children }: ShopProps & { p: Purchase; children?: ReactNode }) {
  const reason = whyNot(character, p)
  return (
    <button
      className="btn shrink-0 px-2.5 py-1 text-xs"
      disabled={!!reason}
      title={reason ?? `${p.label} · training ${p.training}`}
      onClick={() => purchase(p)}
    >
      {children ?? '+1'} <span className="text-amber">{p.cost} karma</span>
    </button>
  )
}

function AttributesShop(props: ShopProps) {
  const { character } = props
  const shown = ATTRIBUTE_IDS.filter((a) => (a !== 'magic' && a !== 'resonance') || character.attributes[a] > 0)
  return (
    <Section title="Attributes" icon={<BarChart3 className="size-4" />}>
      <p className="mb-2 text-xs text-muted">5 karma × the new rank. Training: new rank × 2 months.</p>
      <ul className="grid gap-1 text-sm">
        {shown.map((a) => {
          const p = raiseAttribute(character, a)
          const max =
            a === 'magic' || a === 'resonance' ? ADVANCEMENT.maxSpecialRank : attributeMaximum(character.metatype, a)
          return (
            <li key={a} className="flex items-center gap-2 border-t border-line/50 py-1 first:border-0">
              <span className="flex-1">{ATTRIBUTE_LABELS[a].name}</span>
              <span className="w-14 text-right tabular-nums">
                {character.attributes[a]}
                <span className="text-xs text-muted">/{max}</span>
              </span>
              <BuyButton {...props} p={p} />
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function SkillsShop(props: ShopProps) {
  const { character } = props
  const [newSkill, setNewSkill] = useState('')
  const unowned = SKILLS.filter((s) => !character.skills.some((o) => o.skillId === s.id))
  return (
    <Section title="Skills" icon={<Target className="size-4" />}>
      <p className="mb-2 text-xs text-muted">5 karma × the new rank, up to 9. Training: new rank in months.</p>
      <ul className="grid gap-1 text-sm">
        {character.skills.map((s) => (
          <li key={s.id} className="flex items-center gap-2 border-t border-line/50 py-1 first:border-0">
            <span className="flex-1">{SKILLS_BY_ID.get(s.skillId)?.name ?? s.skillId}</span>
            <span className="w-8 text-right tabular-nums">{s.rating}</span>
            <BuyButton {...props} p={raiseSkill(character, s.skillId)} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <select
          {...noAutofillField}
          className="input min-w-0 flex-1"
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          aria-label="New skill"
        >
          <option value="">Learn a new skill…</option>
          {unowned.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {newSkill && (
          <BuyButton {...props} p={raiseSkill(character, newSkill)}>
            Learn
          </BuyButton>
        )}
      </div>
    </Section>
  )
}

function SpecializationShop(props: ShopProps) {
  const { character } = props
  const [skillId, setSkillId] = useState('')
  const [text, setText] = useState('')
  const free = character.skills.filter((s) => !s.specialization)
  const ready = character.skills.filter((s) => s.specialization && !s.expertise)
  return (
    <Section title="Specializations & expertise" icon={<GraduationCap className="size-4" />}>
      <p className="mb-2 text-xs text-muted">
        {ADVANCEMENT.specialization} karma each. A specialization gives +2 dice; turning it into an expertise (+3, needs
        rank {ADVANCEMENT.expertiseMinRank}) lets you learn a new specialization. Training: 1 and 2 months.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          {...noAutofillField}
          className="input min-w-0 flex-1"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          aria-label="Skill to specialize"
        >
          <option value="">Skill…</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {SKILLS_BY_ID.get(s.skillId)?.name ?? s.skillId}
            </option>
          ))}
        </select>
        <input
          {...noAutofill}
          className="input min-w-0 flex-1"
          placeholder="e.g. Pistols"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Specialization"
        />
        <BuyButton
          {...props}
          purchase={(p) => {
            props.purchase(p)
            setText('')
            setSkillId('')
          }}
          p={addSpecialization(character, skillId, text)}
        >
          Learn
        </BuyButton>
      </div>
      {ready.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {ready.map((s) => (
            <li key={s.id} className="flex items-center gap-2 border-t border-line/50 py-1">
              <span className="flex-1">
                {SKILLS_BY_ID.get(s.skillId)?.name}: {s.specialization}
                <span className="text-xs text-muted"> · rank {s.rating}</span>
              </span>
              <BuyButton {...props} p={addExpertise(character, s.id)}>
                Make expertise
              </BuyButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function KnowledgeShop(props: ShopProps) {
  const [knowledge, setKnowledge] = useState('')
  const [language, setLanguage] = useState('')
  const row = (value: string, set: (v: string) => void, placeholder: string, p: Purchase) => (
    <div className="flex gap-2">
      <input
        {...noAutofill}
        className="input min-w-0 flex-1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-label={placeholder}
      />
      <BuyButton
        {...props}
        purchase={(x) => {
          props.purchase(x)
          set('')
        }}
        p={p}
      >
        Learn
      </BuyButton>
    </div>
  )
  return (
    <Section title="Knowledge & languages" icon={<BookOpen className="size-4" />}>
      <p className="mb-2 text-xs text-muted">
        {ADVANCEMENT.knowledge} karma each. Training: 1 month (3 if studying on the side).
      </p>
      <div className="grid gap-2">
        {row(knowledge, setKnowledge, 'Knowledge skill, e.g. Seattle gangs', learnKnowledge(knowledge))}
        {row(language, setLanguage, 'Language, e.g. Japanese', learnLanguage(language))}
      </div>
    </Section>
  )
}

function QualitiesShop(props: ShopProps) {
  const { character } = props
  const [pending, setPending] = useState<Quality | null>(null)
  const negative = character.qualities.filter((q) => q.kind === 'negative')
  return (
    <Section title="Qualities" icon={<Star className="size-4" />}>
      <p className="mb-2 text-xs text-muted">
        Positive qualities cost twice their karma; buying off a negative one costs twice its bonus. Training: 1 week.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <AddFromBooks
          kinds={['quality']}
          label="Pick a positive quality"
          onAdd={(list, item) => list === 'qualities' && setPending(item as Quality)}
        />
        <button
          className="btn w-full"
          onClick={() => setPending(QualitySchema.parse({ name: '', kind: 'positive', karma: 0 }))}
        >
          Type one in
        </button>
      </div>
      {pending && (
        <div className="mt-3 grid gap-2 rounded-lg border border-accent/40 bg-bg/40 p-2.5 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-0.5 block text-[11px] text-muted">Quality</span>
              <input
                {...noAutofill}
                className="input w-full"
                value={pending.name}
                onChange={(e) => setPending({ ...pending, name: e.target.value })}
              />
            </label>
            <label className="w-24">
              <span className="mb-0.5 block text-[11px] text-muted">Book karma</span>
              <NumberInput value={pending.karma} min={0} onChange={(karma) => setPending({ ...pending, karma })} />
            </label>
          </div>
          {whyNot(character, buyQuality(pending)) && (
            <p className="text-xs text-amber">{whyNot(character, buyQuality(pending))}</p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn px-2.5 py-1 text-xs" onClick={() => setPending(null)}>
              Cancel
            </button>
            <BuyButton
              {...props}
              purchase={(p) => {
                props.purchase(p)
                setPending(null)
              }}
              p={buyQuality(pending)}
            >
              Buy
            </BuyButton>
          </div>
        </div>
      )}
      {negative.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {negative.map((q) => (
            <li key={q.id} className="flex items-center gap-2 border-t border-line/50 py-1">
              <span className="flex-1 text-danger">{q.name}</span>
              <BuyButton {...props} p={removeNegativeQuality(character, q.id)}>
                Buy off
              </BuyButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function SpellShop(props: ShopProps) {
  const { character } = props
  const [name, setName] = useState('')
  return (
    <Section title="Spells" icon={<Flame className="size-4" />}>
      <p className="mb-2 text-xs text-muted">{ADVANCEMENT.spell} karma per spell. Training: 1 week.</p>
      <div className="grid gap-2">
        <AddFromBooks
          kinds={['spell']}
          label="Pick a spell from the books"
          onAdd={(list, item) =>
            list === 'spells' && props.purchase(learnSpell(character, item as Character['spells'][number]))
          }
        />
        <div className="flex gap-2">
          <input
            {...noAutofill}
            className="input min-w-0 flex-1"
            placeholder="Or type a spell name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <BuyButton
            {...props}
            purchase={(p) => {
              props.purchase(p)
              setName('')
            }}
            p={learnSpell(character, { name })}
          >
            Learn
          </BuyButton>
        </div>
      </div>
    </Section>
  )
}

function ComplexFormShop(props: ShopProps) {
  const { character } = props
  const [name, setName] = useState('')
  return (
    <Section title="Complex forms" icon={<Radio className="size-4" />}>
      <p className="mb-2 text-xs text-muted">{ADVANCEMENT.complexForm} karma per form. Training: 1 week.</p>
      <div className="grid gap-2">
        <AddFromBooks
          kinds={['complexForm']}
          label="Pick a complex form from the books"
          onAdd={(list, item) =>
            list === 'complexForms' &&
            props.purchase(learnComplexForm(character, item as Character['complexForms'][number]))
          }
        />
        <div className="flex gap-2">
          <input
            {...noAutofill}
            className="input min-w-0 flex-1"
            placeholder="Or type a complex form"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <BuyButton
            {...props}
            purchase={(p) => {
              props.purchase(p)
              setName('')
            }}
            p={learnComplexForm(character, { name })}
          >
            Learn
          </BuyButton>
        </div>
      </div>
    </Section>
  )
}
