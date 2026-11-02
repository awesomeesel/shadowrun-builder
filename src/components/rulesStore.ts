/**
 * State of the rules search, shared by the panel, the floating button, the
 * header buttons and the rules page.
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { SearchDoc, SearchKind } from '../books/search'

export type Filter = 'all' | SearchKind

export interface PanelState {
  open: boolean
  query: string
  filter: Filter
  /** Only this book's items and sections. */
  book: string | null
  /** A result being read. */
  selected: SearchDoc | null
  /** A book page being looked at. */
  page: { bookId: string; page: number } | null
  zoom: number
}

export let state: PanelState = {
  open: false,
  query: '',
  filter: 'all',
  book: null,
  selected: null,
  page: null,
  zoom: 1,
}
const listeners = new Set<() => void>()
export function set(change: Partial<PanelState>) {
  state = { ...state, ...change }
  listeners.forEach((l) => l())
}
export function usePanel(): PanelState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
/** Shown on the button where there's a keyboard to use it. */
export const SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl K'
export const HAS_KEYBOARD =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

/** Open the rules search over the current page. */
export function openRules() {
  set({ open: true })
}

/** Close it and clear it, so the next search starts fresh. */
export function closeRules() {
  set({ open: false, query: '', filter: 'all', book: null, selected: null, page: null })
}

/** The shortcut, for buttons' tooltips. */
export const RULES_SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl+K'

/** Forget the search when the rules page is left, as closing the panel does. */
export function useFreshSearchOnLeave() {
  useEffect(() => () => closeRules(), [])
}
