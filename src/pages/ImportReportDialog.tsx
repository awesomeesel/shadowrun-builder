import { CircleCheck, FileInput, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import type { ImportReport } from '../model/importers/commlink'

const same = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '')

/** What happened when a character from another tool was imported, and how its numbers compare with ours. */
export function ImportReportDialog({
  name,
  characterId,
  report,
  onClose,
}: {
  name: string
  characterId: string
  report: ImportReport
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const differences = report.checks.filter((c) => !same(c.commlink, c.ours))

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden border-line bg-surface sm:max-h-[90vh] sm:rounded-xl sm:border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Import report"
      >
        <div className="border-b border-line p-4">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <FileInput className="size-5 text-accent" /> Imported {name}
          </h2>
          <p className="text-sm text-muted">Converted from {report.source}. Here's what to know before you play.</p>
        </div>

        <div className="grid gap-5 overflow-y-auto p-4">
          {report.notes.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Notes</h3>
              <ul className="grid gap-1.5 text-sm">
                {report.notes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.checks.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
                Compared with {report.source} ·{' '}
                {differences.length === 0 ? 'everything matches' : `${differences.length} different`}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-1 font-normal">Value</th>
                    <th className="pb-1 text-right font-normal">{report.source}</th>
                    <th className="pb-1 text-right font-normal">This app</th>
                    <th className="w-6 pb-1" />
                  </tr>
                </thead>
                <tbody>
                  {report.checks.map((check) => {
                    const ok = same(check.commlink, check.ours)
                    return (
                      <tr key={check.label} className="border-t border-line/60">
                        <td className="py-1.5">{check.label}</td>
                        <td className="py-1.5 text-right tabular-nums">{check.commlink}</td>
                        <td className={`py-1.5 text-right tabular-nums ${ok ? '' : 'text-amber'}`}>{check.ours}</td>
                        <td className="py-1.5 pl-2">
                          {ok ? (
                            <CircleCheck className="size-4 text-accent" aria-label="Matches" />
                          ) : (
                            <TriangleAlert className="size-4 text-amber" aria-label="Different" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {differences.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  Differences usually mean a special rule one of the apps handles differently. Check the page reference
                  of the item if it matters for play.
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <Link to={`/character/${characterId}`} className="btn btn-primary px-4">
            Open {name}
          </Link>
        </div>
      </div>
    </div>
  )
}
