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
