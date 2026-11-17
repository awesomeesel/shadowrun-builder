import { KeyRound, RefreshCw, Truck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useCloud } from '../cloud/cloud'
import type { Campaign } from '../db/db'
import { ensureGmAccess, moveCampaignHere } from '../share/campaigns'

/**
 * On a campaign page, when this device can't send things to the players: the
 * server only knows the GM devices that made the campaign or unlocked
 * themselves with its GM key. Says what to do, and offers to move the
 * campaign here when the device that made it is gone.
 */
export function GmAccessNotice({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate()
  const cloud = useCloud()
  const [busy, setBusy] = useState<'check' | 'move' | null>(null)
  const [error, setError] = useState('')
  if (campaign.role !== 'gm' || campaign.closed || !campaign.gmAccess || campaign.gmAccess === 'ok') return null

  const check = async () => {
    setBusy('check')
    setError('')
    try {
      const access = await ensureGmAccess(campaign.id)
      if (access !== 'ok') setError('Still not unlocked.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const move = async () => {
    if (
      !confirm(
        `Move “${campaign.name}” to this device? It gets a new code, and the players join again once with the new QR code or code. Notes, cast, jobs, run log, sketch and encounters come along. The old campaign stays on the server until its players leave it.`,
      )
    )
      return
    setBusy('move')
    setError('')
    try {
      const moved = await moveCampaignHere(campaign.id)
      navigate(`/gm/campaign/${moved.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }
  const driveOff = cloud.status === 'off' || cloud.status === 'disconnected'

  return (
    <section className="rounded-xl border border-amber/60 bg-amber/10 p-4 text-sm">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg">
        <KeyRound className="size-5 text-amber" /> This device can’t send to the players yet
      </h2>
      {campaign.gmAccess === 'no-key' ? (
        <>
          <p>
            The campaign was made on another device, and the server only takes the GM’s word from devices it knows.
            Messages, handouts, loot, jobs, the map and the sketch need that.
          </p>
          <ol className="mt-2 list-inside list-decimal text-muted">
            <li>
              Open this campaign once on the device you made it on
              {driveOff ? ', with Google Drive connected on both devices' : ', with Google Drive connected'}. It creates
              the campaign’s GM key and saves it in your Drive backup.
            </li>
            <li>This device picks the key up from the backup and unlocks itself. Press Check again if it’s slow.</li>
          </ol>
          <p className="mt-2 text-muted">Lost that device, or cleared its browser? Move the campaign here instead.</p>
        </>
      ) : (
        <p>
          The GM key in your backup doesn’t match the one on the server, so this device can’t unlock itself. Move the
          campaign here to carry on with a new code.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {campaign.gmAccess === 'no-key' && (
          <button className="btn btn-primary text-xs" onClick={() => void check()} disabled={!!busy}>
            <RefreshCw className={`size-4 ${busy === 'check' ? 'animate-spin' : ''}`} /> Check again
          </button>
        )}
        <button className="btn text-xs" onClick={() => void move()} disabled={!!busy}>
          <Truck className="size-4" /> {busy === 'move' ? 'Moving…' : 'Move the campaign to this device'}
        </button>
      </div>
    </section>
  )
}
