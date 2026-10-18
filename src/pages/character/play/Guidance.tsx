import { Lightbulb, ScrollText, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { HelpButton } from '../../../components/Help'
import { SourceLink } from '../../../components/SourceLink'
import { Section } from '../../../components/ui'
import type { Character } from '../../../model/character'
import { PLAY_HELP } from '../../../rules/sr6/help'

const TIPS_KEY = 'playTipsHidden'

function tipsHidden(): boolean {
  try {
    return localStorage.getItem(TIPS_KEY) === '1'
  } catch {
    return false
  }
}

/** A short how-to for players new to the game, until they hide it. */
export function NewPlayerTips() {
  const [hidden, setHidden] = useState(tipsHidden)
  if (hidden) {
    return (
      <button
        className="flex items-center gap-1.5 justify-self-start text-xs text-muted hover:text-accent lg:col-span-2"
        onClick={() => {
          try {
            localStorage.removeItem(TIPS_KEY)
          } catch {
            // storage blocked
          }
          setHidden(false)
        }}
      >
        <Lightbulb className="size-3.5" /> Show the quick guide
      </button>
    )
  }
  return (
    <section className="card relative border-amber/40 bg-amber/5 p-4 text-sm lg:col-span-2">
      <button
        className="absolute top-3 right-3 text-muted hover:text-fg"
        onClick={() => {
          try {
            localStorage.setItem(TIPS_KEY, '1')
          } catch {
            // storage blocked
          }
          setHidden(true)
        }}
        aria-label="Hide the quick guide"
      >
        <X className="size-4" />
      </button>
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg">
        <Lightbulb className="size-5 text-amber" /> New to Shadowrun? The short version
      </h2>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        <li>
          <b>Rolling:</b> tap a pool, count 5s and 6s as hits. The GM says how many you need.{' '}
          <HelpButton entry={PLAY_HELP.howToRoll} className="align-middle" />
        </li>
        <li>
          <b>Fights:</b> roll Initiative under Combat. On your turn you get 1 Major and some Minor actions; the tracker
          counts them.
        </li>
        <li>
          <b>Attacking:</b> under Attack, pick the range and tap Attack. Your Attack Rating against their Defense Rating
          can earn you Edge.
        </li>
        <li>
          <b>Getting hit:</b> roll Defense. If they still hit, tap <i>Take damage…</i> and the app soaks it with your
          Body and fills the boxes.
        </li>
        <li>
          <b>Edge:</b> your luck points. Spend them before a roll on an Edge action, or after it to reroll or add hits.
        </li>
        <li>
          <b>Stuck?</b> Every ⓘ explains what you’re looking at, and{' '}
          <Link to="/rules" className="text-accent hover:underline">
            Rules
          </Link>{' '}
          has the basics with page numbers.
        </li>
      </ul>
    </section>
  )
}

/** The runner's qualities with what they do, so effects like High Pain Tolerance aren't forgotten mid-fight. */
export function QualityReminders({ character }: { character: Character }) {
  if (character.qualities.length === 0) return null
  return (
    <Section title="Your qualities" icon={<ScrollText className="size-4" />}>
      <ul className="grid gap-1.5 text-sm">
        {character.qualities.map((q) => (
          <li key={q.id}>
            <span className={q.kind === 'negative' ? 'text-danger' : 'text-accent'}>{q.name}</span>
            {q.rating > 1 && ` ${q.rating}`}
            {q.notes ? <span className="text-muted">: {q.notes}</span> : null}
            {q.source && <SourceLink source={q.source} className="ml-1.5" />}
          </li>
        ))}
      </ul>
      {character.qualities.some((q) => !q.notes) && (
        <p className="mt-2 text-xs text-muted">Add what a quality does in its notes on the Edit tab to see it here.</p>
      )}
    </Section>
  )
}
