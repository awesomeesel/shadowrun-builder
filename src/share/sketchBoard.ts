/**
 * The GM's sketch, shown to the players on the campaign's board (sealed, like
 * everything else). The GM sends it on purpose: Show sends the pad as it is,
 * Update sends it again after more drawing, Hide takes it down.
 */
import { db, type Campaign } from '../db/db'
import type { SketchStroke } from '../map/sketch'
import { campaignKey, getTransport } from './campaigns'
import { seal, unseal } from './crypto'

/** GM: send the sketch to the players, or null to take it down. */
export async function publishSketch(campaign: Campaign, strokes: SketchStroke[] | null): Promise<void> {
  const t = await getTransport()
  await t.putBoard(campaign.id, 'sketch', {
    data: await seal(await campaignKey(campaign), { strokes }),
    updatedAt: new Date().toISOString(),
  })
}

/** Player: keep this device's copy of a joined campaign's sketch up to date. */
export function watchSketch(campaign: Campaign, onError?: (message: string) => void): () => void {
  let stop: (() => void) | null = null
  let stopped = false
  void (async () => {
    try {
      const t = await getTransport()
      const key = await campaignKey(campaign)
      if (stopped) return
      stop = t.watchBoard(
        campaign.id,
        'sketch',
        (doc) =>
          void (async () => {
            try {
              const strokes = doc ? (await unseal<{ strokes: SketchStroke[] | null }>(key, doc.data)).strokes : null
              if (!strokes || !doc) await db.sketchBoards.delete(campaign.id)
              else await db.sketchBoards.put({ roomId: campaign.id, strokes, updatedAt: doc.updatedAt })
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
