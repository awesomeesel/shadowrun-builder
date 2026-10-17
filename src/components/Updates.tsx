import { RefreshCw, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CHANGELOG, LATEST_CHANGE, SHOW_WHATS_NEW } from '../changelog'
import { db } from '../db/db'

const RUNNING = import.meta.env.VITE_APP_VERSION as string | undefined
const SEEN_KEY = 'whatsNewSeen'
/** How often to look for a new deploy while the app stays open. */
const CHECK_EVERY_MS = 10 * 60 * 1000

function readSeen(): number | null {
  try {
    const value = localStorage.getItem(SEEN_KEY)
    return value === null ? null : Number(value)
  } catch {
    return null
  }
}

function writeSeen(id: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(id))
  } catch {
    // Private mode or blocked storage: the list just shows again next time.
  }
}

/** Banner for a newer deploy, and the What's new list after an update. */
export function Updates() {
  const [newVersion, setNewVersion] = useState<string | null>(null)
  const [whatsNew, setWhatsNew] = useState<{ since: number } | null>(() => {
    const seen = readSeen()
    return seen !== null && seen < LATEST_CHANGE ? { since: seen } : null
  })

  // Look for a newer deploy now and then, and whenever the app comes back to the foreground.
  useEffect(() => {
    if (import.meta.env.DEV || !RUNNING) return
    const check = async () => {
      try {
        const response = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) return
        const { version } = (await response.json()) as { version?: string }
        if (version && version !== RUNNING) setNewVersion(version)
      } catch {
        // Offline: try again later.
      }
    }
    void check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // First visit with this feature: existing players get the list once; new players skip it.
  useEffect(() => {
    if (readSeen() !== null) return
    void db.characters.count().then((count) => {
      if (count > 0) setWhatsNew({ since: 0 })
      else writeSeen(LATEST_CHANGE)
    })
  }, [])

  useEffect(() => {
    const open = () => setWhatsNew({ since: 0 })
    window.addEventListener(SHOW_WHATS_NEW, open)
    return () => window.removeEventListener(SHOW_WHATS_NEW, open)
  }, [])

  const close = () => {
    writeSeen(LATEST_CHANGE)
    setWhatsNew(null)
  }

  // A new query string makes the browser fetch the page itself again instead of a cached copy.
  const reload = () => {
    location.href = `${location.pathname}?v=${newVersion}${location.hash}`
  }

  return (
    <>
      {newVersion && (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:p-0">
          <div className="card flex items-center gap-3 border-accent/50 bg-surface p-3 shadow-[0_0_40px_-12px_var(--color-accent)]">
            <Sparkles className="size-5 shrink-0 text-accent" />
            <span className="text-sm">A new version of the app is available.</span>
            <button className="btn btn-primary shrink-0" onClick={reload}>
              <RefreshCw className="size-4" /> Reload
            </button>
            <button className="text-muted hover:text-fg" onClick={() => setNewVersion(null)} aria-label="Later">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      {whatsNew && <WhatsNew since={whatsNew.since} onClose={close} />}
    </>
  )
}

function WhatsNew({ since, onClose }: { since: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const fresh = CHANGELOG.filter((e) => e.id > since)
  const entries = fresh.length ? fresh : CHANGELOG
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="What's new"
      >
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Sparkles className="size-5 text-accent" /> What's new
        </h2>
        <div className="mt-4 grid gap-5">
          {entries.map((entry) => (
            <section key={entry.id}>
              <h3 className="font-semibold">{entry.title}</h3>
              <div className="text-xs text-muted">{new Date(entry.date).toLocaleDateString()}</div>
              <ul className="mt-2 grid gap-1.5 text-sm">
                {entry.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
