import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpen, Plus, Radio, Shuffle, Swords } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { db } from '../db/db'
import { EncounterSchema } from '../model/encounter'
import { newEncounter } from '../rules/sr6/encounter'
import { isSharingConfigured, latestSheets } from '../share/campaigns'
import { timeAgo } from '../share/timeAgo'
import { NewCampaignDialog } from './Campaigns'
import { BackupStatus } from './BackupStatus'
import { EncounterList } from './EncounterList'
import { SampleEncounterDialog } from './SampleEncounter'

/** The GM's start page: campaigns (with their runners and encounters), loose encounters, and the rules. */
export function GmHome() {
  const navigate = useNavigate()
  const campaigns = useLiveQuery(() => db.campaigns.where('role').equals('gm').toArray())
  const sheets = useLiveQuery(() => db.sharedSheets.toArray())
  const encounters = useLiveQuery(async () => (await db.encounters.toArray()).map((e) => EncounterSchema.parse(e)))
  const [creating, setCreating] = useState(false)
  const [sampling, setSampling] = useState(false)
  const sharing = isSharingConfigured()

  const campaignIds = new Set((campaigns ?? []).map((c) => c.id))
  const loose = (encounters ?? []).filter((e) => !e.campaignId || !campaignIds.has(e.campaignId))

  const createLoose = async () => {
    const encounter = newEncounter(`Encounter ${(encounters?.length ?? 0) + 1}`)
    await db.encounters.add(encounter)
    navigate(`/gm/${encounter.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/" className="text-muted hover:text-fg" aria-label="Back to characters">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="mr-auto font-display text-3xl font-semibold">GM screen</h1>
        <Link to="/rules" className="btn">
          <BookOpen className="size-4" /> Rules
        </Link>
        {sharing && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New campaign
          </button>
        )}
      </div>

      <BackupStatus />
      {sharing && (
        <section className="mb-8">
          {campaigns?.length === 0 ? (
            <div className="card p-6 text-sm text-muted">
              <p className="mb-3 max-w-2xl">
                A campaign keeps your group together: players join with a QR code (or a code and password) and you see
                their runners live while they play. Your encounters and notes for the campaign live there too.
              </p>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Make your first campaign
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns?.map((c) => {
                const runners = latestSheets((sheets ?? []).filter((s) => s.roomId === c.id))
                const fights = (encounters ?? []).filter((e) => e.campaignId === c.id)
                const last = fights
                  .map((e) => e.updatedAt)
                  .sort()
                  .at(-1)
                return (
                  <li key={c.id}>
                    <Link to={`/gm/campaign/${c.id}`} className="card block h-full p-4 hover:border-accent/60">
                      <div className="flex items-center gap-2 font-display text-xl">
                        <Radio className="size-4 text-accent" /> {c.name}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {runners.length} {runners.length === 1 ? 'runner' : 'runners'} · {fights.length}{' '}
                        {fights.length === 1 ? 'encounter' : 'encounters'}
                        {last && ` · played ${timeAgo(last)}`}
                      </div>
                      <div className="mt-1 truncate text-sm">
                        {runners.map((s) => s.character.name).join(', ') || (
                          <span className="text-muted">No runners yet</span>
                        )}
                      </div>
                      {c.error && <div className="mt-1 text-xs text-amber">{c.error}</div>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {(!sharing || loose.length > 0) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
              <Swords className="size-5 text-accent" /> {sharing ? 'Encounters without a campaign' : 'Encounters'}
            </h2>
            {!sharing && (
              <>
                <button className="btn" onClick={() => setSampling(true)} title="A ready-made fight from the books">
                  <Shuffle className="size-4" /> Sample
                </button>
                <button className="btn btn-primary" onClick={() => void createLoose()}>
                  <Plus className="size-4" /> New encounter
                </button>
              </>
            )}
          </div>
          <EncounterList encounters={loose} empty="No encounters yet." />
        </section>
      )}
      {creating && <NewCampaignDialog onClose={() => setCreating(false)} />}
      {sampling && <SampleEncounterDialog runners={4} onClose={() => setSampling(false)} />}
    </div>
  )
}
