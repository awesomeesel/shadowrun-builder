import { Link, NavLink, Outlet, useParams } from 'react-router'
import { useCharacterDraft, type SaveState } from '../../hooks/useCharacterDraft'
import { downloadText } from '../../lib/download'
import type { Character } from '../../model/character'
import { characterFileName, serializeCharacter } from '../../model/fileFormat'

export type Update = (change: (draft: Character) => Character) => void

/** Passed to the Sheet and Edit tabs through the router outlet. */
export interface CharacterContext {
  character: Character
  update: Update
}

export function CharacterPage() {
  const { id = '' } = useParams()
  const { character, update, saveState } = useCharacterDraft(id)

  if (character === undefined) return null
  if (character === null) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Character not found.</p>
        <Link to="/" className="btn">
          Back to characters
        </Link>
      </div>
    )
  }

  const tab = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 px-3 py-2 text-sm ${isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg'}`

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-3 sm:px-8">
          <Link to="/" className="text-muted hover:text-fg" aria-label="Back to characters">
            ←
          </Link>
          <h1 className="mr-auto truncate font-display text-lg">{character.name || 'Unnamed runner'}</h1>
          <SaveIndicator state={saveState} />
          <button
            className="btn"
            onClick={() => downloadText(characterFileName(character), serializeCharacter(character))}
          >
            Export
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl px-4 sm:px-8">
          <NavLink to="" end className={tab}>
            Sheet
          </NavLink>
          <NavLink to="edit" className={tab}>
            Edit
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <Outlet context={{ character, update } satisfies CharacterContext} />
      </main>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label = { saved: 'Saved', pending: 'Saving…', error: 'Save failed' }[state]
  return <span className={`text-xs ${state === 'error' ? 'text-danger' : 'text-muted'}`}>{label}</span>
}
