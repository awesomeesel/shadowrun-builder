import { CalendarClock, GraduationCap, HeartPulse, House, Plus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { noAutofillField } from '../../../components/noAutofill'
import { NumberInput } from '../../../components/ui'
import { LifestyleSchema } from '../../../model/character'
import {
  applyDowntime,
  BRIBE_PER_HEAT,
  CONTACT_HEAT,
  daysLeft,
  DOWNTIME_LENGTHS,
  downtimeOutcome,
  emptyPlan,
  formatDays,
  heatContacts,
  LIFESTYLE_LEVELS,
  lieLowHeat,
  passDays,
  paysRent,
  reputationCost,
  WORK_RATE,
  type DowntimePlan,
} from '../../../rules/sr6/downtime'
import type { CharacterContext } from '../CharacterPage'
import { HealDialog } from './HealDialog'
import { Counter } from './RollStep'

const yen = (n: number) => `${n.toLocaleString()}¥`
const signed = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString()}${unit}`

/**
 * Time between runs: how long it is, rent for the lifestyle, and what the
 * runner does with it (lowering Heat, Reputation, side work, favors), with
 * healing and training a click away. Applied all at once and logged.
 */
export function DowntimeDialog({ character, update, onClose }: CharacterContext & { onClose: () => void }) {
  const [plan, setPlan] = useState<DowntimePlan>(() => emptyPlan(7))
  const [healing, setHealing] = useState(false)
  const set = (change: Partial<DowntimePlan>) => setPlan((p) => ({ ...p, ...change }))
  const outcome = downtimeOutcome(character, plan)
  const nuyenAfter = character.nuyen + outcome.nuyen
  const karmaAfter = character.karma.available + outcome.karma
  const weeks = Math.floor(plan.days / 7)
  const contacts = heatContacts(character)
  const hurt = character.damage.physical + character.damage.stun + character.damage.overflow > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !healing && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, healing])

  const done = () => {
    update((c) => applyDowntime(c, plan))
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="card max-h-[94vh] w-full max-w-2xl overflow-y-auto p-5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Downtime"
        >
          <h2 className="flex items-center gap-2 font-display text-xl">
            <CalendarClock className="size-5 text-accent" /> Downtime
          </h2>
          <p className="mt-1 text-sm text-muted">
            Time between runs. Pick how long it is and what your runner does with it; nothing changes until you press
            Done.
          </p>

          <Block title="How long?">
            <div className="flex flex-wrap items-center gap-1.5">
              {DOWNTIME_LENGTHS.map((l) => (
                <button
                  key={l.days}
                  className={`chip cursor-pointer ${plan.days === l.days ? 'border-accent bg-accent/15 text-accent' : 'text-muted hover:text-fg'}`}
                  onClick={() => set({ days: l.days })}
                >
                  {l.label}
                </button>
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs text-muted">
                <span className="w-20">
                  <NumberInput value={plan.days} min={1} max={365} onChange={(days) => set({ days })} />
                </span>
                days
              </label>
            </div>
          </Block>

          <Block title="Lifestyle" icon={<House className="size-4" />}>
            {character.lifestyles.length === 0 ? (
              <div>
                <p className="mb-2 text-muted">No lifestyle yet: your runner sleeps on the street. Pick one:</p>
                <div className="flex flex-wrap gap-1.5">
                  {LIFESTYLE_LEVELS.map((l) => (
                    <button
                      key={l.name}
                      className="chip cursor-pointer text-muted hover:text-fg"
                      onClick={() =>
                        update((c) => ({
                          ...c,
                          lifestyles: [
                            ...c.lifestyles,
                            LifestyleSchema.parse({ name: l.name, level: l.name, cost: l.cost }),
                          ],
                        }))
                      }
                    >
                      {l.name} · {l.cost ? `${yen(l.cost)}/month` : 'free'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="grid gap-2">
                {character.lifestyles.map((l) => {
                  const name = l.name || l.level || 'Lifestyle'
                  if (!paysRent(l)) {
                    return (
                      <li key={l.id} className="rounded-lg border border-line bg-bg/40 p-2.5">
                        <span className="font-semibold">{name}</span>{' '}
                        <span className="text-muted">· free, nothing to pay</span>
                      </li>
                    )
                  }
                  const months = plan.rent[l.id] ?? 0
                  const after = passDays({ ...l, monthsPaid: l.monthsPaid + months }, plan.days)
                  return (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-bg/40 p-2.5"
                    >
                      <div className="min-w-40 flex-1">
                        <div>
                          <span className="font-semibold">{name}</span>
                          {l.level && l.level !== l.name && <span className="text-muted"> · {l.level}</span>}
                          <span className="text-muted"> · {yen(l.cost)}/month</span>
                        </div>
                        <div className="text-xs text-muted">
                          Paid for {formatDays(daysLeft(l))} now
                          {after.ranOutAfter !== null ? (
                            <span className="text-amber">
                              {' '}
                              · runs out {after.ranOutAfter ? `after ${formatDays(after.ranOutAfter)}` : 'at once'}; pay
                              rent or live on the street
                            </span>
                          ) : (
                            <> · {formatDays(daysLeft(after.lifestyle))} left afterwards</>
                          )}
                        </div>
                      </div>
                      <Counter
                        label={months ? `Pay ${yen(months * l.cost)}` : 'Months to pay'}
                        value={months}
                        max={12}
                        onChange={(n) => set({ rent: { ...plan.rent, [l.id]: n } })}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </Block>

          <Block title={`Heat ${character.heat} · Reputation ${character.reputation}`}>
            <div className="grid gap-3">
              <label className={`flex items-start gap-2 ${plan.days < 30 ? 'opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-accent"
                  checked={plan.lieLow}
                  disabled={plan.days < 30 || character.heat === 0}
                  onChange={(e) => set({ lieLow: e.target.checked })}
                />
                <span>
                  Lie low: no runs in this time
                  <span className="block text-xs text-muted">
                    Heat −1 for each month without work, at most 3 in a year (CRB p. 237).
                    {plan.days < 30 ? ' Needs a month or more.' : ` This time: −${lieLowHeat(plan.days)}.`}
                  </span>
                </span>
              </label>
              {contacts.length > 0 && (
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">
                    Ask a cop or corp-security contact (Connection 3+) to bury your record: Heat −{CONTACT_HEAT}, their
                    Loyalty −1 (CRB p. 236)
                  </span>
                  <select
                    className="input w-full"
                    value={plan.heatContact ?? ''}
                    onChange={(e) => set({ heatContact: e.target.value || null })}
                    disabled={character.heat === 0}
                  >
                    <option value="">Nobody</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || 'Unnamed'}
                        {c.role ? ` (${c.role})` : ''} · C{c.connection} L{c.loyalty}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-6">
                <div>
                  <Counter
                    label={`Bribes (${yen(BRIBE_PER_HEAT)} per Heat)`}
                    value={plan.bribes}
                    max={character.heat}
                    onChange={(bribes) => set({ bribes })}
                  />
                  <p className="mt-1 text-xs text-muted">CRB p. 237</p>
                </div>
                <div>
                  <Counter
                    label="Work on Reputation"
                    value={plan.reputation}
                    max={5}
                    onChange={(reputation) => set({ reputation })}
                  />
                  <p className="mt-1 max-w-56 text-xs text-muted">
                    {plan.reputation
                      ? `${yen(reputationCost(character.reputation, plan.reputation).nuyen)} and ${plan.reputation} karma; about ${formatDays(plan.reputation * 14)} of parties, charity or favors (SWC p. 193).`
                      : '1,000¥ × the new level + 1 karma each, about 2 weeks (SWC p. 193).'}
                  </p>
                </div>
              </div>
            </div>
          </Block>

          <Block title="Side work and favors" hint="Optional rules: ask your GM.">
            <div className="flex flex-wrap gap-6">
              <div>
                <Counter
                  label="Working for the Man (weeks)"
                  value={plan.workForTheMan}
                  max={Math.max(0, Math.min(weeks, character.karma.available))}
                  onChange={(workForTheMan) => set({ workForTheMan })}
                />
                <p className="mt-1 max-w-52 text-xs text-muted">
                  Corporate odd jobs: 1 karma → {yen(WORK_RATE)} a week (SWC p. 153).
                </p>
              </div>
              <div>
                <Counter
                  label="Working for the People (weeks)"
                  value={plan.workForThePeople}
                  max={weeks}
                  onChange={(workForThePeople) => set({ workForThePeople })}
                />
                <p className="mt-1 max-w-52 text-xs text-muted">
                  Helping the street: {yen(WORK_RATE)} → 1 karma a week (SWC p. 153).
                </p>
              </div>
            </div>
            {character.contacts.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs text-muted">
                  Buy a favor from a contact: 1 karma or 1,000¥ × Connection, one a week (SWC p. 172).
                </div>
                <ul className="grid gap-1">
                  {character.contacts.map((c) => {
                    const bought = plan.favors.filter((f) => f.contactId === c.id)
                    const full = plan.favors.length >= weeks
                    return (
                      <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md bg-bg/50 px-2 py-1">
                        <span className="min-w-0 flex-1 truncate">
                          {c.name || 'Unnamed'}
                          {c.role && <span className="text-muted"> · {c.role}</span>}
                          {bought.length > 0 && <span className="text-accent"> · +{bought.length} favor</span>}
                        </span>
                        <button
                          className="btn px-2 py-0.5 text-xs"
                          disabled={full || karmaAfter < 1}
                          onClick={() => set({ favors: [...plan.favors, { contactId: c.id, pay: 'karma' }] })}
                        >
                          <Plus className="size-3" /> 1 karma
                        </button>
                        <button
                          className="btn px-2 py-0.5 text-xs"
                          disabled={full}
                          onClick={() => set({ favors: [...plan.favors, { contactId: c.id, pay: 'nuyen' }] })}
                        >
                          <Plus className="size-3" /> {yen(1_000 * c.connection)}
                        </button>
                        {bought.length > 0 && (
                          <button
                            className="text-muted hover:text-danger"
                            aria-label={`Take back a favor from ${c.name || 'this contact'}`}
                            onClick={() => {
                              const i = plan.favors.lastIndexOf(bought[bought.length - 1])
                              set({ favors: plan.favors.filter((_, j) => j !== i) })
                            }}
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </Block>

          <Block title="Healing and training">
            <div className="grid gap-2">
              {hurt && (
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn text-xs" onClick={() => setHealing(true)}>
                    <HeartPulse className="size-4" /> Rest and heal…
                  </button>
                  <span className="text-xs text-muted">Roll natural healing for the days you rest.</span>
                </div>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <Link to="../karma" relative="path" className="btn text-xs" onClick={onClose}>
                  <GraduationCap className="size-4" /> Spend karma…
                </Link>
                <p className="min-w-60 flex-1 text-xs text-muted">
                  Training takes time, about 4 hours a day, up to three things at once (CRB p. 68): a skill rank takes
                  as many months as the new rank, an attribute twice that; a specialization or knowledge skill a month;
                  a quality, spell or complex form a week.
                </p>
              </div>
            </div>
          </Block>

          <Block title="Anything else?">
            <textarea
              {...noAutofillField}
              className="input min-h-20 w-full"
              placeholder="Fenced the loot, visited family, fixed up the car…"
              value={plan.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Block>

          <div className="mt-4 rounded-lg border border-line bg-bg/40 p-3 text-sm">
            <h3 className="mb-1.5 text-xs tracking-wider text-muted uppercase">After {formatDays(plan.days)}</h3>
            {outcome.lines.length > 0 && (
              <ul className="mb-2 grid gap-0.5">
                {outcome.lines.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">{l.note}</span>
                    {l.nuyen !== 0 && (
                      <span className={`tabular-nums ${l.nuyen > 0 ? 'text-accent' : 'text-danger'}`}>
                        {signed(l.nuyen, '¥')}
                      </span>
                    )}
                    {l.karma !== 0 && (
                      <span className={`tabular-nums ${l.karma > 0 ? 'text-amber' : 'text-danger'}`}>
                        {signed(l.karma)} karma
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
              <span>
                Nuyen <strong>{yen(nuyenAfter)}</strong>
              </span>
              <span>
                Karma <strong>{karmaAfter}</strong>
              </span>
              <span>
                Heat <strong>{character.heat + outcome.heat}</strong>
              </span>
              <span>
                Reputation <strong>{character.reputation + outcome.reputation}</strong>
              </span>
            </div>
            {nuyenAfter < 0 && <p className="mt-1 text-xs text-amber">That’s more nuyen than you have.</p>}
            {karmaAfter < 0 && <p className="mt-1 text-xs text-danger">That’s more karma than you have.</p>}
            {outcome.busyDays > plan.days && (
              <p className="mt-1 text-xs text-amber">
                Those activities take about {formatDays(outcome.busyDays)}, longer than the downtime.
              </p>
            )}
            {outcome.ranOut.map((r) => (
              <p key={r.name} className="mt-1 text-xs text-amber">
                Rent for {r.name} runs out {r.day ? `after ${formatDays(r.day)}` : 'at once'}.
              </p>
            ))}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={done} disabled={karmaAfter < 0}>
              <CalendarClock className="size-4" /> Done: {formatDays(plan.days)} pass
            </button>
          </div>
        </div>
      </div>
      {healing && <HealDialog character={character} update={update} initial="rest" onClose={() => setHealing(false)} />}
    </>
  )
}

function Block({
  title,
  icon,
  hint,
  children,
}: {
  title: string
  icon?: ReactNode
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="mt-4 border-t border-line pt-3 text-sm">
      <h3 className="mb-2 flex items-center gap-2 text-xs tracking-wider text-muted uppercase">
        {icon} {title}
        {hint && <span className="tracking-normal normal-case">· {hint}</span>}
      </h3>
      {children}
    </section>
  )
}
