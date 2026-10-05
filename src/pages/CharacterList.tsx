import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { addCharacter, deleteCharacter, duplicateCharacter, importCharacters } from '../db/characters'
import { db } from '../db/db'
import { downloadText } from '../lib/download'
import { createCharacter, type Character } from '../model/character'
import {
  ImportError,
  characterFileName,
  parseCharacterFile,
  serializeBundle,
  serializeCharacter,
} from '../model/fileFormat'
import { startBuild } from '../rules/sr6/build'
import { METATYPES } from '../rules/sr6/metatypes'

type Notice = { kind: 'success' | 'error'; text: string }

export function CharacterList() {
  const characters = useLiveQuery(() => db.characters.orderBy('updatedAt').reverse().toArray())
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dragging, setDragging] = useState(false)

  /** Start a new character with the priority build system. */
  async function handleNew() {
    const character = await addCharacter(startBuild(createCharacter()))
    navigate(`/character/${character.id}/build`)
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
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 sm:px-8">
        <h1 className="mr-auto font-display text-xl tracking-wide text-accent">Shadowrun Builder</h1>
        <Link to="/library" className="btn">
          Library
        </Link>
        <button className="btn btn-primary" onClick={handleNew}>
          New character
        </button>
        <button className="btn" onClick={handleQuickEntry} title="Type in a character that already exists">
          Enter existing
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <button className="btn" onClick={handleExportAll} disabled={!characters?.length}>
          Export all
        </button>
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
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {notice && (
          <div
            className={`mb-6 flex items-start gap-3 rounded border px-4 py-3 text-sm whitespace-pre-wrap ${
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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <li key={character.id} className="card flex flex-col">
                <Link to={`/character/${character.id}`} className="flex flex-1 gap-3 p-4 hover:bg-white/[0.03]">
                  <Portrait character={character} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{character.name}</div>
                    <div className="truncate text-sm text-muted">
                      {[METATYPES[character.metatype]?.name, character.concept].filter(Boolean).join(' · ')}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Edited {new Date(character.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </Link>
                <div className="flex border-t border-line text-sm">
                  <button
                    className="flex-1 py-2 text-muted hover:text-fg"
                    onClick={() => downloadText(characterFileName(character), serializeCharacter(character))}
                  >
                    Export
                  </button>
                  <button
                    className="flex-1 py-2 text-muted hover:text-fg"
                    onClick={() => duplicateCharacter(character.id)}
                  >
                    Duplicate
                  </button>
                  <button className="flex-1 py-2 text-muted hover:text-danger" onClick={() => handleDelete(character)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center bg-bg/80 text-lg text-accent">
          <div className="rounded-lg border-2 border-dashed border-accent px-10 py-8">Drop character files to import</div>
        </div>
      )}
    </div>
  )
}

function Portrait({ character }: { character: Character }) {
  if (character.portrait) {
    return <img src={character.portrait} alt="" className="size-14 shrink-0 rounded object-cover" />
  }
  return (
    <div className="grid size-14 shrink-0 place-items-center rounded bg-accent/15 font-display text-xl text-accent">
      {character.name.trim().charAt(0).toUpperCase() || '?'}
    </div>
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
    <div className="card mx-auto max-w-md p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold">No runners yet</h2>
      <p className="mb-6 text-sm text-muted">
        Build a new character with the priority system, type in one you already have, or import one from a file.
        You can also drag files onto this page.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn btn-primary" onClick={onNew}>
          New character
        </button>
        <button className="btn" onClick={onQuickEntry}>
          Enter existing
        </button>
        <button className="btn" onClick={onImport}>
          Import
        </button>
      </div>
    </div>
  )
}
