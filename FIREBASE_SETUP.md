# Setting up live sharing with the GM (Firebase)

Players share their characters with the GM through a free Firebase project. Sheets are encrypted on the
player's device with the campaign code and password, so Firebase only ever stores ciphertext. The free
(Spark) plan needs no credit card; a gaming group uses a tiny part of its daily limits (50,000 reads and
20,000 writes a day).

Without this setup the app still works: players use **Send a copy** and the GM imports the file.

## 1. Create the project

1. Open <https://console.firebase.google.com> and sign in with a Google account.
2. **Create a project**, e.g. `shadowrun-builder`. Google Analytics isn't needed; turn it off.
3. Stay on the free **Spark** plan. Don't upgrade.

## 2. Turn on anonymous sign-in

1. **Build → Authentication → Get started**.
2. **Sign-in method → Anonymous → Enable → Save**.
3. **Settings → Authorized domains → Add domain**: `awesomeesel.github.io` (`localhost` is there already).

## 3. Create the database

1. **Build → Firestore Database → Create database**.
2. Pick a location near your group (e.g. `eur3` for Europe). It can't be changed later.
3. Start in **production mode**.
4. Open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and
   **Publish**.

## 4. Register the web app

1. **Project settings** (gear icon) → **General → Your apps → Web** (`</>`).
2. Give it a nickname, leave Firebase Hosting off, **Register app**.
3. Copy the `firebaseConfig` object it shows, the part from `{` to `}`:

   ```js
   {
     apiKey: "AIza…",
     authDomain: "shadowrun-builder.firebaseapp.com",
     projectId: "shadowrun-builder",
     storageBucket: "…",
     messagingSenderId: "…",
     appId: "1:…:web:…"
   }
   ```

   These values are public by design (every visitor's browser sees them); the security rules protect the data.

## 5. Give the config to the site

- **Live site:** GitHub repository → **Settings → Secrets and variables → Actions → Variables → New repository
  variable**, name `FIREBASE_CONFIG`, value the object above. The next deploy picks it up (re-run the latest
  "Deploy to GitHub Pages" workflow to deploy now). Variables are free and don't change the GitHub plan.
- **Local development:** create `.env.local` (not committed) with the object on one line:

  ```
  VITE_FIREBASE_CONFIG={ apiKey: "AIza…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" }
  ```

## 6. Optional: lock the API key to the site

Google Cloud console → **APIs & Services → Credentials** → the "Browser key (auto created by Firebase)" →
**Application restrictions: Websites** → add `https://awesomeesel.github.io/*` and `http://localhost:*`.

## How it works

- The GM makes a campaign and gets a code like `K7QM-4XRA-P2DN`, plus an optional password.
- The code and password together give the campaign's database id and its encryption key (PBKDF2 → AES-GCM).
  Neither is sent anywhere. The QR code carries them in the link's `#` part, which browsers never send to a server.
- Players write only their own sheets (`rooms/{room}/sheets/{theirUserId}_{characterId}`); the GM can read
  and remove them; only the GM can close the campaign. See `firestore.rules`.
- Closing a campaign deletes every shared sheet from Firebase.
