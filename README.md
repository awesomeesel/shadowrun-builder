# Shadowrun Builder

A fast, local-first character builder and manager for **Shadowrun 6th Edition**, running in the browser.

- Characters are stored in your browser (IndexedDB). Nothing is sent to a server.
- Import and export characters as `.sr6char.json` files, or back up everything at once.
- Works on desktop and mobile.

No rulebook text or art is included. Planned: link your own SR6 PDFs so page references open the right page.

## Development

```bash
npm install
npm run dev      # start dev server
npm test         # run tests
npm run build    # production build in dist/
```

## Project layout

- `src/rules/sr6/` — game data (attributes, skills, metatypes)
- `src/model/` — character schema (zod) and the import/export file format
- `src/db/` — IndexedDB storage (Dexie)
- `src/pages/` — UI screens
