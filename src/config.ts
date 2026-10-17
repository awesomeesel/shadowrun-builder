/**
 * Google OAuth client ID for Drive sync. It identifies the app to Google and is
 * public by design (it's visible in every browser that loads the app). See
 * GOOGLE_DRIVE_SETUP.md for how to create one. Leave empty to hide Drive sync.
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/**
 * Firebase web app settings for sharing sheets with the GM, as the JSON object
 * Firebase shows when you add a web app. Public by design, like the client ID
 * above; the security rules in firestore.rules decide who may do what. See
 * FIREBASE_SETUP.md. Leave empty to offer only "Send a copy".
 */
export const FIREBASE_CONFIG: Record<string, string> | null = (() => {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG
  if (!raw) return null
  try {
    // Accept the snippet as Firebase prints it too: `{ apiKey: "…", … }` without quoted keys.
    return JSON.parse(
      raw
        .trim()
        .replace(/;$/, '')
        .replace(/([{,]\s*)([A-Za-z]+)\s*:/g, '$1"$2":'),
    )
  } catch {
    console.warn('VITE_FIREBASE_CONFIG is not valid JSON; live sharing is off.')
    return null
  }
})()
