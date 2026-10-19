import { Dices } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SharedSheet } from '../db/db'
import { isFileSheet } from '../share/campaigns'
import { timeAgo } from '../share/timeAgo'
import { tableFeed } from './feedRules'

/**
 * The players' rolls as they make them: pool, hits, glitches and Edge, from
 * the sessions running on their sheets. Only runners shared live show up.
 */
export function TableFeed({ runners, limit = 12 }: { runners: SharedSheet[]; limit?: number }) {
  const live = runners.filter((s) => !isFileSheet(s))
  const feed = tableFeed(live, limit)
  // Re-render now and then so "2 min ago" stays right between updates.
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  if (live.length === 0) return null

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
        <Dices className="size-5 text-accent" /> Table feed
        <span className="text-xs font-normal text-muted">players’ rolls, live</span>
      </h2>
      {feed.length === 0 ? (
        <div className="card p-4 text-sm text-muted">
          Rolls show up here as players make them on the Play tab, while their session is running.
        </div>
      ) : (
        <ol className="card divide-y divide-line text-sm">
          {feed.map((r) => (
            <li key={r.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5">
              <span className="font-semibold">{r.runner}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{r.label || 'Roll'}</span>
              {r.total !== null ? (
                <span className="font-semibold text-accent tabular-nums">Initiative {r.total}</span>
              ) : (
                <span className="tabular-nums">
                  <span className="font-semibold text-accent">{r.hits}</span>{' '}
                  <span className="text-xs text-muted">
                    {r.hits === 1 ? 'hit' : 'hits'} of {r.pool}
                  </span>
                </span>
              )}
              {r.criticalGlitch ? (
                <span className="chip border-danger text-danger">Critical glitch</span>
              ) : (
                r.glitch && <span className="chip border-amber text-amber">Glitch</span>
              )}
              {r.edge > 0 && <span className="chip text-amber">{r.edge} Edge</span>}
              <span className="w-16 text-right text-xs text-muted">{timeAgo(r.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
