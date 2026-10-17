import { TriangleAlert, Wifi } from 'lucide-react'
import { MonitorTrack } from '../../../components/sheetParts'
import { Section } from '../../../components/ui'
import type { Character } from '../../../model/character'
import type { MatrixStats } from '../../../rules/sr6/derived'
import { formatInitiative } from '../../../rules/sr6/format'
import type { Update } from '../CharacterPage'
import { ProgramToggles } from '../MatrixParts'
import type { QuickPool } from './types'

/** Overwatch Score at which GOD converges on a hacker (p. 176). */
const CONVERGENCE = 40

/** The decker's or technomancer's table view: Matrix damage, Overwatch Score, programs and initiative. */
export function MatrixPlay({
  character,
  update,
  matrix,
  onRoll,
}: {
  character: Character
  update: Update
  matrix: MatrixStats
  onRoll: (quick: QuickPool) => void
}) {
  const overwatch = character.play.overwatch
  const setOverwatch = (value: number) => update((c) => ({ ...c, play: { ...c.play, overwatch: Math.max(0, value) } }))
  const inits: { label: string; init: MatrixStats['arInitiative'] }[] = [
    { label: 'AR', init: matrix.arInitiative },
    { label: 'Cold-sim', init: matrix.coldSimInitiative },
    { label: 'Hot-sim', init: matrix.hotSimInitiative },
  ]
  return (
    <Section title="Matrix" icon={<Wifi className="size-4" />}>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {inits.map(({ label, init }) => (
          <button
            key={label}
            className="rounded-lg border border-line bg-bg/60 px-2 py-1.5 text-center hover:border-accent/60"
            onClick={() => onRoll({ label: `${label} initiative`, pool: init.dice, initiativeScore: init.score })}
          >
            <div className="text-[10px] tracking-wider text-muted uppercase">{label} init.</div>
            <div className="font-display font-semibold text-accent tabular-nums">{formatInitiative(init)}</div>
          </button>
        ))}
      </div>

      {matrix.device && (
        <div className="mb-4">
          <MonitorTrack
            label={`Matrix damage (${matrix.device.name || 'device'})`}
            monitor={{ boxes: matrix.monitor, filled: character.play.matrixDamage }}
            showModifiers={false}
            onChange={(n) => update((c) => ({ ...c, play: { ...c.play, matrixDamage: n } }))}
          />
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-muted">Overwatch Score</span>
          <button className="text-muted hover:text-fg" onClick={() => setOverwatch(0)}>
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn px-2 py-1" onClick={() => setOverwatch(overwatch - 1)}>
            −1
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
            <div
              className={`h-full rounded-full ${overwatch >= 30 ? 'bg-danger' : overwatch >= 20 ? 'bg-amber' : 'bg-accent'}`}
              style={{ width: `${Math.min(100, (overwatch / CONVERGENCE) * 100)}%` }}
            />
          </div>
          <span className="w-14 text-right font-display text-lg tabular-nums">
            {overwatch}
            <span className="text-xs text-muted">/{CONVERGENCE}</span>
          </span>
          <button className="btn px-2 py-1" onClick={() => setOverwatch(overwatch + 1)}>
            +1
          </button>
          <button className="btn px-2 py-1" onClick={() => setOverwatch(overwatch + 5)}>
            +5
          </button>
        </div>
        {overwatch >= CONVERGENCE ? (
          <p className="mt-1 flex gap-1.5 text-xs text-danger">
            <TriangleAlert className="size-3.5 shrink-0" /> Convergence! GOD has found you.
          </p>
        ) : (
          overwatch >= 30 && <p className="mt-1 text-xs text-amber">Getting close to Convergence. Time to jack out?</p>
        )}
      </div>

      {/* Technomancers use complex forms, not programs. */}
      {(matrix.device || character.programs.length > 0) && (
        <ProgramToggles character={character} update={update} matrix={matrix} />
      )}
    </Section>
  )
}
