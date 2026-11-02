/**
 * The campaign's jobs as the players see them. The GM's device publishes the
 * list (sealed, like everything else) whenever it changes; players' devices
 * keep the latest copy. Twists and jobs the GM hides never leave the GM.
 */
import { db, type Campaign, type JobBoard, type PlayerJob } from '../db/db'
import { campaignKey, getTransport } from './campaigns'
import { seal, unseal } from './crypto'

interface BoardPayload {
  jobs: PlayerJob[]
}

/** The jobs players may see, without anything only the GM should know. */
export function playerJobs(campaign: Pick<Campaign, 'jobs' | 'cast'>): PlayerJob[] {
  const cast = new Map((campaign.cast ?? []).map((m) => [m.id, m.name]))
  return (campaign.jobs ?? [])
    .filter((j) => !j.hidden)
    .map((j) => ({
      id: j.id,
      title: j.title,
      kind: j.kind,
      status: j.status,
      johnson: (j.johnsonId && cast.get(j.johnsonId)) || '',
      nuyen: j.nuyen,
      karma: j.karma,
      deadline: j.deadline,
      brief: j.brief,
      objectives: j.objectives.map((o) => ({ text: o.text, done: o.done })),
    }))
}

/** GM: publish the players' job list. */
export async function publishJobs(campaign: Campaign, jobs = playerJobs(campaign)): Promise<void> {
  const t = await getTransport()
  await t.putBoard(campaign.id, 'jobs', {
    data: await seal(await campaignKey(campaign), { jobs } satisfies BoardPayload),
    updatedAt: new Date().toISOString(),
  })
}

/** Player: keep this device's copy of a joined campaign's job list up to date. */
export function watchJobs(campaign: Campaign, onError?: (message: string) => void): () => void {
  let stop: (() => void) | null = null
  let stopped = false
  void (async () => {
    try {
      const t = await getTransport()
      const key = await campaignKey(campaign)
      if (stopped) return
      stop = t.watchBoard(
        campaign.id,
        'jobs',
        (doc) =>
          void (async () => {
            if (!doc) {
              await db.jobBoards.delete(campaign.id)
              return
            }
            try {
              const { jobs } = await unseal<BoardPayload>(key, doc.data)
              const board: JobBoard = { roomId: campaign.id, jobs, updatedAt: doc.updatedAt }
              await db.jobBoards.put(board)
            } catch {
              // Not sealed with this campaign's key; ignore it.
            }
          })(),
        (error) => onError?.(error.message),
      )
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error))
    }
  })()
  return () => {
    stopped = true
    stop?.()
  }
}
