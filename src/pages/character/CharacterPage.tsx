import { ArrowLeft, Dices, Download, ListChecks, Pencil, ScrollText, Wand2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { Portrait } from '../../components/art'
import { METATYPE_COLORS } from '../../components/metatypeColors'
import { METATYPES } from '../../rules/sr6/metatypes'
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
  const header = useRef<HTMLElement>(null)
  const loaded = !!character

  // Sticky bars below the header (like the build budget) need to know how tall it is.
  useEffect(() => {
    const el = header.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loaded])

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
    `flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
      isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg'
    }`
  const inSession = !!character.play.session

  return (
    <div>
      <header ref={header} className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-3 sm:px-8">
          <Link to="/" className="text-muted hover:text-fg" aria-label="Back to characters">
            <ArrowLeft className="size-5" />
          </Link>
          <Portrait src={character.portrait} metatype={character.metatype} className="size-10" />
          <div className="mr-auto min-w-0">
            <h1 className="truncate font-display text-xl leading-tight font-semibold">
              {character.name || 'Unnamed runner'}
            </h1>
            <div className="truncate text-xs text-muted">
              <span style={{ color: METATYPE_COLORS[character.metatype] }}>{METATYPES[character.metatype].name}</span>
              {character.concept && ` · ${character.concept}`}
            </div>
          </div>
          <SaveIndicator state={saveState} />
          <button
            className="btn"
            onClick={() => downloadText(characterFileName(character), serializeCharacter(character))}
            title="Download this character as a file"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
        <nav className="no-scrollbar mx-auto mt-1 flex max-w-5xl overflow-x-auto px-4 sm:px-8">
          {character.mode === 'build' && (
            <>
              <NavLink to="wizard" className={tab}>
                <Wand2 className="size-4" /> Wizard
              </NavLink>
              <NavLink to="build" className={tab} title="All build choices on one page">
                <ListChecks className="size-4" /> Build
              </NavLink>
            </>
          )}
          <NavLink to="" end className={tab}>
            <ScrollText className="size-4" /> Sheet
          </NavLink>
          {character.mode !== 'build' && (
            <NavLink to="play" className={tab}>
              <Dices className="size-4" /> Play
              {inSession && (
                <span className="size-2 animate-pulse rounded-full bg-accent" aria-label="Session running" />
              )}
            </NavLink>
          )}
          <NavLink to="edit" className={tab}>
            <Pencil className="size-4" /> Edit
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
