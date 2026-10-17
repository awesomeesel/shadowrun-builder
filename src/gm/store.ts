/**
 * Writes to the GM's own data (campaign notes, run log, encounters), keeping
 * the timestamps and deletion records that Drive backup relies on.
 */
import { db, type Campaign } from '../db/db'

const now = () => new Date().toISOString()

/** Remember a deletion so Drive sync removes the backup too. */
export function markDeleted(kind: 'campaign' | 'encounter' | 'runner', itemId: string) {
  return db.deletedGmItems.put({ id: `${kind}:${itemId}`, deletedAt: now() })
}

/** Change what a campaign backs up (notes, run log, join panel…). */
export function updateCampaign(id: string, changes: Partial<Campaign>) {
  return db.campaigns.update(id, { ...changes, updatedAt: now() })
}

export function moveEncounter(id: string, campaignId: string | undefined) {
  return db.encounters.update(id, { campaignId, updatedAt: now() })
}

export async function deleteEncounter(id: string) {
  await db.transaction('rw', db.encounters, db.deletedGmItems, async () => {
    await db.encounters.delete(id)
    await markDeleted('encounter', id)
  })
}
