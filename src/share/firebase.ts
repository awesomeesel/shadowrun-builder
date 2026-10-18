/**
 * Firestore transport. Loaded on demand so players who never share don't
 * download Firebase. Layout: rooms/{roomId} and rooms/{roomId}/sheets/{sheetId}.
 */
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  query,
  setDoc,
  where,
  addDoc,
  writeBatch,
} from 'firebase/firestore'
import type { MessageDoc, RoomDoc, SheetDoc, Transport } from './transport'

export function firebaseTransport(config: Record<string, string>): Transport {
  // Reuse the app if this module is loaded again (hot reload in development).
  const reused = getApps().length > 0
  const app = reused ? getApp() : initializeApp(config)
  const auth = getAuth(app)
  // The local cache lets the GM see the last known sheets when the connection drops.
  const db = reused ? getFirestore(app) : initializeFirestore(app, { localCache: persistentLocalCache() })

  let signingIn: Promise<User> | null = null
  const user = () =>
    (signingIn ??= new Promise<User>((resolve, reject) => {
      const stop = onAuthStateChanged(
        auth,
        (current) => {
          if (current) {
            stop()
            resolve(current)
          } else {
            signInAnonymously(auth).catch((error) => {
              stop()
              signingIn = null
              reject(error)
            })
          }
        },
        reject,
      )
    }))

  return {
    userId: async () => (await user()).uid,
    getRoom: async (roomId) => {
      await user()
      const snap = await getDoc(doc(db, 'rooms', roomId))
      return snap.exists() ? (snap.data() as RoomDoc) : null
    },
    createRoom: async (roomId, room) => {
      await user()
      await setDoc(doc(db, 'rooms', roomId), room)
    },
    deleteRoom: async (roomId) => {
      await user()
      // Sheets first: rules let the GM remove them, and they'd otherwise outlive the room.
      const sheets = await getDocs(collection(db, 'rooms', roomId, 'sheets'))
      const inbox = await getDocs(collection(db, 'rooms', roomId, 'inbox'))
      const batch = writeBatch(db)
      sheets.forEach((s) => batch.delete(s.ref))
      inbox.forEach((m) => batch.delete(m.ref))
      await batch.commit()
      await deleteDoc(doc(db, 'rooms', roomId))
    },
    putSheet: async (roomId, sheetId, sheet) => {
      await user()
      await setDoc(doc(db, 'rooms', roomId, 'sheets', sheetId), sheet)
    },
    deleteSheet: async (roomId, sheetId) => {
      await user()
      await deleteDoc(doc(db, 'rooms', roomId, 'sheets', sheetId))
    },
    sendMessage: async (roomId, message) => {
      await user()
      return (await addDoc(collection(db, 'rooms', roomId, 'inbox'), message)).id
    },
    deleteMessage: async (roomId, messageId) => {
      await user()
      await deleteDoc(doc(db, 'rooms', roomId, 'inbox', messageId))
    },
    watchMessages: (roomId, to, onChange, onError) => {
      let stop: (() => void) | null = null
      let stopped = false
      user().then(
        () => {
          if (stopped) return
          const inbox = collection(db, 'rooms', roomId, 'inbox')
          // Players may only read their own messages, so they must ask for exactly those.
          stop = onSnapshot(
            to === null ? inbox : query(inbox, where('to', '==', to)),
            (snap) => onChange(new Map(snap.docs.map((d) => [d.id, d.data() as MessageDoc]))),
            onError,
          )
        },
        (error: Error) => onError(error),
      )
      return () => {
        stopped = true
        stop?.()
      }
    },
    watchSheets: (roomId, onChange, onError) => {
      let stop: (() => void) | null = null
      let stopped = false
      user().then(
        () => {
          if (stopped) return
          stop = onSnapshot(
            collection(db, 'rooms', roomId, 'sheets'),
            (snap) => onChange(new Map(snap.docs.map((d) => [d.id, d.data() as SheetDoc]))),
            onError,
          )
        },
        (error: Error) => onError(error),
      )
      return () => {
        stopped = true
        stop?.()
      }
    },
  }
}
