import type { ReactNode } from 'react'
import type { Character } from '../../model/character'
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS } from '../../rules/sr6/attributes'
import { computeDerived, ownedSkillPools, weaponPool, type ConditionMonitor } from '../../rules/sr6/derived'
import { formatInitiative } from '../../rules/sr6/format'
import { METATYPES } from '../../rules/sr6/metatypes'
import { ammoCapacity } from '../../rules/sr6/play'
import { vehicleMonitor } from '../../rules/sr6/vehicles'

/** Most ammo boxes drawn per weapon; bigger magazines get a write-in field instead. */
const MAX_AMMO_BOXES = 40
const RANGES = ['Close', 'Near', 'Medium', 'Far', 'Extreme']

/**
 * The character on paper for pen-and-paper play: every number you roll, plus
 * empty boxes and lines for what changes at the table (damage, Edge, ammo,
 * sustained spells, spirits, Matrix damage, Overwatch, money and notes).
 * Only shown when printing.
 */
export function PlaySheet({ character }: { character: Character }) {
  const d = computeDerived(character)
  const metatype = METATYPES[character.metatype]
  const attributes = ATTRIBUTE_IDS.filter(
    (a) => !((a === 'magic' || a === 'resonance') && character.attributes[a] === 0),
  )
  const racial = metatype.qualities.filter(
    (r) => !character.qualities.some((q) => q.name.trim().toLowerCase() === r.name.toLowerCase()),
  )
  const awakened = character.attributes.magic > 0
  const hacker = !!d.matrix && (d.matrix.device?.kind !== 'commlink' || character.programs.length > 0)

  return (
    <div className="play-sheet hidden text-[10px] leading-snug text-black print:block">
      {/* Identity and resources */}
      <header className="mb-2 flex items-end justify-between gap-4 border-b-2 border-black pb-1">
        <div>
          <div className="font-display text-2xl leading-none font-bold">{character.name || 'Unnamed runner'}</div>
          <div>
            {[
              character.realName && `Real name: ${character.realName}`,
              metatype.name,
              character.concept,
              character.playerName && `Player: ${character.playerName}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="flex gap-3 text-right">
          <WriteIn label="Nuyen" now={`${character.nuyen.toLocaleString()}¥`} />
          <WriteIn label="Karma" now={String(character.karma.available)} />
          <WriteIn label="Heat" now={String(character.heat)} />
          <WriteIn label="Reputation" now={String(character.reputation)} />
        </div>
      </header>

      <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-2">
        {/* Attributes */}
        <Block title="Attributes" wide>
          <div className="grid grid-cols-11 gap-1 text-center">
            {attributes.map((a) => (
              <div key={a} className="rounded border border-black/60 px-0.5 py-0.5">
                <div className="text-[8px] uppercase">{ATTRIBUTE_LABELS[a].name}</div>
                <div className="text-sm font-bold">
                  {character.attributes[a]}
                  {d.attributes[a] !== character.attributes[a] && (
                    <span className="text-[9px] font-normal"> ({d.attributes[a]})</span>
                  )}
                </div>
              </div>
            ))}
            <div className="rounded border border-black/60 px-0.5 py-0.5">
              <div className="text-[8px] uppercase">Essence</div>
              <div className="text-sm font-bold">{d.essence}</div>
            </div>
          </div>
        </Block>

        {/* Condition and Edge */}
        <Block title="Condition">
          <Track label="Physical" monitor={d.physicalMonitor} modifiers />
          <Track label="Stun" monitor={d.stunMonitor} modifiers />
          <Track label="Overflow" monitor={d.overflow} />
          <div className="mt-1.5">
            <div className="mb-0.5 font-semibold">
              Edge <span className="font-normal">(rating {d.attributes.edge} in bold; never more than 7)</span>
            </div>
            <Boxes count={7} marked={d.attributes.edge} />
          </div>
        </Block>

        <Block title="Combat">
          <Lines
            rows={[
              ['Initiative', formatInitiative(d.initiative)],
              ['Defense Rating', String(d.defenseRating)],
              ['Defense (Reaction + Intuition)', String(d.pools.defense)],
              ['Damage resistance (Body)', String(d.pools.damageResistance)],
              ...(d.pools.physicalDamageResistance !== d.pools.damageResistance
                ? [['…against Physical', String(d.pools.physicalDamageResistance)] as [string, string]]
                : []),
              ['Unarmed', `${d.unarmedDamage.value}${d.unarmedDamage.type}, Attack Rating ${d.unarmedAttackRating}`],
              ['Composure', String(d.pools.composure)],
              ['Judge Intentions', String(d.pools.judgeIntentions)],
              ['Memory', String(d.pools.memory)],
              ['Lift / Carry', String(d.pools.liftCarry)],
            ]}
          />
          <p className="mt-1 text-[9px]">Wound modifier: −1 per full row of boxes; not on damage resistance.</p>
        </Block>

        {/* Weapons with ammo */}
        {character.weapons.length > 0 && (
          <Block title="Weapons" wide>
            <table className="w-full">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="font-semibold">Weapon</th>
                  <th className="text-center font-semibold">Dice</th>
                  <th className="text-center font-semibold">DV</th>
                  <th className="text-center font-semibold">Attack Ratings ({RANGES.join('/')})</th>
                  <th className="text-center font-semibold">Modes</th>
                  <th className="font-semibold">Ammo</th>
                </tr>
              </thead>
              <tbody>
                {character.weapons.map((w) => {
                  const pool = weaponPool(character, w).pool
                  const capacity = ammoCapacity(w)
                  return (
                    <tr key={w.id} className="border-b border-black/30 align-top">
                      <td className="py-0.5 pr-1">{w.name}</td>
                      <td className="text-center font-bold">{pool ?? '–'}</td>
                      <td className="text-center">{w.damage || '–'}</td>
                      <td className="text-center">{w.attackRatings.map((ar) => ar ?? '–').join(' / ')}</td>
                      <td className="text-center">{w.modes || '–'}</td>
                      <td className="py-0.5">
                        {capacity > 0 ? (
                          capacity <= MAX_AMMO_BOXES ? (
                            <Boxes count={capacity} small />
                          ) : (
                            <span>{w.ammo}: ______ left</span>
                          )
                        ) : (
                          '–'
                        )}
                        {capacity > 0 && <div className="text-[8px]">Spare: ____ · SA 2, BF 4, FA 10 rounds</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Block>
        )}

        {/* Skills */}
        <Block title="Skills">
          <table className="w-full">
            <tbody>
              {ownedSkillPools(character).map((p) => (
                <tr key={p.skill.id} className="border-b border-black/20">
                  <td className="py-px">
                    {p.skill.name} <span className="text-[8px]">({ATTRIBUTE_LABELS[p.skill.attribute].name})</span>
                    {p.owned?.specialization && <span className="text-[8px]"> · {p.owned.specialization} +2</span>}
                    {p.owned?.expertise && <span className="text-[8px]"> · {p.owned.expertise} +3</span>}
                  </td>
                  <td className="w-6 text-center">{p.rating}</td>
                  <td className="w-6 text-right font-bold">{p.pool ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(character.knowledgeSkills.length > 0 || character.languages.length > 0) && (
            <p className="mt-1">
              <span className="font-semibold">Knowledge:</span>{' '}
              {[
                ...character.knowledgeSkills.map((k) => k.name),
                ...character.languages.map((l) => `${l.name} (${l.level})`),
              ].join(', ')}
            </p>
          )}
        </Block>

        <Block title="Qualities, gear & augmentations">
          <List
            items={[
              ...racial.map((q) => `${q.name}${q.rating && q.rating > 1 ? ` ${q.rating}` : ''} (racial)`),
              ...character.qualities.map(
                (q) => `${q.name}${q.rating > 1 ? ` ${q.rating}` : ''}${q.kind === 'negative' ? ' (negative)' : ''}`,
              ),
            ]}
          />
          <div className="my-1 border-t border-black/30" />
          <List
            items={character.gear.map(
              (g) =>
                `${g.quantity > 1 ? `${g.quantity}× ` : ''}${g.name}${g.rating ? ` (rating ${g.rating})` : ''}${g.armor ? ` +${g.armor} Defense Rating${g.equipped ? ', worn' : ''}` : ''}`,
            )}
          />
          {character.augmentations.length > 0 && (
            <>
              <div className="my-1 border-t border-black/30" />
              <List
                items={character.augmentations.map(
                  (a) => `${a.name}${a.rating > 1 && !/\d\)?$/.test(a.name) ? ` ${a.rating}` : ''}`,
                )}
              />
            </>
          )}
        </Block>

        {/* Magic */}
        {awakened && (
          <Block title="Magic" wide>
            <p className="mb-1">
              Spellcasting {d.magic?.spellcasting ?? '–'} · Drain resistance {d.magic?.drainResistance ?? '–'}
              {d.magic?.summoning != null && ` · Summoning ${d.magic.summoning}`} · Astral initiative{' '}
              {formatInitiative(d.astralInitiative)}. Drain above Magic is Physical.
            </p>
            {character.spells.length > 0 && (
              <table className="mb-1 w-full">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="font-semibold">Spell</th>
                    <th className="font-semibold">Category</th>
                    <th className="font-semibold">Type</th>
                    <th className="font-semibold">Range</th>
                    <th className="font-semibold">Duration</th>
                    <th className="text-center font-semibold">Drain</th>
                  </tr>
                </thead>
                <tbody>
                  {character.spells.map((s) => (
                    <tr key={s.id} className="border-b border-black/20">
                      <td>{s.name}</td>
                      <td className="capitalize">{s.category}</td>
                      <td>{s.type === 'mana' ? 'Mana' : 'Physical'}</td>
                      <td>{s.range}</td>
                      <td>{s.duration}</td>
                      <td className="text-center font-bold">{s.drain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {character.initiateGrade > 0 && (
              <p className="mb-1">
                <span className="font-semibold">Initiate grade {character.initiateGrade}:</span>{' '}
                {character.metamagics.join(', ')}
                {d.magic?.centeringDice ? ` (Centering: +${d.magic.centeringDice} drain dice)` : ''}
              </p>
            )}
            {character.adeptPowers.length > 0 && (
              <p className="mb-1">
                <span className="font-semibold">Adept powers:</span>{' '}
                {character.adeptPowers.map((p) => `${p.name}${p.level ? ` ${p.level}` : ''}`).join(', ')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-semibold">Sustained spells (−2 dice each on action tests)</div>
                <BlankRows count={3} columns={['Spell', 'Hits']} />
              </div>
              <div>
                <div className="font-semibold">Spirits (total Force ≤ Magic × 3)</div>
                <BlankRows count={3} columns={['Type', 'Force', 'Services', 'Damage']} />
              </div>
            </div>
          </Block>
        )}

        {/* Matrix */}
        {d.matrix && hacker && (
          <Block title="Matrix" wide>
            <p className="mb-1">
              {d.matrix.parts.map((p) => p.name).join(' + ') || 'Living persona'} · Device rating{' '}
              {d.matrix.deviceRating} · Attack {d.matrix.attack} · Sleaze {d.matrix.sleaze} · Data Processing{' '}
              {d.matrix.dataProcessing} · Firewall {d.matrix.firewall} · Initiative AR{' '}
              {formatInitiative(d.matrix.arInitiative)}, cold-sim {formatInitiative(d.matrix.coldSimInitiative)},
              hot-sim {formatInitiative(d.matrix.hotSimInitiative)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                {d.matrix.device && <Track label="Matrix damage" monitor={{ boxes: d.matrix.monitor, filled: 0 }} />}
                <div className="mt-1 font-semibold">Overwatch Score (Convergence at 40)</div>
                <Boxes count={40} small perRow={20} />
              </div>
              {character.programs.length > 0 && (
                <div>
                  <div className="font-semibold">Programs (running ☐, {d.matrix.programSlots} slots)</div>
                  <div className="grid grid-cols-2">
                    {character.programs.map((p) => (
                      <div key={p.id}>☐ {p.name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {character.submersionGrade > 0 && (
              <p className="mt-1">
                <span className="font-semibold">Submersion grade {character.submersionGrade}:</span>{' '}
                {character.echoes.join(', ')}
              </p>
            )}
            {character.attributes.resonance > 0 && (
              <div className="mt-1">
                <div className="font-semibold">Sprites (Fading resisted with Willpower + Charisma)</div>
                <BlankRows count={2} columns={['Type', 'Level', 'Tasks', 'Damage']} />
              </div>
            )}
          </Block>
        )}

        {/* Vehicles and drones */}
        {character.vehicles.length > 0 && (
          <Block title="Vehicles & drones" wide>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {character.vehicles.map((v) => (
                <div key={v.id}>
                  <div className="font-semibold">{v.name}</div>
                  <div>
                    Handling {v.handling || '–'} · Body {v.body} · Armor {v.armor}
                    {v.kind === 'drone' && ` · Pilot ${v.pilot}`} · Sensor {v.sensor}
                    {v.autosofts && ` · ${v.autosofts}`}
                  </div>
                  <Track label="Damage (Handling +1 per 3 boxes)" monitor={{ boxes: vehicleMonitor(v), filled: 0 }} />
                </div>
              ))}
            </div>
          </Block>
        )}

        {/* Contacts and IDs */}
        {(character.contacts.length > 0 || character.sins.length > 0 || character.lifestyles.length > 0) && (
          <Block title="Contacts, SINs & lifestyle" wide>
            <div className="grid grid-cols-2 gap-4">
              <List
                items={character.contacts.map(
                  (c) =>
                    `${c.name || 'Unnamed'}${c.role ? ` (${c.role})` : ''}: Connection ${c.connection}, Loyalty ${c.loyalty}`,
                )}
              />
              <List
                items={[
                  ...character.sins.map((s) => `SIN: ${s.name} (rating ${s.rating})`),
                  ...character.licenses.map((l) => `License: ${l.name}${l.sin ? ` on ${l.sin}` : ''}`),
                  ...character.lifestyles.map(
                    (l) =>
                      `Lifestyle: ${l.name || l.level} (${l.level}), paid ${l.monthsPaid} ${l.monthsPaid === 1 ? 'month' : 'months'}`,
                  ),
                ]}
              />
            </div>
          </Block>
        )}

        {/* Session log */}
        <Block title="This run" wide>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold">Nuyen & karma</div>
              <BlankRows count={5} columns={['What', 'Nuyen', 'Karma']} />
            </div>
            <div>
              <div className="font-semibold">Notes</div>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-4 border-b border-black/40" />
              ))}
            </div>
          </div>
        </Block>
      </div>
    </div>
  )
}

function Block({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`break-inside-avoid ${wide ? 'col-span-2' : ''}`}>
      <h2 className="mb-1 border-b border-black font-display text-[11px] font-bold tracking-wider uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Current value plus a blank to write the new one. */
function WriteIn({ label, now }: { label: string; now: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase">{label}</div>
      <div>
        <span className="font-bold">{now}</span> → <span className="inline-block w-12 border-b border-black" />
      </div>
    </div>
  )
}

/** A row of empty boxes; `marked` shows a rating by outlining the first boxes thicker. */
function Boxes({
  count,
  marked = 0,
  small = false,
  perRow,
}: {
  count: number
  marked?: number
  small?: boolean
  perRow?: number
}) {
  const size = small ? 'size-2.5' : 'size-3.5'
  return (
    <div
      className="flex flex-wrap gap-0.5"
      style={perRow ? { maxWidth: `${perRow * (small ? 12 : 16)}px` } : undefined}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`${size} inline-block border ${i < marked ? 'border-2 border-black' : 'border-black/70'}`}
        />
      ))}
    </div>
  )
}

/** A condition monitor: boxes in rows of 3, with the wound modifier after each full row. */
function Track({
  label,
  monitor,
  modifiers = false,
}: {
  label: string
  monitor: ConditionMonitor
  modifiers?: boolean
}) {
  return (
    <div className="mb-1">
      <div className="font-semibold">
        {label} <span className="font-normal">({monitor.boxes} boxes)</span>
      </div>
      <div className="flex flex-wrap items-center gap-0.5">
        {Array.from({ length: monitor.boxes }, (_, i) => (
          <span key={i} className="flex items-center gap-0.5">
            <span className="inline-block size-3.5 border border-black/70" />
            {modifiers && i % 3 === 2 && <span className="mr-1 text-[8px]">−{(i + 1) / 3}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function Lines({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-black/20">
            <td className="py-px">{label}</td>
            <td className="text-right font-bold">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <div className="text-black/50">–</div>
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** Empty table rows to write in during play. */
function BlankRows({ count, columns }: { count: number; columns: string[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left text-[8px] uppercase">
          {columns.map((c) => (
            <th key={c} className="font-normal">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: count }, (_, i) => (
          <tr key={i} className="h-4 border-b border-black/40">
            {columns.map((c) => (
              <td key={c} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
