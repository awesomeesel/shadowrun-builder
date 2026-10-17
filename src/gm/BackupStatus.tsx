import { CloudAlert, CloudCheck, RefreshCw } from 'lucide-react'
import { connectDrive, syncNow, useCloud } from '../cloud/cloud'
import { timeAgo } from '../share/timeAgo'

/**
 * Whether the GM's campaigns and encounters are safe in Google Drive. Loud when
 * they aren't, a quiet line when they are.
 */
export function BackupStatus() {
  const cloud = useCloud()
  if (cloud.status === 'off') {
    return (
      <Warning>
        Your campaigns, encounters, notes and run log are only stored in this browser. Clearing site data or switching
        device loses them.
      </Warning>
    )
  }
  if (cloud.status === 'disconnected') {
    return (
      <Warning
        action={
          <button className="btn btn-primary" onClick={() => void connectDrive()}>
            Connect Google Drive
          </button>
        }
      >
        Your campaigns, codes and passwords, encounters, notes and run log are only on this device. Connect Google Drive
        to back them up and use them on your other devices too.
      </Warning>
    )
  }
  if (cloud.status === 'reconnect' || cloud.status === 'error') {
    return (
      <Warning
        action={
          <button className="btn" onClick={() => void syncNow({ interactive: true })}>
            <RefreshCw className="size-4" /> {cloud.status === 'reconnect' ? 'Continue backing up' : 'Try again'}
          </button>
        }
      >
        {cloud.status === 'reconnect'
          ? 'The Google sign-in ran out, so recent changes aren’t backed up yet.'
          : `Backing up to Google Drive failed: ${cloud.error ?? 'unknown problem'}.`}
      </Warning>
    )
  }
  return (
    <p className="mb-4 flex items-center gap-1.5 text-xs text-muted">
      {cloud.status === 'syncing' ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : (
        <CloudCheck className="size-3.5 text-accent" />
      )}
      Campaigns and encounters are backed up to Google Drive
      {cloud.lastSync && ` · ${cloud.status === 'syncing' ? 'saving…' : timeAgo(cloud.lastSync)}`}
    </p>
  )
}

function Warning({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-amber/50 bg-amber/10 p-3 text-sm">
      <CloudAlert className="size-5 shrink-0 text-amber" />
      <p className="min-w-0 flex-1 basis-60">{children}</p>
      {action}
    </div>
  )
}
