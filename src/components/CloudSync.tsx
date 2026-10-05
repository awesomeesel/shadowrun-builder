import { Cloud, CloudAlert, CloudOff, ExternalLink, LogOut, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { connectDrive, disconnectDrive, driveFolderUrl, syncNow, useCloud, type CloudState } from '../cloud/cloud'

function timeAgo(iso?: string) {
  if (!iso) return 'never'
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return new Date(iso).toLocaleString()
}

function statusLabel(state: CloudState) {
  switch (state.status) {
    case 'syncing':
      return 'Syncing…'
    case 'idle':
      return 'Synced'
    case 'reconnect':
      return 'Reconnect'
    case 'error':
      return 'Sync problem'
    default:
      return 'Google Drive'
  }
}

/** Header button showing Drive sync status; opens the details dialog. Hidden when Drive isn't configured. */
export function CloudButton() {
  const cloud = useCloud()
  const [open, setOpen] = useState(false)
  if (cloud.status === 'off') return null

  const icon =
    cloud.status === 'syncing' ? (
      <RefreshCw className="size-4 animate-spin" />
    ) : cloud.status === 'error' || cloud.status === 'reconnect' ? (
      <CloudAlert className="size-4 text-amber" />
    ) : cloud.status === 'disconnected' ? (
      <CloudOff className="size-4" />
    ) : (
      <Cloud className="size-4 text-accent" />
    )

  return (
    <>
      <button
        className="btn"
        onClick={() => (cloud.status === 'reconnect' ? void syncNow({ interactive: true }) : setOpen(true))}
        title={cloud.status === 'reconnect' ? 'Google sign-in expired; click to continue syncing' : 'Google Drive sync'}
      >
        {icon} <span className="hidden sm:inline">{statusLabel(cloud)}</span>
      </button>
      {open && <CloudDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function CloudDialog({ onClose }: { onClose: () => void }) {
  const cloud = useCloud()
  const [folderUrl, setFolderUrl] = useState<string | null>(null)
  const connected = cloud.status !== 'disconnected' && cloud.status !== 'off'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (cloud.status === 'idle') void driveFolderUrl().then(setFolderUrl, () => {})
  }, [cloud.status])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Google Drive sync"
      >
        <div className="mb-3 flex items-start gap-3">
          <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
            <Cloud className="size-5 text-accent" /> Google Drive sync
          </h2>
          <button className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {!connected ? (
          <>
            <p className="text-sm text-muted">
              Save your characters in your own Google Drive, and open them in any browser or on any device. The app
              creates a <span className="text-fg">Shadowrun Builder</span> folder and can only see the files it made
              itself, nothing else in your Drive.
            </p>
            <ul className="mt-3 grid gap-1 text-sm">
              <li>• Characters sync automatically when they change.</li>
              <li>• Rulebook PDFs can be uploaded from the Library and downloaded on other devices.</li>
              <li>• Everything stays in your Drive; nobody else can see it.</li>
            </ul>
            {cloud.error && <p className="mt-3 text-sm text-danger">{cloud.error}</p>}
            <button className="btn btn-primary mt-4 w-full py-2" onClick={() => void connectDrive()}>
              <Cloud className="size-4" /> Connect Google Drive
            </button>
          </>
        ) : (
          <>
            {cloud.user && (
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg/50 p-3">
                {cloud.user.photo ? (
                  <img src={cloud.user.photo} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="grid size-10 place-items-center rounded-full bg-raised font-display">
                    {cloud.user.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{cloud.user.name}</div>
                  <div className="truncate text-xs text-muted">{cloud.user.email}</div>
                </div>
              </div>
            )}
            <dl className="mt-3 grid gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className={cloud.status === 'error' ? 'text-danger' : ''}>{statusLabel(cloud)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last synced</dt>
                <dd>{timeAgo(cloud.lastSync)}</dd>
              </div>
            </dl>
            {cloud.message && cloud.status === 'idle' && <p className="mt-2 text-xs text-muted">{cloud.message}</p>}
            {cloud.error && <p className="mt-2 text-sm text-danger">{cloud.error}</p>}
            {cloud.status === 'reconnect' && (
              <p className="mt-2 text-sm text-amber">
                Google sign-ins last an hour. Click Sync now to continue; usually no login is needed.
              </p>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                className="btn btn-primary py-2"
                onClick={() => void syncNow({ interactive: true })}
                disabled={cloud.status === 'syncing'}
              >
                <RefreshCw className={`size-4 ${cloud.status === 'syncing' ? 'animate-spin' : ''}`} /> Sync now
              </button>
              {folderUrl ? (
                <a className="btn py-2" href={folderUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Open in Drive
                </a>
              ) : (
                <span />
              )}
            </div>
            <button
              className="mt-4 flex items-center gap-1.5 text-xs text-muted hover:text-danger"
              onClick={() => {
                if (confirm('Stop syncing on this device? Your characters stay here and in Google Drive.')) {
                  disconnectDrive()
                }
              }}
            >
              <LogOut className="size-3.5" /> Disconnect this device
            </button>
          </>
        )}
      </div>
    </div>
  )
}
