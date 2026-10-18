import type { Encounter } from '../model/encounter'
import Dexie, { type EntityTable } from 'dexie'
import type { ExtractedEntry } from '../books/extract'
import type { PageLayout } from '../books/layout'
import type { PageMapping } from '../books/pages'
import type { Character } from '../model/character'
import type { GmMessage } from '../share/messages'
import type { NpcEntry } from '../rules/sr6/npc'

/** A rulebook PDF the user added. The file itself lives in `bookFiles`. */
export interface Book extends PageMapping {
  id: string
  /** Code used in page references, e.g. 'CRB'. */
  code: string
  title: string
  fileName: string
  size: number
  addedAt: string
  /** Pages whose text has been extracted for search; equals pageCount when done. */
  indexedPages: number
  /** EXTRACTOR_VERSION the catalog was last built with; 0 = not built. */
  extractedVersion?: number
  /** Google Drive file holding this PDF, once uploaded. */
  driveFileId?: string
}

export interface BookFile {
  id: string
  blob: Blob
}

export interface BookPageText {
  bookId: string
  /** 1-based PDF page. */
  page: number
  text: string
}

/** Positioned text of one page, kept so the catalog can be rebuilt without re-reading the PDF. */
export interface BookPageLayout extends PageLayout {
  bookId: string
  /** 1-based PDF page. */
  page: number
}

/** Where a character lives in Google Drive and which version both sides last agreed on. */
export interface SyncState {
  /** Character id. */
  id: string
  driveFileId: string
  /** The character's updatedAt when it was last uploaded or downloaded. */
  syncedUpdatedAt: string
}

/** A character deleted on this device, so the next sync can remove it from Drive too. */
export interface DeletedCharacter {
  id: string
  deletedAt: string
}

/** A rules item recognised in one of the user's books. */
export type CatalogEntry = ExtractedEntry & { id: string; bookId: string }

/** A campaign this device runs (GM) or shares characters with (player). Code and password stay on the device. */
export interface Campaign {
  /** Room id derived from the code and password. */
  id: string
  role: 'gm' | 'player'
  code: string
  password: string
  name: string
  /** Characters on this device shared with the GM. */
  characterIds: string[]
  /** updatedAt of each character as last sent, so unchanged sheets aren't sent again. */
  pushed: Record<string, string>
  joinedAt: string
  /** Last change to what's backed up to Drive (name, code, notes, run log…); not set by sharing bookkeeping. */
  updatedAt?: string
  lastSyncAt?: string
  /** Last problem talking to the server, shown in the share dialog. */
  error?: string
  /** The GM closed the campaign. */
  closed?: boolean
  /** GM's notes: plot threads, recurring NPCs, loose ends. Kept on this device only. */
  notes?: string
  /** The GM hid the join panel; it opens from "Join info" instead. */
  joinHidden?: boolean
  /** Game nights played, newest last. */
  runs?: CampaignRun[]
  /** Recurring NPCs: contacts, Johnsons, rivals, villains. */
  cast?: CastMember[]
  /** What the GM may send to players' sheets; both on unless switched off. */
  gmSends?: { damage: boolean; rewards: boolean }
}

/** A message from the GM waiting for the player to accept or decline it. */
export interface InboxItem {
  /** `${roomId}/${messageId}` */
  id: string
  roomId: string
  messageId: string
  characterId: string
  campaignName: string
  message: GmMessage
  sentAt: string
  /** Accepted or declined here, but not yet removed from the server (e.g. offline). */
  handled?: boolean
}

/** A message the GM sent that the player hasn't handled yet. */
export interface OutboxItem {
  /** `${roomId}/${messageId}` */
  id: string
  roomId: string
  messageId: string
  /** The sheet id it went to. */
  to: string
  message: GmMessage
  sentAt: string
}

/** A recurring person in the GM's campaign, ready to drop into an encounter. */
export interface CastMember {
  id: string
  name: string
  /** What they are to the runners, e.g. "Fixer", "Mr. Johnson (Renraku)". */
  role: string
  attitude: 'ally' | 'neutral' | 'enemy'
  notes: string
  /** Stats from a book stat block (a copy, so it stays if the book is removed)… */
  npc?: NpcEntry
  /** …or a few quick numbers. Neither: a roleplay-only character. */
  custom?: { initiativeScore: number; initiativeDice: number; defenseRating: number; monitor: number; pool: number }
  updatedAt: string
}

/** One game night in the GM's run log. */
export interface CampaignRun {
  id: string
  /** yyyy-mm-dd */
  date: string
  title: string
  notes: string
  /** Paid to each runner who was there. */
  karma: number
  nuyen: number
  /** Character ids of the runners who played. */
  runnerIds: string[]
  /** Their names then, in case a runner is no longer shared. */
  runnerNames: string[]
}

/** A player's character as the GM received it: live from a campaign, or from a file. */
export interface SharedSheet {
  /** `${roomId}/${sheetId}`; imported copies use sheet id `file-${characterId}`. */
  id: string
  /** Campaign room id. */
  roomId: string
  sheetId: string
  character: Character
  /** When the player last changed it. */
  updatedAt: string
  receivedAt: string
}

export const db = new Dexie('shadowrun-builder') as Dexie & {
  characters: EntityTable<Character, 'id'>
  books: EntityTable<Book, 'id'>
  bookFiles: EntityTable<BookFile, 'id'>
  bookText: Dexie.Table<BookPageText, [string, number]>
  bookPages: Dexie.Table<BookPageLayout, [string, number]>
  catalog: EntityTable<CatalogEntry, 'id'>
  syncState: EntityTable<SyncState, 'id'>
  deletedCharacters: EntityTable<DeletedCharacter, 'id'>
  encounters: EntityTable<Encounter, 'id'>
  campaigns: EntityTable<Campaign, 'id'>
  sharedSheets: EntityTable<SharedSheet, 'id'>
  deletedGmItems: EntityTable<DeletedGmItem, 'id'>
  inbox: EntityTable<InboxItem, 'id'>
  outbox: EntityTable<OutboxItem, 'id'>
}

/** GM data deleted on this device, so the next Drive sync trashes it there too. */
export interface DeletedGmItem {
  /** `${kind}:${itemId}`, e.g. "encounter:…". */
  id: string
  deletedAt: string
}

db.version(1).stores({
  characters: 'id, name, updatedAt',
})

// Book metadata and file blobs are separate tables so listing books doesn't load whole PDFs.
db.version(2).stores({
  books: 'id, code',
  bookFiles: 'id',
  bookText: '[bookId+page], bookId',
})

// Version 3 keeps text positions so tables and columns can be read; existing books are re-indexed.
db.version(3)
  .stores({
    bookPages: '[bookId+page], bookId',
    catalog: 'id, bookId, kind, name',
  })
  .upgrade(async (tx) => {
    await tx.table('bookText').clear()
    await tx
      .table('books')
      .toCollection()
      .modify((book: Book) => {
        book.indexedPages = 0
        book.extractedVersion = 0
      })
  })

// Version 4 adds Google Drive sync bookkeeping.
db.version(4).stores({
  syncState: 'id',
  deletedCharacters: 'id',
})

// Version 5 adds the GM's encounters.
db.version(5).stores({
  encounters: 'id, updatedAt',
})

// Version 6 adds sharing sheets with the GM.
db.version(6).stores({
  campaigns: 'id, role',
  sharedSheets: 'id, roomId',
})

// Version 7 backs GM data up to Drive.
db.version(7).stores({
  deletedGmItems: 'id',
})

// Version 8 adds messages from the GM to players (damage, statuses, Edge, rewards).
db.version(8).stores({
  inbox: 'id, characterId, roomId',
  outbox: 'id, roomId',
})
