/**
 * Messages from the GM to a shared runner: damage to resist or take, a
 * status, Edge, or karma and nuyen. Nothing changes on a player's sheet until
 * they accept; they can always decline. The GM can switch each kind off per
 * campaign, and nothing is sent without the GM choosing to.
 */
import { db, type Campaign, type InboxItem, type OutboxItem, type SharedSheet } from '../db/db'
import { PlayStatusSchema, type Character } from '../model/character'
import { computeDerived } from '../rules/sr6/derived'
import { addLedgerEntry, applyDamage } from '../rules/sr6/play'
import { statusLabel } from '../rules/sr6/statuses'
import { campaignKey, getTransport, isFileSheet } from './campaigns'
import { seal, unseal } from './crypto'
import type { MessageDoc } from './transport'

export type GmMessage =
  /** `resist`: the player rolls to soak it first; otherwise the boxes go straight on. */
  | { kind: 'damage'; value: number; type: 'P' | 'S'; resist: boolean; note: string }
  | { kind: 'status'; name: string; value: number; rounds: number | null; note: string }
  | { kind: 'edge'; amount: number; note: string }
  | { kind: 'reward'; karma: number; nuyen: number; note: string }
  /** A map, a message, a picture: shown to the player, kept if they like. Never changes the sheet. */
  | { kind: 'handout'; title: string; text: string; image?: string; note: string }

interface MessagePayload {
  message: GmMessage
  characterId: string
  campaignName: string
  sentAt: string
}

const MAX_EDGE = 7

/** What the GM may send in this campaign. */
export function gmSends(campaign: Pick<Campaign, 'gmSends'>): { damage: boolean; rewards: boolean } {
  return { damage: true, rewards: true, ...campaign.gmSends }
}

/** Whether this kind of message is switched on for the campaign. */
export function allowed(campaign: Pick<Campaign, 'gmSends'>, kind: GmMessage['kind']): boolean {
  if (kind === 'handout') return true
  const sends = gmSends(campaign)
  return kind === 'reward' ? sends.rewards : sends.damage
}

/** "Resist 6P", "Burning 3 for 2 rounds", "+1 Edge", "5 karma and 4 000¥". */
export function describeMessage(m: GmMessage): string {
  switch (m.kind) {
    case 'damage':
      return m.resist ? `Resist ${m.value}${m.type}` : `Take ${m.value} ${m.type === 'P' ? 'Physical' : 'Stun'}`
    case 'status':
      return `${statusLabel(m)}${m.rounds ? ` for ${m.rounds} ${m.rounds === 1 ? 'round' : 'rounds'}` : ''}`
    case 'edge':
      return `${m.amount > 0 ? '+' : ''}${m.amount} Edge`
    case 'reward':
      return [m.karma && `${m.karma} karma`, m.nuyen && `${m.nuyen.toLocaleString()}¥`].filter(Boolean).join(' and ')
    case 'handout':
      return `Handout: ${m.title || 'from the GM'}`
  }
}

/**
 * Apply a message to the character. Damage to resist isn't applied here: the
 * player rolls it in the damage dialog first.
 */
export function applyMessage(character: Character, m: GmMessage, now = new Date()): Character {
  switch (m.kind) {
    case 'damage':
      return applyDamage(character, m.value, m.type)
    case 'status': {
      // Same status again replaces the old one (Burning 2 becomes Burning 4).
      const others = character.play.statuses.filter((s) => s.name.toLowerCase() !== m.name.toLowerCase())
      const status = PlayStatusSchema.parse({ name: m.name, value: m.value, rounds: m.rounds })
      return { ...character, play: { ...character.play, statuses: [...others, status] } }
    }
    case 'edge': {
      const edge = character.play.edge ?? computeDerived(character).attributes.edge
      return { ...character, play: { ...character.play, edge: Math.max(0, Math.min(MAX_EDGE, edge + m.amount)) } }
    }
    case 'reward':
      return addLedgerEntry(
        character,
        { karma: m.karma, nuyen: m.nuyen, note: m.note ? `From the GM: ${m.note}` : 'From the GM' },
        now,
      )
    case 'handout':
      // Kept in its own table (see keepHandout), so pictures don't make the sheet heavy.
      return character
  }
}

/** GM: send a message to a runner shared live in the campaign. */
export async function sendToRunner(campaign: Campaign, sheet: SharedSheet, message: GmMessage): Promise<void> {
  if (isFileSheet(sheet)) throw new Error('This runner came from a file; only live shared runners can receive.')
  if (!allowed(campaign, message.kind)) throw new Error('Sending this is switched off for the campaign.')
  const t = await getTransport()
  const sentAt = new Date().toISOString()
  const payload: MessagePayload = { message, characterId: sheet.character.id, campaignName: campaign.name, sentAt }
  const doc: MessageDoc = {
    to: sheet.sheetId,
    data: await seal(await campaignKey(campaign), payload),
    createdAt: sentAt,
  }
  try {
    await t.sendMessage(campaign.id, doc)
  } catch (error) {
    if (/permission|insufficient/i.test(String(error))) {
      throw new Error(
        'The server refused. Only the device that made the campaign can send, and the Firestore rules must be the latest from firestore.rules.',
      )
    }
    throw error
  }
}

/** GM: take back a message the player hasn't handled yet. */
export async function cancelMessage(item: OutboxItem): Promise<void> {
  const t = await getTransport()
  await t.deleteMessage(item.roomId, item.messageId)
  await db.outbox.delete(item.id)
}

/** Unseal what's on the server for this campaign; anything else is skipped. */
async function open(key: CryptoKey, docs: Map<string, MessageDoc>) {
  const out: { id: string; doc: MessageDoc; payload: MessagePayload }[] = []
  for (const [id, doc] of docs) {
    try {
      out.push({ id, doc, payload: await unseal<MessagePayload>(key, doc.data) })
    } catch {
      // Not sealed with this campaign's key.
    }
  }
  return out
}

/** GM: keep a local list of messages still waiting for players. */
export function watchOutbox(campaign: Campaign, onError?: (message: string) => void): () => void {
  return watch(
    async (t, key) =>
      t.watchMessages(
        campaign.id,
        null,
        (docs) =>
          void open(key, docs).then(async (messages) => {
            const items: OutboxItem[] = messages.map(({ id, doc, payload }) => ({
              id: `${campaign.id}/${id}`,
              roomId: campaign.id,
              messageId: id,
              to: doc.to,
              message: payload.message,
              sentAt: payload.sentAt,
            }))
            await replace(db.outbox, campaign.id, items)
          }),
        (error) => onError?.(error.message),
      ),
    campaign,
    onError,
  )
}

/** Player: keep the local inbox for one shared character up to date. */
export function watchInbox(campaign: Campaign, characterId: string, onError?: (message: string) => void): () => void {
  return watch(
    async (t, key) => {
      const to = `${await t.userId()}_${characterId}`
      return t.watchMessages(
        campaign.id,
        to,
        (docs) =>
          void open(key, docs).then(async (messages) => {
            const items: InboxItem[] = messages
              .filter(({ payload }) => payload.characterId === characterId)
              .map(({ id, payload }) => ({
                id: `${campaign.id}/${id}`,
                roomId: campaign.id,
                messageId: id,
                characterId,
                campaignName: payload.campaignName,
                message: payload.message,
                sentAt: payload.sentAt,
              }))
            const handled = await db.transaction('rw', db.inbox, async () => {
              const existing = await db.inbox
                .where('characterId')
                .equals(characterId)
                .filter((i) => i.roomId === campaign.id)
                .toArray()
              const done = new Set(existing.filter((i) => i.handled).map((i) => i.id))
              const keep = new Set(items.map((i) => i.id))
              await db.inbox.bulkDelete(existing.filter((i) => !keep.has(i.id)).map((i) => i.id))
              // Handled here already (while offline): keep the mark so it isn't shown or applied again.
              await db.inbox.bulkPut(items.map((i) => (done.has(i.id) ? { ...i, handled: true } : i)))
              return items.filter((i) => done.has(i.id))
            })
            // Try again to remove those from the server.
            for (const item of handled) void removeFromServer(item)
          }),
        (error) => onError?.(error.message),
      )
    },
    campaign,
    onError,
  )
}

async function replace(table: typeof db.outbox, roomId: string, items: OutboxItem[]) {
  await db.transaction('rw', table, async () => {
    await table.where('roomId').equals(roomId).delete()
    await table.bulkPut(items)
  })
}

/** Start a watcher once the transport and key are ready; the returned function stops it either way. */
function watch(
  start: (t: Awaited<ReturnType<typeof getTransport>>, key: CryptoKey) => Promise<() => void>,
  campaign: Campaign,
  onError?: (message: string) => void,
): () => void {
  let stop: (() => void) | null = null
  let stopped = false
  void (async () => {
    try {
      const t = await getTransport()
      const key = await campaignKey(campaign)
      if (stopped) return
      const s = await start(t, key)
      if (stopped) s()
      else stop = s
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error))
    }
  })()
  return () => {
    stopped = true
    stop?.()
  }
}

/** Player: keep a handout on this device, then clear it from the inbox. */
export async function keepHandout(item: InboxItem): Promise<void> {
  const m = item.message
  if (m.kind !== 'handout') return
  await db.handouts.put({
    id: item.id,
    characterId: item.characterId,
    campaignName: item.campaignName,
    title: m.title,
    text: m.text,
    image: m.image,
    receivedAt: item.sentAt,
  })
  await dismissMessage(item)
}

/** Player: done with a message (accepted or declined); remove it everywhere. */
export async function dismissMessage(item: InboxItem): Promise<void> {
  await db.inbox.update(item.id, { handled: true })
  await removeFromServer(item)
}

async function removeFromServer(item: InboxItem) {
  try {
    const t = await getTransport()
    await t.deleteMessage(item.roomId, item.messageId)
    await db.inbox.delete(item.id)
  } catch {
    // Offline: it stays marked as handled here and is removed on the next connection.
  }
}
