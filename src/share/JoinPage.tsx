import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Radio } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { db } from '../db/db'
import { CharacterSchema, migrateCharacter } from '../model/character'
import { isSharingConfigured } from './campaigns'
import { JoinForm } from './ShareDialog'

/** Where the GM's QR code and join link lead: check the campaign, then pick runners to share. */
export function JoinPage() {
  const [params] = useSearchParams()
  const characters = useLiveQuery(async () =>
    (await db.characters.orderBy('name').toArray()).flatMap((raw) => {
      const parsed = CharacterSchema.safeParse(migrateCharacter(raw))
      return parsed.success ? [parsed.data] : []
    }),
  )
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/" className="text-muted hover:text-fg" aria-label="Back to characters">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Radio className="size-5 text-accent" /> Join your GM’s campaign
        </h1>
      </div>
      {!isSharingConfigured() ? (
        <p className="text-sm text-muted">Live sharing isn’t set up on this site.</p>
      ) : (
        characters && (
          <div className="card p-4">
            <JoinForm
              initialCode={params.get('c') ?? ''}
              initialPassword={params.get('p') ?? ''}
              pickCharacters={characters}
            />
          </div>
        )
      )}
      <p className="mt-4 text-xs text-muted">
        Your GM sees the runners you pick, read-only, and live while you play. Stop sharing any time with Share with GM
        on the character.
      </p>
      <Link to="/" className="btn mt-4">
        Go to my characters
      </Link>
    </div>
  )
}
