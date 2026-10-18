import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { db } from '../db/db'
import { isSharingConfigured, syncCampaign, watchCampaign } from './campaigns'
import { watchInbox, watchOutbox } from './messages'

/** Wait this long after the last change before sending, so a burst of clicks is one upload. */
const DEBOUNCE_MS = 2500
const RETRY_MS = 60_000

/**
 * Runs in the background on every page: sends players' shared characters when
 * they change, and keeps the GM's copies of their campaigns' sheets live.
 */
export function ShareSync() {
  const campaigns = useLiveQuery(() => db.campaigns.toArray())
  // A cheap fingerprint of every character's last change.
  const versions = useLiveQuery(async () => {
    const list: string[] = []
    await db.characters.each((c) => list.push(`${c.id}:${c.updatedAt}`))
    return list.sort().join('|')
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sharing = (campaigns ?? []).filter((c) => !c.closed && c.characterIds.length > 0)
  const sharingKey = sharing.map((c) => `${c.id}:${c.characterIds.join(',')}`).join('|')

  // Player side: push changes after a short pause, and retry now and then while offline.
  useEffect(() => {
    if (!isSharingConfigured() || !sharingKey) return
    const run = () => {
      for (const id of sharingKey.split('|').map((s) => s.split(':')[0])) void syncCampaign(id)
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(run, DEBOUNCE_MS)
    const retry = setInterval(run, RETRY_MS)
    window.addEventListener('online', run)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      clearInterval(retry)
      window.removeEventListener('online', run)
    }
  }, [sharingKey, versions])

  const gmKey = (campaigns ?? [])
    .filter((c) => c.role === 'gm')
    .map((c) => c.id)
    .join('|')

  // GM side: live copies of every campaign this device runs.
  useEffect(() => {
    if (!isSharingConfigured() || !gmKey) return
    const stops: (() => void)[] = []
    let cancelled = false
    void db.campaigns.bulkGet(gmKey.split('|')).then((list) => {
      if (cancelled) return
      for (const campaign of list) {
        if (!campaign) continue
        const onError = (error: string) => void db.campaigns.update(campaign.id, { error })
        stops.push(watchCampaign(campaign, onError), watchOutbox(campaign))
      }
    })
    return () => {
      cancelled = true
      stops.forEach((stop) => stop())
    }
  }, [gmKey])

  // Player side: messages from the GM for each shared character.
  useEffect(() => {
    if (!isSharingConfigured() || !sharingKey) return
    const stops: (() => void)[] = []
    let cancelled = false
    void db.campaigns.bulkGet(sharingKey.split('|').map((s) => s.split(':')[0])).then((list) => {
      if (cancelled) return
      for (const campaign of list) {
        if (!campaign || campaign.closed) continue
        for (const characterId of campaign.characterIds) stops.push(watchInbox(campaign, characterId))
      }
    })
    return () => {
      cancelled = true
      stops.forEach((stop) => stop())
    }
  }, [sharingKey])

  return null
}
