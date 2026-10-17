import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, LogOut, Radio, Send, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { noAutofill } from '../components/noAutofill'
import { db, type Campaign } from '../db/db'
import type { Character } from '../model/character'
import { characterFileName, serializeCharacter } from '../model/fileFormat'
import { downloadText } from '../lib/download'
import {
  isSharingConfigured,
  joinCampaign,
  leaveCampaign,
  lookupCampaign,
  setShared,
  syncCampaign,
  type LookupResult,
} from './campaigns'
import { timeAgo } from './timeAgo'

/** Header button on a character: share it with the GM's campaign. */
export function ShareButton({ character }: { character: Character }) {
  const [open, setOpen] = useState(false)
  const sharedWith = useLiveQuery(
    () => db.campaigns.filter((c) => !c.closed && c.characterIds.includes(character.id)).count(),
    [character.id],
  )
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} title="Share this character with your GM">
        {sharedWith ? <Radio className="size-4 text-accent" /> : <Share2 className="size-4" />}
        <span className="hidden sm:inline">{sharedWith ? 'Shared' : 'Share with GM'}</span>
      </button>
      {open && <ShareDialog character={character} onClose={() => setOpen(false)} />}
    </>
  )
}

function ShareDialog({ character, onClose }: { character: Character; onClose: () => void }) {
  const campaigns = useLiveQuery(() => db.campaigns.toArray())
  const live = isSharingConfigured()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Share with GM"
      >
        <div className="mb-3 flex items-center gap-2">
          <Share2 className="size-5 text-accent" />
          <h2 className="mr-auto font-display text-xl">Share {character.name} with your GM</h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {live && (
          <>
            <p className="mb-3 text-sm text-muted">
              The GM sees your sheet live, read-only, while you play. Only you can change your character.
            </p>
            {(campaigns ?? []).length > 0 && (
              <ul className="mb-4 grid gap-2">
                {campaigns!.map((c) => (
                  <CampaignRow key={c.id} campaign={c} characterId={character.id} />
                ))}
              </ul>
            )}
            <JoinForm characterId={character.id} />
          </>
        )}
        <div className={live ? 'mt-5 border-t border-line pt-4' : ''}>
          <h3 className="mb-1 font-semibold">{live ? 'No internet at the table?' : 'Send a copy'}</h3>
          <p className="mb-2 text-sm text-muted">
            Send your GM the character file; they import it on the GM screen. It’s a copy, so send it again after
            changes.
          </p>
          <SendCopy character={character} />
        </div>
      </div>
    </div>
  )
}

function CampaignRow({ campaign, characterId }: { campaign: Campaign; characterId: string }) {
  const shared = campaign.characterIds.includes(characterId)
  const sent = campaign.pushed[characterId]
  return (
    <li className="rounded-lg border border-line bg-bg/40 p-3 text-sm">
      <div className="flex items-center gap-2">
        <Radio className={`size-4 ${shared && !campaign.closed ? 'text-accent' : 'text-muted'}`} />
        <span className="mr-auto font-semibold">{campaign.name}</span>
        {!campaign.closed && (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => void setShared(campaign.id, characterId, e.target.checked)}
            />
            Share this runner
          </label>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
        {campaign.role === 'gm' && <span>You run this campaign</span>}
        {campaign.closed ? (
          <span className="text-amber">The GM closed this campaign.</span>
        ) : campaign.error ? (
          <span className="flex items-center gap-1 text-amber">
            <AlertTriangle className="size-3" /> {campaign.error}{' '}
            <button className="underline" onClick={() => void syncCampaign(campaign.id)}>
              Try again
            </button>
          </span>
        ) : shared ? (
          <span>{sent ? `Up to date · sent ${timeAgo(campaign.lastSyncAt)}` : 'Sending…'}</span>
        ) : null}
        <button
          className="ml-auto flex items-center gap-1 hover:text-danger"
          onClick={() => {
            if (
              campaign.closed ||
              confirm(`Leave "${campaign.name}"? Your runners stop being shared and the GM no longer sees them.`)
            )
              void leaveCampaign(campaign.id).then(async () => {
                if (campaign.closed) await db.campaigns.delete(campaign.id)
              })
          }}
        >
          <LogOut className="size-3" /> {campaign.closed ? 'Remove' : 'Leave'}
        </button>
      </div>
    </li>
  )
}

/** Code and password, checked against the server before joining. */
export function JoinForm({
  characterId,
  initialCode = '',
  initialPassword = '',
  onJoined,
  pickCharacters,
}: {
  characterId?: string
  initialCode?: string
  initialPassword?: string
  onJoined?: () => void
  /** On the join page: choose which characters to share. */
  pickCharacters?: Character[]
}) {
  const [code, setCode] = useState(initialCode)
  const [password, setPassword] = useState(initialPassword)
  const [found, setFound] = useState<Extract<LookupResult, { ok: true }> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<string[]>(characterId ? [characterId] : [])
  const [joined, setJoined] = useState(false)

  const check = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await lookupCampaign(code, password.trim())
      if (result.ok) setFound(result)
      else
        setError(
          result.reason === 'bad-code'
            ? 'A code has 12 letters and digits, like K7QM-4XRA-P2DN.'
            : 'No campaign with that code and password. Check both with your GM.',
        )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  // Coming from a QR code with everything filled in: check right away.
  useEffect(() => {
    if (initialCode) void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const join = async () => {
    if (!found) return
    setBusy(true)
    try {
      await joinCampaign(found, password.trim(), picked)
      setJoined(true)
      onJoined?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  if (joined && found) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 p-3 text-sm">
        <Check className="size-4 text-accent" /> Joined {found.name}. Your GM can see{' '}
        {picked.length === 1 ? 'your runner' : `${picked.length} runners`} now.
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {!found ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void check()
          }}
        >
          <div className="text-sm font-semibold">Join a campaign</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              {...noAutofill}
              className="input font-mono uppercase"
              placeholder="Code from your GM"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Campaign code"
            />
            <input
              {...noAutofill}
              className="input"
              placeholder="Password, if there is one"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Campaign password"
            />
          </div>
          <button className="btn btn-primary justify-self-start" disabled={busy || !code.trim()}>
            {busy ? 'Checking…' : 'Find campaign'}
          </button>
        </form>
      ) : (
        <div className="grid gap-3 rounded-lg border border-accent/50 bg-accent/5 p-3">
          <div className="text-sm">
            Found <span className="font-semibold text-accent">{found.name}</span>.
          </div>
          {pickCharacters &&
            (pickCharacters.length === 0 ? (
              <p className="text-sm text-muted">
                You have no characters on this device yet.{' '}
                <Link to="/" className="text-accent hover:underline">
                  Make or import one
                </Link>{' '}
                first, then open the link again.
              </p>
            ) : (
              <div className="grid gap-1.5">
                <div className="text-xs text-muted">Which runners should the GM see?</div>
                {pickCharacters.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(c.id)}
                      onChange={(e) =>
                        setPicked(e.target.checked ? [...picked, c.id] : picked.filter((id) => id !== c.id))
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            ))}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || picked.length === 0} onClick={() => void join()}>
              {busy ? 'Joining…' : 'Join and share'}
            </button>
            <button className="btn" onClick={() => setFound(null)}>
              Back
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

/** The character file, through the phone's share sheet when it has one, else as a download. */
function SendCopy({ character }: { character: Character }) {
  const [note, setNote] = useState('')
  const send = async () => {
    const name = characterFileName(character)
    const text = serializeCharacter(character)
    const file = new File([text], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: character.name })
        setNote('Sent.')
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    downloadText(name, text)
    setNote(`Saved ${name}. Send it to your GM by chat or email.`)
  }
  return (
    <div>
      <button className="btn" onClick={() => void send()}>
        <Send className="size-4" /> Send a copy
      </button>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  )
}
