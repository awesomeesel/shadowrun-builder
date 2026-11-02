import { useLiveQuery } from 'dexie-react-hooks'
import { CloudAlert, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { syncNow, useCloud } from '../cloud/cloud'
import { db } from '../db/db'

/** When this page was loaded, to tell the first sync after opening the app from later ones. */
const OPENED_AT = new Date().toISOString()

/**
 * On a character's page, says when Google Drive can't be trusted to have (or
 * give) the latest version: changes here not uploaded yet, or this device not
 * having checked Drive since it was opened. Editing on two devices while sync
 * is paused is what leaves "(other version)" copies behind.
 */
export function SyncNotice({ characterId, name }: { characterId: string; name: string }) {
  const cloud = useCloud()
  const [hidden, setHidden] = useState(false)
  // From the database, not the editor: it knows the saved version and the last one both sides agreed on.
  const sync = useLiveQuery(async () => {
    const [stored, state] = await Promise.all([db.characters.get(characterId), db.syncState.get(characterId)])
    return { unsent: !!stored && stored.updatedAt !== state?.syncedUpdatedAt }
  }, [characterId])
  if (!sync || cloud.status === 'off' || cloud.status === 'disconnected') return null

  const reconnect = (
    <button className="btn btn-primary shrink-0 px-3 py-1 text-xs" onClick={() => void syncNow({ interactive: true })}>
      <RefreshCw className="size-3.5" /> {cloud.status === 'error' ? 'Try again' : 'Reconnect'}
    </button>
  )
  const paused = cloud.status === 'reconnect' || cloud.status === 'error'
  const why =
    cloud.status === 'error'
      ? `Google Drive sync ran into a problem${cloud.error ? `: ${cloud.error}` : ''}.`
      : 'The Google sign-in has run out (they last an hour).'

  if (paused && sync.unsent) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm print:hidden">
        <CloudAlert className="size-5 shrink-0 text-amber" />
        <p className="min-w-0 flex-1 basis-60">
          <b>Changes to {name} aren’t on Google Drive yet.</b> {why} Your other devices won’t see them, and editing
          there now leaves two versions.
        </p>
        {reconnect}
      </div>
    )
  }
  if (paused && !hidden && (!cloud.lastSync || cloud.lastSync < OPENED_AT)) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/60 p-3 text-sm print:hidden">
        <CloudAlert className="size-5 shrink-0 text-amber" />
        <p className="min-w-0 flex-1 basis-60">
          This device hasn’t checked Google Drive since it was opened. {why} If you’ve played on another device, this
          may not be the newest version: reconnect before you change anything.
        </p>
        {reconnect}
        <button className="text-muted hover:text-fg" onClick={() => setHidden(true)} aria-label="Hide">
          <X className="size-4" />
        </button>
      </div>
    )
  }
  if (cloud.status === 'syncing' && (!cloud.lastSync || cloud.lastSync < OPENED_AT)) {
    return (
      <p className="mb-4 flex items-center gap-2 text-xs text-muted print:hidden">
        <RefreshCw className="size-3.5 animate-spin" /> Checking Google Drive for a newer version…
      </p>
    )
  }
  return null
}
