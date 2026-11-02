import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { SourceLink } from '../components/SourceLink'
import { SearchView } from '../components/RulesPanel'
import { useFreshSearchOnLeave } from '../components/rulesStore'
import { RULES_REFERENCE } from '../rules/sr6/reference'

/**
 * The rules search as a page of its own (for links and bookmarks); everywhere
 * else it opens as a panel over the page. Before anything is typed, the app's
 * short summaries are listed to browse.
 */
export function RulesPage() {
  const navigate = useNavigate()
  useFreshSearchOnLeave()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-4 sm:px-8">
      <div className="mb-2 flex items-center gap-3">
        <button
          className="text-muted hover:text-fg"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="mr-auto font-display text-2xl font-semibold">Rules</h1>
      </div>
      <div className="card flex flex-1 flex-col overflow-hidden">
        <SearchView empty={<Browse />} />
      </div>
    </div>
  )
}

/** The app's rule summaries by topic, with a jump bar. */
function Browse() {
  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-1.5 text-xs">
        {RULES_REFERENCE.map((s) => (
          <a key={s.id} href={`#rules-${s.id}`} className="chip hover:border-accent/60" onClick={(e) => jump(e, s.id)}>
            {s.title}
          </a>
        ))}
      </nav>
      <p className="mb-4 text-xs text-muted">
        Short summaries to keep the game moving, with Core Rulebook pages. Search above to find anything in them and in
        the books in your Library.
      </p>
      {RULES_REFERENCE.map((s) => (
        <section key={s.id} id={`rules-${s.id}`} className="mb-6 scroll-mt-4">
          <h2 className="mb-2 font-display text-xl text-accent">{s.title}</h2>
          <div className="grid gap-2">
            {s.entries.map((e) => (
              <article key={e.title} className="rounded-lg border border-line p-3 text-sm">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{e.title}</h3>
                  <SourceLink source={{ book: 'CRB', page: e.page }} />
                </div>
                <ul className="grid gap-1">
                  {e.lines.map((line) => (
                    <li key={line} className="text-fg/90">
                      {line}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Hash routing owns the URL fragment, so scroll to the section instead of following the link. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault()
  document.getElementById(`rules-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
