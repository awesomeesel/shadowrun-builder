/**
 * The battle map the GM shows the players, published on the campaign's board
 * (sealed, like everything else). One map per campaign at a time; showing
 * another encounter's map replaces it, and hiding it clears it.
 */
import { db, type Campaign, type MapBoard, type SharedSheet } from '../db/db'
import type { Encounter } from '../model/encounter'
import { tokenViews } from '../map/tokens'
import type { BattleMap, TokenView } from '../map/battleMap'
import { campaignKey, getTransport } from './campaigns'
import { seal, unseal } from './crypto'

export interface MapPayload {
  title: string
  map: BattleMap
  tokens: TokenView[]
}

/** GM: publish the map shown to players, or null to take it down. */
export async function publishMap(campaign: Campaign, payload: MapPayload | null): Promise<void> {
  const t = await getTransport()
  await t.putBoard(campaign.id, 'map', {
    data: await seal(await campaignKey(campaign), { payload }),
    updatedAt: new Date().toISOString(),
  })
}

/** Player: keep this device's copy of a joined campaign's map up to date. */
export function watchMap(campaign: Campaign, onError?: (message: string) => void): () => void {
  let stop: (() => void) | null = null
  let stopped = false
  void (async () => {
    try {
      const t = await getTransport()
      const key = await campaignKey(campaign)
      if (stopped) return
      stop = t.watchBoard(
        campaign.id,
        'map',
        (doc) =>
          void (async () => {
            try {
              const payload = doc ? (await unseal<{ payload: MapPayload | null }>(key, doc.data)).payload : null
              if (!payload || !doc) {
                await db.mapBoards.delete(campaign.id)
                return
              }
              const board: MapBoard = { roomId: campaign.id, ...payload, updatedAt: doc.updatedAt }
              await db.mapBoards.put(board)
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

/**
 * What each campaign should show its players: the most recently changed
 * encounter whose map is shown, or null. Runners shared live get their
 * character id on the token, so players can find their own.
 */
export function mapPayloads(
  encounters: Encounter[],
  sheets: Pick<SharedSheet, 'id' | 'character'>[],
): Map<string, MapPayload | null> {
  const characterOf = new Map(sheets.map((s) => [`shared:${s.id}`, s.character.id]))
  const result = new Map<string, MapPayload | null>()
  const shown = encounters
    .filter((e) => e.campaignId && e.map?.shown)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const e of shown) {
    if (result.has(e.campaignId!)) continue
    const { shown: _, ...map } = e.map!
    result.set(e.campaignId!, {
      title: e.name,
      map: { ...map, shown: true },
      tokens: tokenViews(e, (p) => (p.characterId ? characterOf.get(p.characterId) : undefined)),
    })
  }
  return result
}
