import {
  Car,
  CircleCheck,
  Circle,
  CircleHelp,
  Cpu,
  Feather,
  Flame,
  Footprints,
  Lightbulb,
  MessagesSquare,
  Radio,
  Swords,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ROLES, type RoleDef } from '../../rules/sr6/roles'

const ROLE_ICONS: Record<string, ReactNode> = {
  samurai: <Swords className="size-5" />,
  adept: <Zap className="size-5" />,
  mage: <Flame className="size-5" />,
  shaman: <Feather className="size-5" />,
  decker: <Cpu className="size-5" />,
  technomancer: <Radio className="size-5" />,
  rigger: <Car className="size-5" />,
  face: <MessagesSquare className="size-5" />,
  infiltrator: <Footprints className="size-5" />,
}

export interface CheckItem {
  done: boolean
  label: string
}

/**
 * The guidance box at the top of each wizard step: what you're deciding,
 * tips, advice for the chosen role and a live checklist.
 */
export function GuidePanel({
  tips,
  role,
  roleAdvice,
  actions,
  checklist,
}: {
  tips: ReactNode[]
  role: RoleDef | undefined
  roleAdvice?: string
  /** Buttons or suggestion chips for the chosen role. */
  actions?: ReactNode
  checklist: CheckItem[]
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
      <div className="card relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-accent/10 blur-2xl" />
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-accent uppercase">
          <Lightbulb className="size-4" /> Tips
        </h3>
        <ul className="grid gap-1.5 text-sm">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
              <span className="text-fg/90">{tip}</span>
            </li>
          ))}
        </ul>
        {role && (roleAdvice || actions) && (
          <div className="mt-4 rounded-lg border border-neon/30 bg-neon/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-neon uppercase">
              {ROLE_ICONS[role.id]} As a {role.name.toLowerCase()}
            </div>
            {roleAdvice && <p className="text-sm">{roleAdvice}</p>}
            {actions && <div className="mt-2">{actions}</div>}
          </div>
        )}
      </div>
      <div className="card p-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Checklist</h3>
        <ul className="grid gap-1.5 text-sm">
          {checklist.map((item) => (
            <li key={item.label} className={`flex items-start gap-2 ${item.done ? 'text-fg' : 'text-muted'}`}>
              {item.done ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0" />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Big tappable cards for choosing a runner role. */
export function RolePicker({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  return (
    <section className="card p-4">
      <h2 className="mb-1 font-display text-sm tracking-widest text-accent uppercase">What kind of runner?</h2>
      <p className="mb-3 text-sm text-muted">
        Pick the role closest to your idea. The wizard then suggests priorities, attributes, skills and gear for it. You
        can ignore every suggestion.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...ROLES, null].map((role) => {
          const id = role?.id ?? ''
          const active = value === id
          return (
            <button
              key={id || 'other'}
              onClick={() => onChange(id)}
              aria-pressed={active}
              className={`flex gap-3 rounded-lg border p-3 text-left transition-colors ${
                active ? 'border-accent bg-accent/10' : 'border-line bg-bg/50 hover:border-accent/50'
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-lg ${active ? 'bg-accent/20 text-accent' : 'bg-raised text-muted'}`}
              >
                {role ? ROLE_ICONS[role.id] : <CircleHelp className="size-5" />}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{role?.name ?? 'Something else'}</span>
                <span className="block text-xs text-muted">
                  {role?.blurb ?? 'No suggestions; build it your own way.'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
