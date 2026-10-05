import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Copy, Download, FileInput, Library, Trash2, UserPlus, Wand2 } from 'lucide-react'
import { Logo, Portrait, Skyline } from '../components/art'
import { METATYPE_COLORS } from '../components/metatypeColors'
import { useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { addCharacter, deleteCharacter, duplicateCharacter, importCharacters } from '../db/characters'
import { db } from '../db/db'
import { downloadText } from '../lib/download'
import { CharacterSchema, createCharacter, migrateCharacter, type Character } from '../model/character'
import {
  ImportError,
  characterFileName,
  parseCharacterFile,
  serializeBundle,
  serializeCharacter,
} from '../model/fileFormat'
import { startBuild } from '../rules/sr6/build'
import { computeDerived } from '../rules/sr6/derived'
import { METATYPES } from '../rules/sr6/metatypes'

type Notice = { kind: 'success' | 'error'; text: string }

export function CharacterList() {
  // Parse stored records so ones saved by older versions get the newer fields' defaults.
  const characters = useLiveQuery(async () =>
    (await db.characters.orderBy('updatedAt').reverse().toArray()).flatMap((raw) => {
      const parsed = CharacterSchema.safeParse(migrateCharacter(raw))
      return parsed.success ? [parsed.data] : []
    }),
  )
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dragging, setDragging] = useState(false)

  /** Start a new character with the priority build system. */
  async function handleNew() {
    const character = await addCharacter(startBuild(createCharacter()))
    navigate(`/character/${character.id}/wizard`)
  }

  /** Start a blank character for typing in one that already exists. */
  async function handleQuickEntry() {
    const character = await addCharacter()
    navigate(`/character/${character.id}/edit`)
  }

  async function handleFiles(files: FileList | File[]) {
    const imported: Character[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        imported.push(...(await importCharacters(parseCharacterFile(await file.text()))))
      } catch (error) {
        const message = error instanceof ImportError ? error.message : String(error)
        errors.push(`${file.name}: ${message}`)
      }
    }
    if (errors.length > 0) {
      setNotice({ kind: 'error', text: errors.join('\n\n') })
    } else if (imported.length === 1) {
      navigate(`/character/${imported[0].id}`)
    } else {
      setNotice({ kind: 'success', text: `Imported ${imported.length} characters.` })
    }
  }

  function handleExportAll() {
    if (!characters?.length) return
    const date = new Date().toISOString().slice(0, 10)
    downloadText(`shadowrun-builder-backup-${date}.json`, serializeBundle(characters))
  }

  async function handleDelete(character: Character) {
    if (confirm(`Delete "${character.name}"? This cannot be undone. Export it first if you want a backup.`)) {
      await deleteCharacter(character.id)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files)
  }

  return (
    <div
      className="min-h-full"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <header className="relative overflow-hidden border-b border-line">
        <Skyline className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full opacity-60" />
        <div className="relative mx-auto max-w-5xl px-4 pt-5 pb-8 sm:px-8 sm:pb-12">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <div className="mr-auto">
              <h1 className="text-gradient font-display text-2xl leading-none font-bold tracking-wider uppercase sm:text-3xl">
                Shadowrun Builder
              </h1>
              <p className="text-xs text-muted">Sixth World character builder &amp; runner's companion</p>
            </div>
            <Link to="/library" className="btn">
              <Library className="size-4" /> <span className="hidden sm:inline">Library</span>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-primary px-4 py-2" onClick={handleNew}>
              <Wand2 className="size-4" /> New character
            </button>
            <button className="btn py-2" onClick={handleQuickEntry} title="Type in a character that already exists">
              <UserPlus className="size-4" /> Enter existing
            </button>
            <button className="btn py-2" onClick={() => fileInput.current?.click()}>
              <FileInput className="size-4" /> Import
            </button>
            <button className="btn py-2" onClick={handleExportAll} disabled={!characters?.length}>
              <Download className="size-4" /> Export all
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {notice && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm whitespace-pre-wrap ${
              notice.kind === 'error' ? 'border-danger/50 bg-danger/10' : 'border-accent/40 bg-accent/10'
            }`}
          >
            <span className="flex-1">{notice.text}</span>
            <button className="text-muted hover:text-fg" onClick={() => setNotice(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {characters === undefined ? null : characters.length === 0 ? (
          <EmptyState onNew={handleNew} onQuickEntry={handleQuickEntry} onImport={() => fileInput.current?.click()} />
        ) : (
          <>
            <h2 className="mb-3 font-display text-sm tracking-widest text-muted uppercase">
              Your runners · {characters.length}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onDuplicate={() => duplicateCharacter(character.id)}
                  onDelete={() => handleDelete(character)}
                />
              ))}
            </ul>
          </>
        )}
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-bg/80 text-lg text-accent">
          <div className="rounded-xl border-2 border-dashed border-accent px-10 py-8">
            Drop character files to import
          </div>
        </div>
      )}
    </div>
  )
}

function CharacterCard({
  character,
  onDuplicate,
  onDelete,
}: {
  character: Character
  onDuplicate: () => void
  onDelete: () => void
}) {
  const color = METATYPE_COLORS[character.metatype]
  const derived = computeDerived(character)
  const status =
    character.mode === 'build'
      ? 'In creation'
      : character.play.session
        ? 'In session'
        : `${character.sessions.length} sessions`
  const target = character.mode === 'build' ? 'wizard' : character.play.session ? 'play' : ''
  return (
    <li className="card group relative flex flex-col overflow-hidden transition-colors hover:border-accent/40">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <Link to={`/character/${character.id}/${target}`} className="flex flex-1 gap-3 p-4">
        <Portrait src={character.portrait} metatype={character.metatype} className="size-16" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl leading-tight font-semibold">{character.name}</div>
          <div className="truncate text-sm">
            <span style={{ color }}>{METATYPES[character.metatype].name}</span>
            {character.concept && <span className="text-muted"> · {character.concept}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className={`chip ${character.play.session ? 'border-accent/50 text-accent' : ''}`}>{status}</span>
            {character.mode !== 'build' && (
              <>
                <span className="chip" title="Initiative">
                  Init {derived.initiative.score}+{derived.initiative.dice}D6
                </span>
                <span className="chip" title="Karma available">
                  {character.karma.available} K
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
      <div className="flex border-t border-line text-xs">
        <button
          className="flex flex-1 items-center justify-center gap-1 py-2 text-muted hover:text-fg"
          onClick={() => downloadText(characterFileName(character), serializeCharacter(character))}
        >
          <Download className="size-3.5" /> Export
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-1 py-2 text-muted hover:text-fg"
          onClick={onDuplicate}
        >
          <Copy className="size-3.5" /> Duplicate
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-1 py-2 text-muted hover:text-danger"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>
    </li>
  )
}

function EmptyState({
  onNew,
  onQuickEntry,
  onImport,
}: {
  onNew: () => void
  onQuickEntry: () => void
  onImport: () => void
}) {
  return (
    <div className="card mx-auto max-w-lg overflow-hidden text-center">
      <div className="p-8">
        <h2 className="mb-2 font-display text-2xl">No runners yet</h2>
        <p className="mb-6 text-sm text-muted">
          The wizard walks you through building a new runner step by step. Already have a character on paper? Type it
          in, or import a file. You can also drag files onto this page.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary px-4 py-2" onClick={onNew}>
            <Wand2 className="size-4" /> New character
          </button>
          <button className="btn py-2" onClick={onQuickEntry}>
            <UserPlus className="size-4" /> Enter existing
          </button>
          <button className="btn py-2" onClick={onImport}>
            <FileInput className="size-4" /> Import
          </button>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
          <BookOpen className="size-3.5" />
          <span>
            Tip: add your rulebook PDFs in the{' '}
            <Link to="/library" className="text-accent hover:underline">
              Library
            </Link>{' '}
            first, so you can pick gear and spells straight from your books.
          </span>
        </p>
      </div>
    </div>
  )
}
