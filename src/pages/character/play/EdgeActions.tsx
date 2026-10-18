import { Flame, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { HelpButton } from '../../../components/Help'
import { SourceLink } from '../../../components/SourceLink'
import { Section } from '../../../components/ui'
import type { Character } from '../../../model/character'
import { BURN_EDGE, EDGE_ACTIONS, OTHER_EDGE_USES, PLAY_HELP, type EdgeActionTag } from '../../../rules/sr6/help'
import type { Update } from '../CharacterPage'

/** Which kinds of Edge actions fit this runner: melee for fighters, ranged for shooters, social for talkers. */
function tagsFor(character: Character): Set<EdgeActionTag> {
  const tags = new Set<EdgeActionTag>(['any', 'defense'])
  const skills = new Set(character.skills.filter((s) => s.rating > 0).map((s) => s.skillId))
  if (skills.has('close-combat') || character.weapons.some((w) => w.skillId === 'close-combat')) tags.add('melee')
  if (skills.has('firearms') || skills.has('exotic-weapons') || character.weapons.some((w) => w.skillId === 'firearms'))
    tags.add('ranged')
  // Talkers: a real social skill, not a token rank.
  if (character.skills.some((s) => (s.skillId === 'con' || s.skillId === 'influence') && s.rating >= 3))
    tags.add('social')
  return tags
}

/**
 * Edge actions to pick before rolling, and other ways to spend Edge. "Use"
 * takes the Edge off; the player tells the GM what they're doing.
 */
export function EdgeActions({
  character,
  update,
  edge,
  setEdge,
}: {
  character: Character
  update: Update
  edge: number
  setEdge: (value: number) => void
}) {
  const [all, setAll] = useState(false)
  const [used, setUsed] = useState('')
  const [open, setOpen] = useState('')
  const tags = tagsFor(character)
  const actions = EDGE_ACTIONS.filter((a) => all || tags.has(a.tag))
  const costs = [...new Set(actions.map((a) => a.cost))]
  const noEdge = character.qualities.some((q) => /distinctive style/i.test(q.name))

  const spend = (name: string, cost: number, extra?: (c: Character) => Character) => {
    setEdge(edge - cost)
    if (extra) update(extra)
    setUsed(`${name}: ${cost} Edge spent. Tell the GM before you roll.`)
  }
  const heal = (track: 'stun' | 'physical') => (c: Character) => ({
    ...c,
    damage: { ...c.damage, [track]: Math.max(0, c.damage[track] - 1) },
  })

  return (
    <Section title="Edge actions" icon={<Sparkles className="size-4" />} aside={<HelpButton entry={PLAY_HELP.edge} />}>
      <p className="mb-2 text-xs text-muted">
        Pick one <b className="text-fg">before</b> you roll, together with the action it goes with. Tap a name for what
        it does. You have <span className="text-amber">{edge} Edge</span>. After a roll, the result panel offers rerolls
        and extra hits.
      </p>
      {noEdge && (
        <p className="mb-2 text-xs text-amber">
          Distinctive Style: you can only gain or spend Edge while you’re in your signature look.
        </p>
      )}
      <div className="mb-3 flex gap-1.5 text-xs">
        <button
          className={`chip cursor-pointer ${!all ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
          onClick={() => setAll(false)}
        >
          For you
        </button>
        <button
          className={`chip cursor-pointer ${all ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
          onClick={() => setAll(true)}
        >
          All
        </button>
      </div>
      {used && <p className="mb-2 rounded bg-amber/10 px-2 py-1 text-xs text-amber">{used}</p>}
      <div className="grid gap-3">
        {costs.map((cost) => (
          <div key={cost}>
            <div className="mb-1 text-[11px] tracking-wider text-muted uppercase">{cost} Edge</div>
            <ul className="grid gap-1.5">
              {actions
                .filter((a) => a.cost === cost)
                .map((a) => (
                  <li key={a.name} className="rounded-lg border border-line bg-bg/40 text-sm">
                    <div className="flex items-center gap-2 p-2">
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setOpen(open === a.name ? '' : a.name)}
                        aria-expanded={open === a.name}
                      >
                        <span className="font-semibold">{a.name}</span>{' '}
                        <span className="text-xs text-muted">· {a.with}</span>
                      </button>
                      <button
                        className="btn shrink-0 px-2 py-1 text-xs"
                        disabled={edge < a.cost}
                        onClick={() => spend(a.name, a.cost)}
                        title={edge < a.cost ? `Needs ${a.cost} Edge` : `Spend ${a.cost} Edge`}
                      >
                        Use · {a.cost}
                      </button>
                    </div>
                    {open === a.name && (
                      <p className="border-t border-line/60 px-2 py-1.5 text-xs text-muted">
                        {a.text} <SourceLink source={{ book: 'CRB', page: a.page }} />
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs tracking-wider text-muted uppercase">
          Other ways to spend Edge
        </summary>
        <ul className="mt-2 grid gap-1.5">
          {OTHER_EDGE_USES.map((u) => {
            const healTrack = /Stun box/.test(u.name) ? 'stun' : /Physical box/.test(u.name) ? 'physical' : null
            return (
              <li key={u.name} className="flex items-start gap-2 rounded-lg bg-bg/40 p-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-muted">
                    {u.text} <SourceLink source={{ book: 'CRB', page: u.page }} />
                  </div>
                </div>
                <button
                  className="btn shrink-0 px-2 py-1 text-xs"
                  disabled={edge < u.cost || (healTrack !== null && character.damage[healTrack] === 0)}
                  onClick={() => spend(u.name, u.cost, healTrack ? heal(healTrack) : undefined)}
                >
                  Use · {u.cost}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 rounded-lg border border-danger/40 bg-danger/5 p-2">
          <div className="flex items-center gap-1.5 font-semibold text-danger">
            <Flame className="size-4" /> Burning Edge
          </div>
          <p className="mb-1 text-xs text-muted">
            A last resort: you lose 1 point of Edge rating for good, plus all the Edge you have now. Lower Edge on the
            Edit tab if you do. <SourceLink source={{ book: 'CRB', page: 48 }} />
          </p>
          <ul className="grid gap-0.5 text-xs">
            {BURN_EDGE.map((b) => (
              <li key={b.name}>
                <b>{b.name}</b>: {b.text}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </Section>
  )
}
