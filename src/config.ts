/**
 * Google OAuth client ID for Drive sync. It identifies the app to Google and is
 * public by design (it's visible in every browser that loads the app). See
 * GOOGLE_DRIVE_SETUP.md for how to create one. Leave empty to hide Drive sync.
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
