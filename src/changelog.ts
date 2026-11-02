/**
 * What's new, newest first. Add an entry (with the next id) when shipping
 * something players will notice; the app shows new entries once after an update.
 */
export interface ChangelogEntry {
  id: number
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 29,
    date: '2026-11-02',
    title: 'Sketch pad',
    items: [
      'GM: a Sketch button on each campaign page opens a pad to scribble a rough layout: pen, straight lines, boxes, short labels, eraser, a few colors and undo.',
      'Players see nothing until you press Show to players; after more drawing, Update players sends it again, and Hide takes it down. It shows at the top of their Play tab, with a full-screen view.',
    ],
  },
  {
    id: 28,
    date: '2026-11-02',
    title: 'Combined rolls',
    items: [
      'Play tab: “Combine” rolls any skill with any attribute (Athletics + Strength) or two attributes (Logic + Willpower), as the GM calls for. Untrained skills count as the attribute − 1; your specialization can be added.',
      'Every pool shows what it adds up, e.g. Firearms 6 + Agility 6: hover a button, or tap “Show what’s in each pool”. The sum also shows under the roll result.',
      'Attack Rating vs Defense Rating moved to the attack’s result: type the DR the GM gives you and see who gains Edge; “Take 1 Edge” adds it (2 a round at most). The DR is kept for the next shot at the same target.',
    ],
  },
  {
    id: 27,
    date: '2026-11-02',
    title: 'Battle map',
    items: [
      'GM: a Map button on every encounter opens a battle mat. Draw walls, areas, circles and labels on a grid in a few colors, with undo.',
      'Tap a combatant, then a square, to put them on the map; drag them as they move. The token shows whose turn it is and who is out.',
      'Measure distances in meters with the SR6 range band (Close, Near, Medium…); set how many meters a square is.',
      '“Show to players” puts the map, live, at the top of their Play tab, with their own token ringed and a full-screen view.',
      'GM: a runner whose player shared again from another device no longer turns up twice or stuck on an old version. Encounter cards follow the newest copy, a runner already in the fight isn’t offered again, and duplicate cards can be removed with one click.',
      'Players: an “(other version)” copy kept from a sync clash is never shared with the GM.',
    ],
  },
  {
    id: 26,
    date: '2026-11-02',
    title: 'Contacts, loot and jobs at the table',
    items: [
      'Play tab: your contacts, with an Ask roll (Influence + Charisma + their Loyalty), a favors counter for who owes whom, and quick notes.',
      'GM: a Loot button on campaign encounters suggests what the downed enemies carried. Pick what the runners take, add cash, and send it: items land on the gear list, nuyen is split between the runners you choose.',
      'Players see the GM’s jobs on their Play tab: the Johnson, pay, deadline, brief and how far the objectives have come. Never the twists, and the GM can hide a job.',
    ],
  },
  {
    id: 25,
    date: '2026-11-02',
    title: 'Read book pages full screen',
    items: [
      'In the Rules search, click a book page (or Full screen) to show it over the whole screen. Click again to zoom in around where you click, and once more to go back to fit.',
      'Esc, Smaller, ✕ or a click beside the page takes you back to the small view; ← and → turn pages.',
    ],
  },
  {
    id: 24,
    date: '2026-11-02',
    title: 'Rules search everywhere, with ⌘K',
    items: [
      'Open (and close) the Rules search with ⌘K on a Mac or Ctrl+K on Windows, on any page, even while typing in a field.',
      'Every Rules button (home page, GM screen, campaigns, encounters) now opens the new search over the page.',
      'Closing the search clears it, so the next one starts fresh.',
      'Play tab: dice pool names show in full (long ones wrap), and character pages are a little wider.',
    ],
  },
  {
    id: 23,
    date: '2026-11-02',
    title: 'Smarter rules search',
    items: [
      'The Rules panel now ranks results by how well they match, the way search engines do: “cover” finds the Cover status, Take Cover and Cover Fire first, not the credits page.',
      'Books are searched section by section under their headings, so each result says where it is, e.g. “CRB 52 · Statuses › Status List”.',
      'Each result has a badge (Rule, Status, Edge action, Spell, Weapon, Book…) and one line from where your words appear, highlighted.',
      'Filter by Rules, Items or Books, or by one book. Tap a result to read it in the panel with your words highlighted; “See page” shows the real page.',
      'Covered, covering and covers count as cover, and the last word matches as you type.',
    ],
  },
  {
    id: 22,
    date: '2026-11-02',
    title: 'Rules at your fingertips',
    items: [
      'A Rules button sits in the corner of every character page and the GM’s encounters (or press /). It opens a search panel over the page, so you never leave the fight.',
      'It searches the app’s rule summaries, statuses and Edge actions first, then spells, qualities, gear and critters by name, and finally every page of the books in your Library.',
      'Tap a book result to read the page right there, with next and previous page and zoom. Close the panel and you’re exactly where you were; open it again and your search and page are still there.',
    ],
  },
  {
    id: 21,
    date: '2026-11-02',
    title: 'Safer syncing between devices',
    items: [
      'If the Google sign-in runs out (they last an hour) while you have changes that aren’t on Drive yet, the character page tells you, with a Reconnect button.',
      'Opening a character on a device that hasn’t checked Drive yet warns you it may not be the newest version.',
      '“(other version)” copies, kept when a character was changed on two devices, now show how they differ and let you delete the copy or keep it instead, in one tap.',
    ],
  },
  {
    id: 20,
    date: '2026-11-02',
    title: 'More from your books',
    items: [
      'Library: Smooth Operations (SO), Wild Life (WL) and The Kechibi Code (KC) are recognised and get their short codes, like the other core books.',
      'Double Clutch’s vehicles and drones (about 170) can now be picked from the book, with all their stats.',
      'Wild Life’s critters (about 180) are now read, ready to add to GM encounters.',
      'Street Wyrd: all its spells are found now, not just the combat ones.',
      'Long quality and spell names that wrap onto two lines come out whole.',
      'Books you’ve already added are re-read automatically; no need to add them again.',
      'Play tab: Session notes open at the newest line and follow along as you add notes.',
    ],
  },
  {
    id: 19,
    date: '2026-10-19',
    title: 'Live at the table, ammo and paying for things',
    items: [
      'Initiative you roll on the Play tab shows on the GM’s encounter card, ready to use with one tap.',
      'The GM sees a live table feed of your rolls: hits, glitches and Edge spent.',
      'Handouts: the GM can send a map, a picture or a message to your phone. Keep it, and it’s under Handouts on the Play tab.',
      'Ammo: tap “Ammo…” under a gun to load APDS, explosive, gel and more (Attack Rating and damage change to match), count spare rounds, and buy more at the book’s prices.',
      'Nuyen: clear Pay and Got paid buttons with quick amounts. Bought something to keep? Tick the box and it goes on your gear list.',
    ],
  },
  {
    id: 18,
    date: '2026-10-19',
    title: 'Jobs for the GM',
    items: [
      'Campaigns have a Jobs list: the Johnson (from your cast), the pay, the deadline, the brief, the twists only you know, and objectives to tick off as the runners go.',
      'Start an encounter from a job, or link ones you already have. “Done, pay out” opens the run log with the pay filled in, ready to send to the runners.',
      'Jobs are backed up to Google Drive with the rest of the campaign.',
      'Play tab: Session notes take the full width and start taller.',
    ],
  },
  {
    id: 17,
    date: '2026-10-19',
    title: 'Bone lacing sets unarmed damage',
    items: [
      'Bone lacing now replaces your unarmed DV with the one in its table (plastic 3P, aluminum and titanium 4P) instead of adding to it. Saved characters are fixed when they load.',
    ],
  },
  {
    id: 16,
    date: '2026-10-19',
    title: 'Bonuses for heavily augmented runners',
    items: [
      'Augmentations and adept powers have a clear bonus list: pick Defense Rating, Unarmed Attack Rating, Physical or Stun boxes, soak dice, initiative dice or an attribute, and set the number.',
      'Edit tab → Combat numbers & adjustments shows how Defense Rating, Unarmed Attack Rating and both damage tracks are made up, with room for bonuses from anything else (gear, a quality, a GM ruling).',
      'The Sheet shows what your Defense Rating and Unarmed Attack Rating are made of.',
    ],
  },
  {
    id: 15,
    date: '2026-10-18',
    title: 'IC in encounters, and Edge for the opposition',
    items: [
      'GMs: Add → Matrix (IC) sets up a host (rating and its four attributes) and launches IC into the fight: Killer, Black IC, Patrol and the rest, with their numbers, defense roll and effect. One of each type, up to the host rating.',
      'NPCs and grunt groups can use Edge actions (Called Shot—Vitals, Knockout Blow…) from their card, paid from their Edge or the group’s shared pool. A group that already used Edge this round is marked, since grunts may only use it once per round.',
      'Rules reference: a short entry on hosts and IC.',
    ],
  },
  {
    id: 14,
    date: '2026-10-18',
    title: 'A louder-looking intro',
    items: [
      'The intro is longer and has more action: hostile ICE, a laser sight, a target lock, three shots that crack the screen, and the logo slamming in. Tap to skip.',
      'The intro sound is gone: browsers only allowed it after a tap, too late to hear it.',
    ],
  },
  {
    id: 13,
    date: '2026-10-18',
    title: 'Sample encounters, Composure checks, and a new intro',
    items: [
      'GMs: Sample makes a ready-made fight from your books’ grunts at any Professional Rating (0–10), sized to your group: one more grunt than runners, plus a lieutenant.',
      'When a grunt has taken more boxes than their Professional Rating, their card reminds you to roll Composure to see if they run, with the dice ready.',
      'A short jack-in intro with sound plays when you open the app. Tap to skip it, or mute it with the speaker button. If your browser holds the sound back, tap “Tap for sound”. It stays off if your device asks for less motion.',
    ],
  },
  {
    id: 12,
    date: '2026-10-18',
    title: 'A cast of recurring people for GMs',
    items: [
      'Each campaign has a Cast: fixers, Johnsons, rivals and villains, sorted into allies, neutral and enemies, with notes. Give the ones who might fight a stat block from your books or a few quick numbers.',
      'In an encounter, Add → Cast puts them in the fight under their own name, notes included.',
      'Statuses the player has on their own sheet (Dazed, Cover…) now show on their card in encounters and count for the turn order.',
    ],
  },
  {
    id: 11,
    date: '2026-10-18',
    title: 'Quick notes at the top of the session',
    items: [
      'Jot something down without scrolling: type in the box at the top of the Play tab and press Enter. It goes into the session notes with the time, and the latest note shows right under it.',
    ],
  },
  {
    id: 10,
    date: '2026-10-18',
    title: 'More help on the Play tab',
    items: [
      'New to Shadowrun? A short guide at the top of a session explains rolling, fights, getting hit and Edge. Hide it once you know it.',
      'Tap ⓘ next to any dice pool, stat or damage track for what it means and when to roll it, with the page in the book.',
      'Edge actions: Shank, Tumble, Called Shot—Vitals and the rest, filtered to fit your runner. Tap Use to pay the Edge. Other ways to spend Edge, and burning Edge, are listed too.',
      'Specializations get their own pool (↳ Blades 12), and your qualities are listed with what they do.',
    ],
  },
  {
    id: 9,
    date: '2026-10-18',
    title: 'The GM can send things to your sheet',
    items: [
      'GMs: Send… on a shared runner (campaign page or encounter) sends damage to resist or take, a status, Edge, or karma and nuyen. Logging a run can send its rewards to everyone who played.',
      'Players: it shows up as “From your GM” on your character. Nothing changes until you accept; damage to resist opens the damage dialog ready to roll. Decline if it’s wrong.',
      'GMs choose per campaign what may be sent, and can take back anything not yet accepted.',
      'Statuses (Burning, Cover, Dazed…) now show on the Play tab, from the GM or added yourself.',
      'Fixed: dermal plating cost 3 Essence per rating instead of 0.3. Saved runners are corrected, and your rulebooks are read again once. Essence at 0 or below is now flagged.',
    ],
  },
  {
    id: 8,
    date: '2026-10-18',
    title: 'Share your runner with the GM',
    items: [
      'GMs make a campaign on the GM screen and show its QR code, or give out the code and an optional password.',
      'Players scan it (or tap Share with GM on a character) and pick runners. The GM then sees their sheets live, read-only, while they play.',
      'Sheets are encrypted on your device with the code and password; the server can’t read them. Leave any time to stop sharing.',
      'In encounters, shared runners show the player’s own damage and Edge. No internet? Send a copy of the file instead.',
      'With Google Drive connected, everything on the GM screen is backed up to your Drive (a GM folder next to your characters) and follows you to your other devices: campaigns with their codes and passwords, encounters, notes and run log.',
      'Each campaign has a party overview (Perception, Surprise, Composure and the other numbers GMs roll in secret), a run log with karma and nuyen per runner, its encounters and notes.',
    ],
  },
  {
    id: 7,
    date: '2026-10-17',
    title: 'GM screen and rules reference',
    items: [
      'GM screen (from the start page): set up encounters and run them round by round, with turn order, Major and Minor actions, damage tracks, Edge and statuses for everyone.',
      'Add grunts, critters and contacts straight from the stat blocks in your rulebooks (several at once make a grunt group with shared Edge), or spirits, your runners, or a quick enemy.',
      'Tap a dice pool to roll it, with Edge boosts. Statuses like Burning and Poisoned remind you at the end of each round and count down by themselves.',
      'Rules: short summaries of combat, actions, Edge, damage, magic and statuses with page numbers, and a search through your books.',
    ],
  },
  {
    id: 6,
    date: '2026-10-17',
    title: 'Initiation and submersion',
    items: [
      'Initiate (mages and adepts) or submerge (technomancers) on the Karma tab: 10 + grade karma, one metamagic or echo per grade.',
      'Magic and Resonance can then be raised above 6 (up to 6 + grade).',
      'Centering adds dice to drain rolls, Power Point gives adepts more power points, and echoes like Matrix Attribute Upgrade and Overclocking change your Matrix numbers.',
      'Grades show on the Sheet and the play sheet, and come along when importing from Commlink.',
    ],
  },
  {
    id: 5,
    date: '2026-10-17',
    title: 'A play sheet to print, and a jump menu on the Edit tab',
    items: [
      'Print play sheet (on the Sheet tab): one page for pen-and-paper play, with boxes for damage, Edge, ammo, Matrix damage and Overwatch, and lines for sustained spells, spirits, money and notes.',
      'The Edit tab has a menu at the top to jump straight to any section.',
      'Commlink import reads karma correctly: karma left and total karma earned are now separate.',
      'Rulebook reading fixed: Heal and Darkness have the right Drain, and 12 spells that were missing (Armor, Invisibility, Cooling Heal and more) can now be picked from the books.',
    ],
  },
  {
    id: 4,
    date: '2026-10-17',
    title: 'Karma shop, healing and more',
    items: [
      'New Karma tab: spend karma on attributes, skills, specializations, knowledge, qualities and spells at the book’s prices, with undo.',
      'Heal step by step: first aid, medkit, healing magic and rest, from the Play tab or when a session ends.',
      'Banish spirits and decompile sprites.',
      'Quick make gives drones autosofts and fills a decker’s deck after upgrading it.',
      'The app tells you when a new version is out, and shows what changed.',
    ],
  },
  {
    id: 3,
    date: '2026-10-17',
    title: 'Spells, spirits, sprites and drones in play',
    items: [
      'Cast spells with Amp Up and bigger areas, resist drain, and keep track of sustained spells (−2 dice each).',
      'Summon spirits and compile sprites, with services or tasks, stats, skill rolls and damage.',
      'Vehicles and drones get damage tracks and rolls for driving, shooting and dodging; drones use autosofts.',
    ],
  },
  {
    id: 2,
    date: '2026-10-17',
    title: 'A much better Play tab',
    items: [
      'Ready-for-a-run checklist before each session.',
      'Spend Edge after a roll: reroll a die, +1 to a die, buy a hit, reroll failures.',
      'Combat tracker with rounds and actions; attacks by range and firing mode use the right ammo.',
      'Take damage step by step with soak, drain and overflow.',
      'Rules checked against the Core Rulebook: trolls and orks get their racial qualities, used implants are cheaper, and more.',
    ],
  },
  {
    id: 1,
    date: '2026-10-17',
    title: 'Decker hardware and programs',
    items: [
      'A cyberdeck and a cyberjack work together; programs run in the deck’s slots.',
      'Bone lacing, dermal plating and similar bonuses: Defense Rating, damage resistance and unarmed attacks.',
    ],
  },
]

export const LATEST_CHANGE = CHANGELOG[0].id

/** Event that opens the What's new list. */
export const SHOW_WHATS_NEW = 'show-whats-new'

/** Open the What's new list, e.g. from a link on the start page. */
export function showWhatsNew() {
  window.dispatchEvent(new Event(SHOW_WHATS_NEW))
}
