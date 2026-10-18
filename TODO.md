# TODO

Ideas and plans for Shadowrun Builder. Add your own anywhere; tick them off with `[x]` when done.

## Next up

- [x] **Spells in play** – a "Cast" button per spell that rolls Sorcery + Magic, then drain. Track sustained
      spells and the dice penalty they give.
- [x] **Spirits, sprites and drones in play** – summon/compile with services or tasks, damage tracks, quick rolls.
      Drones get their own damage track and pilot rolls.
- [x] **Quick make: autosofts for drones** – quick-made riggers' drones have no autosofts yet (add them on the Edit tab).
- [x] **Banishing and decompiling** – roll against someone else's spirit or sprite.

## Later

- [x] **GM screen** – encounters with turn order, actions, damage, statuses and rolls; enemies from the books'
      stat blocks, spirits, runners and quick enemies; a rules reference with book search.
- [x] **GM ↔ players** – campaigns with a QR code, code and optional password (Firebase, encrypted on the device);
      the GM sees shared sheets live and read-only. "Send a copy" as the no-internet fallback. Setup:
      FIREBASE_SETUP.md.
- [x] **GM → players** – the GM sends damage, statuses, Edge, karma and nuyen to shared runners; players accept
      or decline; the GM switches each kind on or off per campaign.
- [x] **Cast of recurring NPCs** – per campaign, with notes, attitude and optional stats; add to encounters.
- [x] **Player statuses on GM cards** – shared runners' own statuses show in encounters and count for initiative.
- [x] **Sample encounters and Composure reminder** – grunts by Professional Rating from the books; Composure
      prompt once boxes exceed the rating.
- [ ] **Matrix participant in encounters** – a host with IC that can join an encounter, for deckers to fight.
- [x] **Karma shop** – spend karma between runs at the book's prices (attributes, skills, specializations,
      qualities, spells), logged in the karma history.
- [x] **Initiation and submersion** – 10 + grade karma; raises the Magic/Resonance limit above 6 and gives
      metamagics/echoes.
- [x] **Healing between runs** – first aid, medkit and natural healing rolls in the end-session dialog.
- [ ] **Commlink import for mages, deckers and riggers** – field names now follow Roll20's SR6 sheet importer
      (spells, adept powers, drones); still worth testing with a real mage, decker and rigger export.
- [x] **Printable sheet** – a print/PDF view of the character sheet.
- [x] **Jump menu for the Edit tab** – it's a long page.
- [x] **"New version available" banner** – so nobody needs Cmd+Shift+R after an update.

## How to ship

- When something players will notice ships, add an entry at the top of `src/changelog.ts` (next id). It shows once
  in "What's new" after the update.

## Your ideas

- [ ]
