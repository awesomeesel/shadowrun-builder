import { latestSheets } from '../share/campaigns'
import { TableFeed } from './TableFeed'
import { playerInitiative } from './feedRules'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Dices,
  Flag,
  Play,
  Square,
  SkipBack,
  SkipForward,
  UserPlus,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RollResult } from '../components/Dice'
import { noAutofill } from '../components/noAutofill'
import { db } from '../db/db'
import { CharacterSchema, migrateCharacter } from '../model/character'
import type { Encounter } from '../model/encounter'
import {
  canGoBack,
  combatantStats,
  endCombat,
  endRound,
  previousTurn,
  nextTurn,
  rollInitiative,
  startCombat,
  turnOrder,
  type CombatantStats,
} from '../rules/sr6/encounter'
import { boostRoll, EDGE_BOOSTS, rollPool, type EdgeBoost, type Roll } from '../rules/sr6/play'
import { AddCombatants } from './AddCombatants'
import { ParticipantCard } from './ParticipantCard'
import { useEncounter } from './useEncounter'

/** A roll made for someone in the fight, shown in the result panel. */
interface GmRoll {
  participantId: string
  label: string
  result: Roll
  info?: string
  bonus?: number
}

/** The GM's action screen: turn order, damage, actions, statuses and rolls for everyone in the fight. */
export function EncounterPage() {
  const { id = '' } = useParams()
  const { encounter, update } = useEncounter(id)
  const characters = useLiveQuery(async () =>
    (await db.characters.toArray()).flatMap((raw) => {
      const parsed = CharacterSchema.safeParse(migrateCharacter(raw))
      return parsed.success ? [parsed.data] : []
    }),
  )
  const [adding, setAdding] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const [roll, setRoll] = useState<GmRoll | null>(null)
  const [edgeNote, setEdgeNote] = useState('')

  const shared = useLiveQuery(() => db.sharedSheets.toArray())
  // Runners shared by players are linked as "shared:<sheet id>".
  const characterById = useMemo(
    () =>
      new Map([
        ...(characters ?? []).map((c) => [c.id, c] as const),
        ...(shared ?? []).map((s) => [`shared:${s.id}`, s.character] as const),
      ]),
    [characters, shared],
  )
  const stats = useMemo(() => {
    const map = new Map<string, CombatantStats>()
    for (const p of encounter?.participants ?? []) {
      map.set(p.id, combatantStats(p, p.characterId ? characterById.get(p.characterId) : undefined))
    }
    return map
  }, [encounter, characterById])

  if (encounter === undefined) return null
  if (encounter === null) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Encounter not found.</p>
        <Link to="/gm" className="btn">
          Back to the GM screen
        </Link>
      </div>
    )
  }

  const order = turnOrder(encounter, stats)
  const active = order.find((p) => p.id === encounter.activeId)
  const missingInitiative = encounter.participants.filter((p) => !p.out && p.initiative === null)
  // Live runners whose players rolled initiative on their own sheets.
  const playerRolls = missingInitiative.flatMap((p) => {
    const rolled = p.characterId?.startsWith('shared:') ? playerInitiative(characterById.get(p.characterId)) : null
    return rolled ? [{ id: p.id, name: p.name, value: rolled.value }] : []
  })
  const campaignRunners = encounter.campaignId
    ? latestSheets((shared ?? []).filter((s) => s.roomId === encounter.campaignId))
    : []

  const advance = (
    fn: (e: Encounter, s: Map<string, CombatantStats>) => { encounter: Encounter; messages: string[] },
  ) =>
    void update((e) => {
      const result = fn(e, stats)
      if (result.messages.length) setMessages(result.messages)
      return result.encounter
    })

  /** Edge available to whoever rolled: their own, or their grunt group's shared pool. */
  const edgeOf = (participantId: string) => {
    const p = encounter.participants.find((x) => x.id === participantId)
    if (!p) return 0
    return stats.get(p.id)?.isGrunt && p.group ? (encounter.groupEdge[p.group] ?? 0) : p.edge
  }
  const spendEdge = (participantId: string, cost: number) =>
    void update((e) => {
      const p = e.participants.find((x) => x.id === participantId)
      if (!p) return e
      if (stats.get(p.id)?.isGrunt && p.group) {
        return {
          ...e,
          groupEdge: { ...e.groupEdge, [p.group]: Math.max(0, (e.groupEdge[p.group] ?? 0) - cost) },
          // Grunt groups may use Edge once per round (p. 203); remember when they did.
          groupEdgeUsed: { ...e.groupEdgeUsed, [p.group]: e.round },
        }
      }
      return {
        ...e,
        participants: e.participants.map((x) =>
          x.id === participantId ? { ...x, edge: Math.max(0, x.edge - cost) } : x,
        ),
      }
    })

  const doRoll = (participantId: string, label: string, pool: number, info?: string, initiativeScore?: number) => {
    const result = rollPool(pool)
    setRoll({ participantId, label, result, info, bonus: initiativeScore })
    if (initiativeScore !== undefined) {
      const total = initiativeScore + result.dice.reduce((a, b) => a + b, 0)
      void update((e) => ({
        ...e,
        participants: e.participants.map((p) => (p.id === participantId ? { ...p, initiative: total } : p)),
      }))
    }
  }

  const boost = (kind: EdgeBoost, die: number) => {
    if (!roll) return
    const result = boostRoll(roll.result, kind, die)
    if (result === roll.result) return
    setRoll({ ...roll, result })
    spendEdge(roll.participantId, EDGE_BOOSTS[kind].cost)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-64 sm:px-8 sm:pb-10">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={encounter.campaignId ? `/gm/campaign/${encounter.campaignId}` : '/gm'}
            className="text-muted hover:text-fg"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <input
            {...noAutofill}
            className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold outline-none focus:text-accent"
            value={encounter.name}
            onChange={(e) => {
              const name = e.target.value
              void update((x) => ({ ...x, name }))
            }}
            aria-label="Encounter name"
          />
          <Link to="/rules" className="btn" target="_blank" title="Rules reference (opens in a new tab)">
            <BookOpen className="size-4" /> <span className="hidden sm:inline">Rules</span>
          </Link>
          <button className="btn" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Add
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-auto font-display text-lg">
            {encounter.round === 0 ? (
              <span className="text-muted">Not started</span>
            ) : (
              <>
                Round <span className="text-accent">{encounter.round}</span>
                {active && (
                  <span className="text-muted">
                    {' '}
                    · <span className="text-fg">{active.name}</span>’s turn
                  </span>
                )}
              </>
            )}
          </span>
          <button
            className="btn"
            disabled={encounter.participants.length === 0}
            onClick={() => void update((e) => rollInitiative(e, stats, false, undefined, e.round > 0))}
            title={
              encounter.round > 0
                ? 'Roll for newcomers without initiative'
                : 'Roll for everyone except the runners; a grunt group shares one roll'
            }
          >
            <Dices className="size-4" /> {encounter.round > 0 ? 'Roll for newcomers' : 'Roll NPC initiative'}
          </button>
          {encounter.round === 0 ? (
            <button
              className="btn btn-primary"
              disabled={encounter.participants.length === 0}
              onClick={() => void update((e) => startCombat(e, stats))}
              title={
                missingInitiative.length
                  ? `No initiative yet: ${missingInitiative.map((p) => p.name).join(', ')}`
                  : undefined
              }
            >
              <Play className="size-4" /> Start round 1
            </button>
          ) : (
            <>
              <button
                className="btn"
                disabled={!canGoBack(encounter, stats)}
                onClick={() => {
                  setMessages([])
                  void update((e) => previousTurn(e, stats))
                }}
                title="Undo the last Next turn or End round (damage marked since stays)"
              >
                <SkipBack className="size-4" /> Back
              </button>
              <button className="btn btn-primary" onClick={() => advance(nextTurn)}>
                <SkipForward className="size-4" /> Next turn
              </button>
              <button className="btn" onClick={() => advance(endRound)} title="Skip the remaining turns">
                <Flag className="size-4" /> End round
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (confirm('End the fight? The round counter resets; damage, statuses and initiative stay.')) {
                    setMessages([])
                    void update(endCombat)
                  }
                }}
                title="Stop the fight; you can start it again later"
              >
                <Square className="size-4" /> End fight
              </button>
            </>
          )}
        </div>
        {missingInitiative.length > 0 && encounter.participants.length > 0 && (
          <p className="mt-1 text-xs text-amber">
            No initiative yet: {missingInitiative.map((p) => p.name).join(', ')}.
            {playerRolls.length > 0 && (
              <button
                className="ml-2 text-accent underline"
                onClick={() =>
                  void update((e) => ({
                    ...e,
                    participants: e.participants.map((x) => {
                      const r = playerRolls.find((pr) => pr.id === x.id)
                      return r && x.initiative === null ? { ...x, initiative: r.value } : x
                    }),
                  }))
                }
              >
                Use what the players rolled ({playerRolls.map((r) => `${r.name} ${r.value}`).join(', ')})
              </button>
            )}
          </p>
        )}
      </header>

      {edgeNote && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-amber">
          <span className="mr-auto">{edgeNote}</span>
          <button className="text-muted hover:text-fg" onClick={() => setEdgeNote('')} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}
      {messages.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber/50 bg-amber/10 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-amber">End of round {encounter.round - 1}</span>
            <button className="text-muted hover:text-fg" onClick={() => setMessages([])} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
          <ul className="grid gap-0.5">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {encounter.participants.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nobody here yet.{' '}
          <button className="text-accent hover:underline" onClick={() => setAdding(true)}>
            Add enemies, spirits and runners
          </button>
          .
        </div>
      ) : (
        <ol className="grid gap-2">
          {order.map((p) => (
            <ParticipantCard
              key={p.id}
              participant={p}
              stats={stats.get(p.id)!}
              active={p.id === encounter.activeId}
              groupEdge={p.group ? encounter.groupEdge[p.group] : undefined}
              character={p.characterId ? characterById.get(p.characterId) : undefined}
              live={p.characterId?.startsWith('shared:')}
              update={update}
              onRoll={(label, pool, info, initiativeScore) => doRoll(p.id, label, pool, info, initiativeScore)}
              edgeUsedThisRound={
                !!p.group && encounter.round > 0 && encounter.groupEdgeUsed[p.group] === encounter.round
              }
              onEdgeAction={(label, cost) => {
                spendEdge(p.id, cost)
                setEdgeNote(`${p.name}: ${label}, ${cost} Edge spent. Roll the action now.`)
              }}
            />
          ))}
        </ol>
      )}

      {campaignRunners.length > 0 && (
        <div className="mt-6">
          <TableFeed runners={campaignRunners} limit={8} />
        </div>
      )}

      <details className="mt-6 text-sm">
        <summary className="flex cursor-pointer items-center gap-1 text-muted">
          <ChevronRight className="size-4" /> Encounter notes
        </summary>
        <textarea
          className="input mt-2 min-h-28 w-full"
          placeholder="Setup, terrain, what the opposition wants, loot…"
          value={encounter.notes}
          onChange={(e) => {
            const notes = e.target.value
            void update((x) => ({ ...x, notes }))
          }}
        />
      </details>

      {roll && (
        <RollResult
          label={`${encounter.participants.find((p) => p.id === roll.participantId)?.name ?? ''}: ${roll.label}`}
          roll={roll.result}
          bonus={roll.bonus}
          info={roll.info}
          edge={roll.bonus === undefined ? { available: edgeOf(roll.participantId), onBoost: boost } : undefined}
          onClose={() => setRoll(null)}
          onReroll={() => {
            const p = encounter.participants.find((x) => x.id === roll.participantId)
            if (p) doRoll(p.id, roll.label, roll.result.pool, roll.info, roll.bonus)
          }}
        />
      )}
      {adding && (
        <AddCombatants
          campaignId={encounter.campaignId}
          participants={encounter.participants}
          update={(change) => void update(change)}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
