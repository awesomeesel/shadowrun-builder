/**
 * Google sign-in for Drive using Google Identity Services' token model, which
 * works in a static site without a server. Tokens last about an hour; getting a
 * new one opens a short popup, so it has to happen during a click.
 */
import { GOOGLE_CLIENT_ID } from '../config'

/** Only files this app creates; the app can't see anything else in the user's Drive. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_KEY = 'shadowrun-builder:google-token'
const CONNECTED_KEY = 'shadowrun-builder:google-connected'
/** Treat tokens as expired a little early, so a sync doesn't fail halfway. */
const EXPIRY_MARGIN_MS = 2 * 60_000

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void
}

interface GoogleOAuth {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth } }
  }
}

export const isDriveConfigured = () => GOOGLE_CLIENT_ID !== ''

let scriptPromise: Promise<void> | undefined

/** Load Google's sign-in script. Done early so a later click can open the popup right away. */
export function loadGoogleScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = undefined
      reject(new Error('Could not load Google sign-in. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

function readStored(): { token: string; expiresAt: number } | null {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null')
    return stored && typeof stored.token === 'string' ? stored : null
  } catch {
    return null
  }
}

/** A still-valid access token, without any popup; null when a click is needed. */
export function storedToken(): string | null {
  const stored = readStored()
  return stored && stored.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? stored.token : null
}

/** True once the user has connected on this device (they may still need a fresh token). */
export function wasConnected(): boolean {
  try {
    return localStorage.getItem(CONNECTED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Ask Google for a token. Call from a click handler: it opens a popup, which
 * browsers block otherwise. Users who already agreed see it close by itself.
 */
export function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2
    if (!oauth) {
      // Script not ready yet: load it, but the popup may now be blocked, so ask for another click.
      void loadGoogleScript()
      reject(new Error('Google sign-in is still loading. Please click again.'))
      return
    }
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? 'Google sign-in failed'))
          return
        }
        try {
          localStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({
              token: response.access_token,
              expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
            }),
          )
          localStorage.setItem(CONNECTED_KEY, '1')
        } catch {
          // Storage blocked: the token still works for this page.
        }
        resolve(response.access_token)
      },
      error_callback: (error) =>
        reject(new Error(error.type === 'popup_closed' ? 'Sign-in window was closed' : (error.message ?? error.type))),
    })
    client.requestAccessToken({ prompt: wasConnected() ? '' : 'consent' })
  })
}

/** Sign out of Drive on this device and revoke the app's access token. */
export function forgetGoogle() {
  const token = readStored()?.token
  if (token) window.google?.accounts?.oauth2.revoke(token)
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(CONNECTED_KEY)
  } catch {
    // nothing stored
  }
}
