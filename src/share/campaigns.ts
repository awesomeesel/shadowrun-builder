/**
 * Sharing characters with the GM. The GM makes a campaign and gets a code
 * (plus an optional password); players join with it and pick characters,
 * which are then kept up to date for the GM while they play. Sheets are
 * sealed on the device (crypto.ts); the GM can read them, not change them.
 */
import { isConflictCopy } from '../cloud/conflicts'
import { FIREBASE_CONFIG } from '../config'
import { markDeleted } from '../gm/store'
import { db, type Campaign, type SharedSheet } from '../db/db'
import { CharacterSchema, migrateCharacter, type Character } from '../model/character'
import { deriveSession, generateCode, normalizeCode, seal, unseal, type SessionKeys } from './crypto'
import type { SheetDoc, Transport } from './transport'

/** What a player's sheet document holds once unsealed. */
interface SheetPayload {
  character: Character
}

interface CampaignMeta {
  name: string
}

let transport: Promise<Transport> | null = null

export const isSharingConfigured = () => FIREBASE_CONFIG !== null

/** The live transport, loading Firebase the first time. Throws when sharing isn't set up. */
export function getTransport(): Promise<Transport> {
  if (!transport) {
    if (!FIREBASE_CONFIG) return Promise.reject(new Error('Live sharing is not set up on this site.'))
    const config = FIREBASE_CONFIG
    transport = import('./firebase').then((m) => m.firebaseTransport(config))
  }
  return transport
}

/** For tests: use another transport. */
export function setTransport(t: Transport | null) {
  transport = t ? Promise.resolve(t) : null
  keys.clear()
}

const keys = new Map<string, Promise<SessionKeys>>()

/** Derive (once per code and password) the room id and key. */
function sessionKeys(code: string, password: string): Promise<SessionKeys> {
  const id = `${code}\n${password}`
  if (!keys.has(id)) keys.set(id, deriveSession(code, password))
  return keys.get(id)!
}

const keyFor = async (campaign: Campaign) => (await sessionKeys(campaign.code, campaign.password)).key

/** The campaign's sealing key (derived from its code and password). */
export const campaignKey = (campaign: Pick<Campaign, 'code' | 'password'>) =>
  sessionKeys(campaign.code, campaign.password).then((k) => k.key)

/** The link (and QR code) players open to join. The password is only included when asked for. */
export function joinLink(campaign: Pick<Campaign, 'code' | 'password'>, includePassword: boolean): string {
  const base = `${location.origin}${location.pathname}`
  const params = new URLSearchParams({ c: campaign.code })
  if (includePassword && campaign.password) params.set('p', campaign.password)
  return `${base}#/join?${params}`
}

/** A long random key, as hex. */
function randomSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Make a room on the server with a fresh code, and give it a GM key. */
async function makeRoom(
  name: string,
  password: string,
): Promise<{ roomId: string; code: string; gmSecret: string | undefined }> {
  const t = await getTransport()
  const gm = await t.userId()
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { roomId, key } = await sessionKeys(code, password)
    if (await t.getRoom(roomId)) continue
    await t.createRoom(roomId, {
      gm,
      meta: await seal(key, { name } satisfies CampaignMeta),
      createdAt: new Date().toISOString(),
    })
    // Servers with older rules refuse the key; the campaign works anyway, and ensureGmAccess tries again later.
    let gmSecret: string | undefined = randomSecret()
    await t.createGmKey(roomId, gmSecret).catch(() => (gmSecret = undefined))
    return { roomId, code, gmSecret }
  }
  throw new Error('Could not make a new campaign code; try again.')
}

/** GM: make a new campaign on the server and remember it here. */
export async function createCampaign(name: string, password: string): Promise<Campaign> {
  const { roomId, code, gmSecret } = await makeRoom(name, password)
  const campaign: Campaign = {
    id: roomId,
    role: 'gm',
    code,
    password,
    name,
    characterIds: [],
    pushed: {},
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gmSecret,
    gmAccess: 'ok',
  }
  await db.campaigns.put(campaign)
  return campaign
}

/**
 * GM: make sure this device may send to the players. The device that made the
 * campaign gives it a GM key if it has none yet (older campaigns), which then
 * reaches the GM's other devices through the Drive backup; another device
 * unlocks itself with that key. Returns what this device may do, and keeps it
 * on the campaign for the campaign page to explain.
 */
export async function ensureGmAccess(campaignId: string): Promise<Campaign['gmAccess']> {
  const campaign = await db.campaigns.get(campaignId)
  if (!campaign || campaign.role !== 'gm' || campaign.closed) return undefined
  const t = await getTransport()
  const uid = await t.userId()
  const room = await t.getRoom(campaign.id)
  if (!room) return campaign.gmAccess
  let access: Campaign['gmAccess']
  if (room.gm === uid) {
    access = 'ok'
    if (!campaign.gmSecret) {
      const gmSecret = randomSecret()
      try {
        await t.createGmKey(campaign.id, gmSecret)
        // Saved as a backed-up change, so it reaches the GM's other devices through Drive.
        await db.campaigns.update(campaign.id, { gmSecret, updatedAt: new Date().toISOString() })
      } catch {
        // A key was made before but lost here; other devices need the campaign moved instead.
      }
    }
  } else if (await t.isGm(campaign.id)) {
    access = 'ok'
  } else if (campaign.gmSecret) {
    try {
      await t.claimGm(campaign.id, campaign.gmSecret)
      access = 'ok'
    } catch {
      access = 'refused'
    }
  } else {
    access = 'no-key'
  }
  if (access !== campaign.gmAccess) await db.campaigns.update(campaign.id, { gmAccess: access })
  return access
}

/**
 * GM: when the device that made the campaign is gone, start the campaign over
 * on this device: a new code (players join again once), with everything else
 * kept: notes, cast, jobs, run log, sketch, encounters and imported runners.
 * The old campaign is left on the server for its players to leave.
 */
export async function moveCampaignHere(campaignId: string): Promise<Campaign> {
  const old = await db.campaigns.get(campaignId)
  if (!old) throw new Error('Campaign not found')
  const { roomId, code, gmSecret } = await makeRoom(old.name, old.password)
  const now = new Date().toISOString()
  const moved: Campaign = {
    ...old,
    id: roomId,
    code,
    gmSecret,
    gmAccess: 'ok',
    characterIds: [],
    pushed: {},
    joinedAt: now,
    updatedAt: now,
    joinHidden: false,
    error: undefined,
    lastSyncAt: undefined,
    closed: undefined,
  }
  await db.transaction('rw', [db.campaigns, db.encounters, db.sharedSheets, db.deletedGmItems], async () => {
    await db.campaigns.put(moved)
    await db.campaigns.delete(old.id)
    await markDeleted('campaign', old.id)
    await db.encounters.toCollection().modify((e) => {
      if (e.campaignId === old.id) {
        e.campaignId = roomId
        e.updatedAt = now
      }
    })
    for (const sheet of await db.sharedSheets.where('roomId').equals(old.id).toArray()) {
      await db.sharedSheets.delete(sheet.id)
      // Imported runners come along; live ones are shared again when the players rejoin.
      if (isFileSheet(sheet)) {
        await markDeleted('runner', sheet.id)
        await db.sharedSheets.put({ ...sheet, id: `${roomId}/${sheet.sheetId}`, roomId })
      }
    }
  })
  return moved
}

export type LookupResult =
  { ok: true; roomId: string; code: string; name: string } | { ok: false; reason: 'bad-code' | 'not-found' }

/** Player: check a code and password before joining, and get the campaign's name. */
export async function lookupCampaign(codeText: string, password: string): Promise<LookupResult> {
  const code = normalizeCode(codeText)
  if (!code) return { ok: false, reason: 'bad-code' }
  const t = await getTransport()
  const { roomId, key } = await sessionKeys(code, password)
  const room = await t.getRoom(roomId)
  if (!room) return { ok: false, reason: 'not-found' }
  try {
    const meta = await unseal<CampaignMeta>(key, room.meta)
    return { ok: true, roomId, code, name: meta.name }
  } catch {
    return { ok: false, reason: 'not-found' }
  }
}

/** Player: join (or update which characters are shared with) a campaign. */
export async function joinCampaign(
  found: Extract<LookupResult, { ok: true }>,
  password: string,
  characterIds: string[],
): Promise<Campaign> {
  const existing = await db.campaigns.get(found.roomId)
  const campaign: Campaign = existing
    ? { ...existing, characterIds: [...new Set([...existing.characterIds, ...characterIds])], closed: false }
    : {
        id: found.roomId,
        role: 'player',
        code: found.code,
        password,
        name: found.name,
        characterIds,
        pushed: {},
        joinedAt: new Date().toISOString(),
      }
  await db.campaigns.put(campaign)
  await syncCampaign(campaign.id)
  return campaign
}

/** Player: share or stop sharing one character with a campaign already joined. */
export async function setShared(campaignId: string, characterId: string, shared: boolean): Promise<void> {
  const campaign = await db.campaigns.get(campaignId)
  if (!campaign) return
  if (shared) {
    await db.campaigns.update(campaignId, { characterIds: [...new Set([...campaign.characterIds, characterId])] })
    await syncCampaign(campaignId)
  } else {
    await removeSheet(campaign, characterId)
  }
}

async function removeSheet(campaign: Campaign, characterId: string) {
  const { [characterId]: _, ...pushed } = campaign.pushed
  await db.campaigns.update(campaign.id, {
    characterIds: campaign.characterIds.filter((id) => id !== characterId),
    pushed,
  })
  try {
    const t = await getTransport()
    await t.deleteSheet(campaign.id, `${await t.userId()}_${characterId}`)
  } catch {
    // Gone already, or offline: the GM can remove it from their side.
  }
}

/** Player: stop sharing everything and forget the campaign. */
export async function leaveCampaign(campaignId: string): Promise<void> {
  const campaign = await db.campaigns.get(campaignId)
  if (!campaign) return
  for (const id of campaign.characterIds) await removeSheet(campaign, id)
  if (campaign.role === 'player') await db.campaigns.delete(campaignId)
}

/** GM: close the campaign for everyone, removing all shared sheets from the server. */
export async function closeCampaign(campaignId: string): Promise<void> {
  const t = await getTransport()
  try {
    await t.deleteRoom(campaignId)
  } catch (error) {
    if (/permission|insufficient/i.test(errorText(error))) throw new NotCampaignOwnerError()
    throw error
  }
  await forgetLocally(campaignId)
}

/**
 * The server only lets the device that made a campaign close it. On another
 * device (e.g. restored from Drive) the GM can still remove it from their own
 * screen and Drive.
 */
export class NotCampaignOwnerError extends Error {
  constructor() {
    super('This device isn’t unlocked as the campaign’s GM, so it can’t close it for the players.')
  }
}

/** GM: remove a campaign from this GM screen and the Drive backup, without closing it for players. */
export function removeCampaignHere(campaignId: string): Promise<void> {
  return forgetLocally(campaignId)
}

/** Remove a campaign, its sheets, and the link from its encounters, on this device. */
async function forgetLocally(campaignId: string) {
  await db.transaction('rw', [db.campaigns, db.sharedSheets, db.encounters, db.deletedGmItems], async () => {
    const campaign = await db.campaigns.get(campaignId)
    if (campaign?.role === 'gm') {
      await markDeleted('campaign', campaignId)
      for (const s of await db.sharedSheets.where('roomId').equals(campaignId).toArray()) {
        if (isFileSheet(s)) await markDeleted('runner', s.id)
      }
    }
    await db.campaigns.delete(campaignId)
    await db.sharedSheets.where('roomId').equals(campaignId).delete()
    // Encounters stay, as loose encounters.
    const updatedAt = new Date().toISOString()
    await db.encounters.toCollection().modify((e) => {
      if (e.campaignId === campaignId) {
        delete e.campaignId
        e.updatedAt = updatedAt
      }
    })
  })
}

/** GM: remove a player's sheet from the campaign. They can share it again. */
export async function removeSharedSheet(sheet: SharedSheet): Promise<void> {
  if (!isFileSheet(sheet)) {
    const t = await getTransport()
    await t.deleteSheet(sheet.roomId, sheet.sheetId)
  }
  await db.transaction('rw', db.sharedSheets, db.deletedGmItems, async () => {
    await db.sharedSheets.delete(sheet.id)
    if (isFileSheet(sheet)) await markDeleted('runner', sheet.id)
  })
}

/** Shareable copy of a character: portraits are left out when they'd make it too big. */
function forSharing(character: Character): Character {
  if (character.portrait && character.portrait.length > 300_000) return { ...character, portrait: undefined }
  return character
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

function isGone(error: unknown) {
  return /not-found|permission-denied|insufficient permissions/i.test(errorText(error))
}

/**
 * Player: send every shared character that changed since it was last sent.
 * Characters deleted on this device are removed from the campaign.
 */
export function syncCampaign(campaignId: string): Promise<void> {
  // One upload at a time per campaign; changes made meanwhile go in one more round.
  const running = syncing.get(campaignId)
  if (running) {
    running.again = true
    return running.done
  }
  const state = { again: false, done: Promise.resolve() }
  state.done = (async () => {
    do {
      state.again = false
      await syncOnce(campaignId)
    } while (state.again)
    syncing.delete(campaignId)
  })()
  syncing.set(campaignId, state)
  return state.done
}

const syncing = new Map<string, { again: boolean; done: Promise<void> }>()

async function syncOnce(campaignId: string): Promise<void> {
  const campaign = await db.campaigns.get(campaignId)
  if (!campaign || campaign.closed || campaign.characterIds.length === 0) return
  try {
    const t = await getTransport()
    const uid = await t.userId()
    const key = await keyFor(campaign)
    const pushed = { ...campaign.pushed }
    for (const characterId of campaign.characterIds) {
      const character = await db.characters.get(characterId)
      // Gone, or an older version kept from a sync clash: the GM shouldn't see it as another runner.
      if (!character || isConflictCopy(character)) {
        await removeSheet(campaign, characterId)
        continue
      }
      if (pushed[characterId] === character.updatedAt) continue
      const sheet: SheetDoc = {
        owner: uid,
        data: await seal(key, { character: forSharing(character) } satisfies SheetPayload),
        updatedAt: character.updatedAt,
      }
      await t.putSheet(campaign.id, `${uid}_${characterId}`, sheet)
      pushed[characterId] = character.updatedAt
    }
    const latest = await db.campaigns.get(campaignId)
    if (latest) {
      await db.campaigns.update(campaignId, {
        pushed: { ...latest.pushed, ...pushed },
        lastSyncAt: new Date().toISOString(),
        error: undefined,
      })
    }
  } catch (error) {
    if (campaign.role === 'player' && isGone(error)) {
      // The room was deleted: the GM closed the campaign.
      const room = await getTransport()
        .then((t) => t.getRoom(campaign.id))
        .catch(() => undefined)
      if (room === null) {
        await db.campaigns.update(campaignId, { closed: true, error: 'The GM closed this campaign.' })
        return
      }
    }
    await db.campaigns.update(campaignId, { error: errorText(error) })
  }
}

/**
 * GM: keep this device's copies of a campaign's sheets up to date. Returns a
 * function that stops watching.
 */
export function watchCampaign(campaign: Campaign, onError?: (message: string) => void): () => void {
  let stop: (() => void) | null = null
  let stopped = false
  void (async () => {
    try {
      const t = await getTransport()
      const key = await keyFor(campaign)
      if (stopped) return
      stop = t.watchSheets(
        campaign.id,
        (docs) => void storeSheets(campaign.id, key, docs),
        (error) => onError?.(errorText(error)),
      )
    } catch (error) {
      onError?.(errorText(error))
    }
  })()
  return () => {
    stopped = true
    stop?.()
  }
}

async function storeSheets(roomId: string, key: CryptoKey, docs: Map<string, SheetDoc>) {
  const sheets: SharedSheet[] = []
  for (const [sheetId, doc] of docs) {
    try {
      const payload = await unseal<SheetPayload>(key, doc.data)
      const parsed = CharacterSchema.safeParse(migrateCharacter(payload.character))
      if (!parsed.success) continue
      sheets.push({
        id: `${roomId}/${sheetId}`,
        roomId,
        sheetId,
        character: parsed.data,
        updatedAt: doc.updatedAt,
        receivedAt: new Date().toISOString(),
      })
    } catch {
      // Not sealed with this campaign's key; ignore it.
    }
  }
  await db.transaction('rw', db.sharedSheets, async () => {
    // Imported files aren't on the server; keep them.
    const existing = (await db.sharedSheets.where('roomId').equals(roomId).toArray()).filter((s) => !isFileSheet(s))
    const keep = new Set(sheets.map((s) => s.id))
    await db.sharedSheets.bulkDelete(existing.filter((s) => !keep.has(s.id)).map((s) => s.id))
    await db.sharedSheets.bulkPut(sheets)
  })
  await db.campaigns.update(roomId, { lastSyncAt: new Date().toISOString(), error: undefined })
}

/** Imported from a file rather than shared live. */
export const isFileSheet = (sheet: Pick<SharedSheet, 'sheetId'>) => sheet.sheetId.startsWith('file-')

/** GM: add a runner's exported file to a campaign (the no-internet way). */
export async function importSharedFile(roomId: string, character: Character): Promise<SharedSheet> {
  const sheetId = `file-${character.id}`
  const sheet: SharedSheet = {
    id: `${roomId}/${sheetId}`,
    roomId,
    sheetId,
    character,
    updatedAt: character.updatedAt,
    receivedAt: new Date().toISOString(),
  }
  await db.sharedSheets.put(sheet)
  return sheet
}

/**
 * The newest copy of the character a shared sheet holds, in the same campaign.
 * A player who shares from a new device (or after clearing their browser)
 * gets a new sheet id; links made to the old one should follow the new one.
 */
export function newestSheet(sheets: SharedSheet[], sheetId: string): SharedSheet | undefined {
  const sheet = sheets.find((s) => s.id === sheetId)
  if (!sheet) return undefined
  return sheets
    .filter((s) => s.roomId === sheet.roomId && s.character.id === sheet.character.id)
    .reduce((best, s) => (s.updatedAt > best.updatedAt ? s : best), sheet)
}

/** Shared sheets in a URL: their ids contain a slash. */
export const sheetPath = (sheet: SharedSheet) => `/gm/sheet/${encodeURIComponent(sheet.id)}`

/**
 * The newest copy of each character among shared sheets: a player who cleared
 * their browser shares under a new id, and a file may also have been imported.
 */
export function latestSheets(sheets: SharedSheet[]): SharedSheet[] {
  const byCharacter = new Map<string, SharedSheet>()
  for (const s of sheets) {
    const current = byCharacter.get(s.character.id)
    if (!current || s.updatedAt > current.updatedAt) byCharacter.set(s.character.id, s)
  }
  return [...byCharacter.values()].sort((a, b) => a.character.name.localeCompare(b.character.name))
}
