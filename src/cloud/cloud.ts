/**
 * Drive sync controller: connection state, automatic syncing after changes,
 * and book upload/download for the UI.
 */
import { useSyncExternalStore } from 'react'
import { db, type Book } from '../db/db'
import { downloadBook, listRemoteBooks, uploadBook, type RemoteBook } from './books'
import { DriveError, GoogleDrive, type DriveUser } from './drive'
import { forgetGoogle, isDriveConfigured, loadGoogleScript, requestToken, storedToken, wasConnected } from './google'
import { syncGmData, type GmSyncReport } from './gmSync'
import { describeReport, syncCharacters } from './sync'

export type CloudStatus =
  /** No Google client ID configured: Drive sync is hidden. */
  | 'off'
  | 'disconnected'
  | 'idle'
  | 'syncing'
  /** Connected before, but the hour-long access token ran out: one click to continue. */
  | 'reconnect'
  | 'error'

export interface CloudState {
  status: CloudStatus
  user?: DriveUser
  lastSync?: string
  message?: string
  error?: string
}
const PROFILE_KEY = 'shadowrun-builder:drive-profile'
const SYNC_DELAY_MS = 3000

let state: CloudState = { status: 'off' }
const listeners = new Set<() => void>()

function setState(change: Partial<CloudState>) {
  state = { ...state, ...change }
  if (state.user) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ user: state.user, lastSync: state.lastSync }))
    } catch {
      // storage blocked
    }
  }
  listeners.forEach((l) => l())
}

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

const drive = new GoogleDrive(async () => {
  const token = storedToken()
  if (!token) throw new DriveError('Google Drive sign-in expired', 401)
  return token
})

// Folder ids are looked up once per session.
let folders: Promise<{ root: string; characters: string; books: string; gm: string }> | undefined
function getFolders() {
  folders ??= (async () => {
    const root = await drive.folder('Shadowrun Builder')
    const [characters, books, gm] = await Promise.all([
      drive.folder('Characters', root),
      drive.folder('Books', root),
      drive.folder('GM', root),
    ])
    return { root, characters, books, gm }
  })()
  folders.catch(() => (folders = undefined))
  return folders
}

export async function driveFolderUrl(): Promise<string> {
  return `https://drive.google.com/drive/folders/${(await getFolders()).root}`
}

function handleError(error: unknown) {
  if (error instanceof DriveError && error.status === 401) {
    setState({ status: 'reconnect', error: undefined })
    return
  }
  setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
}

/**
 * Make sure we have a token. With `interactive`, may open Google's popup, so
 * only pass true from a click handler and before any await.
 */
function ensureToken(interactive: boolean): Promise<string | null> {
  const token = storedToken()
  if (token) return Promise.resolve(token)
  if (!interactive) return Promise.resolve(null)
  return requestToken()
}

let syncing = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

/** Sync characters now. Pass `interactive` from clicks so an expired sign-in can be renewed. */
export async function syncNow({ interactive = false } = {}): Promise<void> {
  if (state.status === 'off' || state.status === 'disconnected') return
  let token: string | null
  try {
    token = await ensureToken(interactive)
  } catch (error) {
    handleError(error)
    return
  }
  if (!token) {
    setState({ status: 'reconnect' })
    return
  }
  if (syncing) {
    again = true
    return
  }
  syncing = true
  setState({ status: 'syncing', error: undefined })
  try {
    if (!state.user) setState({ user: await drive.about() })
    const { characters, gm } = await getFolders()
    const report = await syncCharacters(drive, characters)
    const gmReport = await syncGmData(drive, gm)
    const conflicts = report.conflicts.length
      ? ` Edited on two devices: ${report.conflicts.join(', ')} (both versions kept).`
      : ''
    setState({
      status: 'idle',
      lastSync: new Date().toISOString(),
      message: describeReport(report) + conflicts + describeGmReport(gmReport),
    })
  } catch (error) {
    handleError(error)
  } finally {
    syncing = false
    if (again) {
      again = false
      scheduleSync()
    }
  }
}

function describeGmReport(report: GmSyncReport): string {
  const parts = [
    report.uploaded && `${report.uploaded} saved`,
    report.downloaded && `${report.downloaded} updated from Drive`,
    report.deletedInDrive && `${report.deletedInDrive} moved to Drive trash`,
    report.deletedHere && `${report.deletedHere} removed (deleted on another device)`,
  ].filter(Boolean)
  const conflicts = report.conflicts.length ? ` (edited on two devices: ${report.conflicts.join(', ')})` : ''
  return parts.length ? `. GM data: ${parts.join(', ')}${conflicts}.` : ''
}

/** Sync a moment after local changes settle. */
export function scheduleSync() {
  if (syncing) {
    again = true
    return
  }
  if (state.status !== 'idle' && state.status !== 'error') return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), SYNC_DELAY_MS)
}

/**
 * Renew an expired Google sign-in during a click (e.g. starting or ending a
 * session), so the automatic sync after the change can reach Drive.
 */
export function keepDriveSignedIn() {
  if (state.status !== 'reconnect' && !(state.status === 'idle' && !storedToken())) return
  requestToken().then(
    () => {
      setState({ status: 'idle', error: undefined })
      scheduleSync()
    },
    () => setState({ status: 'reconnect' }),
  )
}

/** First connection (from a click): sign in, then sync. */
export async function connectDrive(): Promise<void> {
  try {
    await requestToken()
    setState({ status: 'idle', error: undefined, user: await drive.about() })
    folders = undefined
    await syncNow()
  } catch (error) {
    if (state.user) handleError(error)
    else setState({ status: 'disconnected', error: error instanceof Error ? error.message : String(error) })
  }
}

/** Stop syncing on this device. Characters stay here and in Drive. */
export function disconnectDrive() {
  forgetGoogle()
  folders = undefined
  try {
    localStorage.removeItem(PROFILE_KEY)
  } catch {
    // storage blocked
  }
  setState({ status: 'disconnected', user: undefined, lastSync: undefined, message: undefined, error: undefined })
}

/** Run with a valid token, renewing it from a click if needed. */
async function withDrive<T>(task: () => Promise<T>): Promise<T> {
  const token = await ensureToken(true)
  if (!token) throw new Error('Not connected to Google Drive')
  try {
    return await task()
  } catch (error) {
    handleError(error)
    throw error
  }
}

export function uploadBookToDrive(book: Book, onProgress?: (fraction: number) => void) {
  return withDrive(async () => uploadBook(drive, (await getFolders()).books, book, onProgress))
}

export function remoteBooks(): Promise<RemoteBook[]> {
  return withDrive(async () => listRemoteBooks(drive, (await getFolders()).books))
}

export function downloadRemoteBook(remote: RemoteBook, onProgress?: (fraction: number) => void) {
  return withDrive(() => downloadBook(drive, remote, onProgress))
}

/** Start background syncing. Call once when the app loads. */
export function initCloud() {
  if (!isDriveConfigured()) return
  let profile: { user?: DriveUser; lastSync?: string } = {}
  try {
    profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}')
  } catch {
    // ignore
  }
  if (!wasConnected()) {
    setState({ status: 'disconnected' })
  } else {
    setState({ status: storedToken() ? 'idle' : 'reconnect', user: profile.user, lastSync: profile.lastSync })
  }
  // Load Google's script now, so a later click can open its popup straight away.
  void loadGoogleScript().catch(() => {})

  const onChange = () => {
    if (!syncing) scheduleSync()
  }
  db.characters.hook('creating', onChange)
  db.characters.hook('updating', onChange)
  db.characters.hook('deleting', onChange)
  db.deletedCharacters.hook('creating', onChange)
  // GM data: campaigns only when backed-up fields change (not sharing bookkeeping), runners only from files.
  db.campaigns.hook('creating', (_key, obj) => {
    if (obj.role === 'gm') onChange()
  })
  db.campaigns.hook('updating', (mods) => {
    if ('updatedAt' in mods) onChange()
  })
  db.encounters.hook('creating', onChange)
  db.encounters.hook('updating', onChange)
  db.sharedSheets.hook('creating', (_key, obj) => {
    if (obj.sheetId.startsWith('file-')) onChange()
  })
  db.deletedGmItems.hook('creating', onChange)
  window.addEventListener('focus', () => scheduleSync())
  window.addEventListener('online', () => scheduleSync())
  if (state.status === 'idle') void syncNow()
}
