/**
 * Where shared campaigns live. Everything passed in here is already sealed
 * (see crypto.ts); the transport only stores and relays opaque strings.
 */

export interface RoomDoc {
  /** User id of the GM who made the campaign. */
  gm: string
  /** Sealed campaign details (the name). */
  meta: string
  createdAt: string
}

export interface SheetDoc {
  /** User id of the player who shares it; only they can change it. */
  owner: string
  /** Sealed SharedSheetPayload. */
  data: string
  updatedAt: string
}

/** Something the GM sends to one shared runner: damage, a status, Edge or a reward. */
export interface MessageDoc {
  /** The sheet it's for: `${playerUserId}_${characterId}`. */
  to: string
  /** Sealed GmMessagePayload. */
  data: string
  createdAt: string
}

export interface Transport {
  /** This device's user id (anonymous sign-in), stable until site data is cleared. */
  userId(): Promise<string>
  getRoom(roomId: string): Promise<RoomDoc | null>
  createRoom(roomId: string, room: RoomDoc): Promise<void>
  deleteRoom(roomId: string): Promise<void>
  putSheet(roomId: string, sheetId: string, sheet: SheetDoc): Promise<void>
  deleteSheet(roomId: string, sheetId: string): Promise<void>
  /** Live updates of every sheet in the room; returns a function that stops listening. */
  watchSheets(
    roomId: string,
    onChange: (sheets: Map<string, SheetDoc>) => void,
    onError: (error: Error) => void,
  ): () => void
  /** GM only: leave a message for one runner. */
  sendMessage(roomId: string, message: MessageDoc): Promise<string>
  /** The player it's for (after handling it) or the GM (taking it back). */
  deleteMessage(roomId: string, messageId: string): Promise<void>
  /** Live messages: for one sheet (players), or all of them when `to` is null (the GM). */
  watchMessages(
    roomId: string,
    to: string | null,
    onChange: (messages: Map<string, MessageDoc>) => void,
    onError: (error: Error) => void,
  ): () => void
}

/** In-memory transport for tests: one shared "server", one user id per client. */
export function memoryServer() {
  const rooms = new Map<string, RoomDoc>()
  const sheets = new Map<string, Map<string, SheetDoc>>()
  const messages = new Map<string, Map<string, MessageDoc>>()
  const watchers = new Set<{ roomId: string; fn: (s: Map<string, SheetDoc>) => void }>()
  const notify = (roomId: string) => {
    for (const w of watchers) if (w.roomId === roomId) w.fn(new Map(sheets.get(roomId) ?? []))
  }
  const messageWatchers = new Set<{ roomId: string; to: string | null; fn: (m: Map<string, MessageDoc>) => void }>()
  const notifyMessages = (roomId: string) => {
    for (const w of messageWatchers) {
      if (w.roomId !== roomId) continue
      const all = [...(messages.get(roomId) ?? [])]
      w.fn(new Map(w.to === null ? all : all.filter(([, m]) => m.to === w.to)))
    }
  }
  const client = (uid: string): Transport => ({
    userId: async () => uid,
    getRoom: async (roomId) => rooms.get(roomId) ?? null,
    createRoom: async (roomId, room) => {
      if (rooms.has(roomId)) throw new Error('exists')
      if (room.gm !== uid) throw new Error('permission-denied')
      rooms.set(roomId, room)
    },
    deleteRoom: async (roomId) => {
      if (rooms.get(roomId)?.gm !== uid) throw new Error('permission-denied')
      rooms.delete(roomId)
      sheets.delete(roomId)
      notify(roomId)
    },
    putSheet: async (roomId, sheetId, sheet) => {
      if (!rooms.has(roomId)) throw new Error('not-found')
      const existing = sheets.get(roomId)?.get(sheetId)
      if (sheet.owner !== uid || (existing && existing.owner !== uid)) throw new Error('permission-denied')
      if (!sheets.has(roomId)) sheets.set(roomId, new Map())
      sheets.get(roomId)!.set(sheetId, sheet)
      notify(roomId)
    },
    deleteSheet: async (roomId, sheetId) => {
      const existing = sheets.get(roomId)?.get(sheetId)
      if (!existing) return
      if (existing.owner !== uid && rooms.get(roomId)?.gm !== uid) throw new Error('permission-denied')
      sheets.get(roomId)!.delete(sheetId)
      notify(roomId)
    },
    watchSheets: (roomId, onChange) => {
      const watcher = { roomId, fn: onChange }
      watchers.add(watcher)
      onChange(new Map(sheets.get(roomId) ?? []))
      return () => watchers.delete(watcher)
    },
    sendMessage: async (roomId, message) => {
      if (rooms.get(roomId)?.gm !== uid) throw new Error('permission-denied')
      const id = crypto.randomUUID()
      if (!messages.has(roomId)) messages.set(roomId, new Map())
      messages.get(roomId)!.set(id, message)
      notifyMessages(roomId)
      return id
    },
    deleteMessage: async (roomId, messageId) => {
      const message = messages.get(roomId)?.get(messageId)
      if (!message) return
      if (!message.to.startsWith(`${uid}_`) && rooms.get(roomId)?.gm !== uid) throw new Error('permission-denied')
      messages.get(roomId)!.delete(messageId)
      notifyMessages(roomId)
    },
    watchMessages: (roomId, to, onChange) => {
      if (to === null ? rooms.get(roomId)?.gm !== uid : !to.startsWith(`${uid}_`)) throw new Error('permission-denied')
      const watcher = { roomId, to, fn: onChange }
      messageWatchers.add(watcher)
      notifyMessages(roomId)
      return () => messageWatchers.delete(watcher)
    },
  })
  return { client, rooms, sheets, messages }
}
