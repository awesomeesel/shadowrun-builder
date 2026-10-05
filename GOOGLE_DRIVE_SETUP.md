# Setting up Google Drive sync

Drive sync lets each player keep their characters (and, if they want, their rulebook PDFs) in their own
Google Drive and open them in any browser. It needs a free **OAuth client ID** from Google. You set this up
once for the app; players just click "Connect Google Drive". No billing account is needed.

Google's console changes its layout from time to time, so names below may differ slightly.

## 1. Create a project

1. Go to <https://console.cloud.google.com/> and sign in with your Google account.
2. Use the project picker at the top → **New project**. Name it `Shadowrun Builder` and create it.

## 2. Turn on the Drive API

1. With the new project selected, open **APIs & Services → Library**.
2. Search for **Google Drive API** and click **Enable**.

## 3. Describe the app to Google (consent screen)

1. Open **Google Auth Platform** (older consoles: **APIs & Services → OAuth consent screen**) → **Get started**.
2. App name: `Shadowrun Builder`. User support email: your email.
3. Audience: **External**.
4. Contact email: your email. Agree to the policy and create.
5. Under **Data access** (or **Scopes**), add the scope
   `https://www.googleapis.com/auth/drive.file` ("See, edit, create and delete only the specific Google
   Drive files you use with this app"). This is the only permission the app asks for.
6. Under **Audience**, choose one:
   - **Publish app** (status "In production"): anyone with a Google account can connect. `drive.file` is
     a non-sensitive permission, so Google shouldn't require a review for it.
   - Or keep it in **Testing** and add each player's Google address under **Test users** (up to 100).

## 4. Create the client ID

1. Open **Clients** (older consoles: **Credentials → Create credentials → OAuth client ID**).
2. Application type: **Web application**. Name: `Shadowrun Builder web`.
3. **Authorized JavaScript origins**, add both:
   - `https://awesomeesel.github.io`
   - `http://localhost:5173`
4. Leave **Authorized redirect URIs** empty and click **Create**.
5. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`.

The client ID is public by design: every browser that runs the app can see it. If Google also shows a
**client secret**, you don't need it. Don't put it anywhere.

## 5. Give the app the client ID

- **Live site:** add it as a repository *variable* (not a secret):

  ```bash
  gh variable set GOOGLE_CLIENT_ID --body "YOUR-ID.apps.googleusercontent.com"
  ```

  The next deploy picks it up (push a commit, or re-run the "Deploy to GitHub Pages" workflow).
- **Local development:** create `.env.local` in the project folder (it isn't committed):

  ```
  VITE_GOOGLE_CLIENT_ID=YOUR-ID.apps.googleusercontent.com
  ```

## How it works for players

- **Connect Google Drive** on the start page. Google asks once for permission.
- Characters are saved in a `Shadowrun Builder/Characters` folder and sync automatically after changes.
  Edited on two devices at once? The newest version wins and the other is kept as "(other version)".
- In the Library, **Save to Google Drive** uploads a PDF to `Shadowrun Builder/Books`. On another device,
  the Library lists those books with a **Download** button.
- Google sign-ins last about an hour in a browser app. After that a **Reconnect** button appears; one
  click continues, usually without logging in again.
