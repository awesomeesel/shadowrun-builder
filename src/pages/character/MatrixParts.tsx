import { TriangleAlert } from 'lucide-react'
import type { Character } from '../../model/character'
import { MATRIX_LABELS, type MatrixStats } from '../../rules/sr6/derived'
import { findProgram } from '../../rules/sr6/matrix'
import type { Update } from './CharacterPage'

/** What the persona is made of and its four Matrix attributes, with advice when hardware is missing. */
export function PersonaSummary({ matrix }: { matrix: MatrixStats }) {
  return (
    <div className="grid gap-2 rounded-lg border border-line/70 bg-bg/40 p-3 text-sm">
      <div>
        <span className="text-muted">Persona: </span>
        {matrix.parts.length === 0
          ? 'Living persona (from your mental attributes and Resonance)'
          : matrix.parts.map((p, i) => (
              <span key={i}>
                {i > 0 && ' + '}
                {p.name}
                {p.provides && <span className="text-muted"> ({p.provides})</span>}
              </span>
            ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span>
          <span className="text-muted">Device rating</span> {matrix.deviceRating}
        </span>
        {(['attack', 'sleaze', 'dataProcessing', 'firewall'] as const).map((k) => (
          <span key={k}>
            <span className="text-muted">{MATRIX_LABELS[k]}</span> {matrix[k]}
          </span>
        ))}
        {matrix.device && (
          <span>
            <span className="text-muted">Program slots</span> {matrix.runningPrograms.length}/{matrix.programSlots}
          </span>
        )}
      </div>
      {matrix.warnings.map((w) => (
        <p key={w} className="flex gap-2 text-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
        </p>
      ))}
    </div>
  )
}

/** Switch programs on and off, e.g. between Matrix runs during play. */
export function ProgramToggles({
  character,
  update,
  matrix,
}: {
  character: Character
  update: Update
  matrix: MatrixStats
}) {
  if (character.programs.length === 0) {
    return <p className="text-sm text-muted">No programs. Add them on the Edit tab under Programs.</p>
  }
  const full = matrix.runningPrograms.length >= matrix.programSlots
  const toggle = (id: string) =>
    update((c) => ({ ...c, programs: c.programs.map((p) => (p.id === id ? { ...p, running: !p.running } : p)) }))
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">
        Running {matrix.runningPrograms.length} of {matrix.programSlots} program slots
        {matrix.device ? ` on ${matrix.device.name || 'your device'}` : ''}. Tap a program to start or stop it.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {character.programs.map((p) => {
          const effect = findProgram(p.name)?.effect ?? p.notes
          return (
            <li key={p.id}>
              <button
                className={`chip cursor-pointer ${
                  p.running ? 'border-accent bg-accent/15 text-accent' : 'text-muted hover:text-fg'
                } ${!p.running && full ? 'opacity-60' : ''}`}
                aria-pressed={p.running}
                title={effect || undefined}
                onClick={() => toggle(p.id)}
              >
                {p.running ? '● ' : '○ '}
                {p.name || 'Unnamed program'}
              </button>
            </li>
          )
        })}
      </ul>
      {matrix.runningPrograms.some((p) => findProgram(p.name)) && (
        <ul className="grid gap-0.5 text-xs text-muted">
          {matrix.runningPrograms.map((p) => {
            const effect = findProgram(p.name)?.effect
            return (
              effect && (
                <li key={p.id}>
                  <span className="text-fg">{p.name}:</span> {effect}
                </li>
              )
            )
          })}
        </ul>
      )}
    </div>
  )
}
