import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { db, type PlayerJob } from '../db/db'
import { isSharingConfigured, syncCampaign, watchCampaign } from './campaigns'
import { watchInbox, watchOutbox } from './messages'
import { playerJobs, publishJobs, watchJobs } from './jobBoard'

/** The job list last published per campaign on this device, so unchanged lists aren't sent again. */
const published = new Map<string, string>()

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

  // GM side: publish each campaign's job list for the players when it changes.
  const jobsKey = JSON.stringify(
    (campaigns ?? []).filter((c) => c.role === 'gm' && !c.closed).map((c) => [c.id, playerJobs(c)]),
  )
  useEffect(() => {
    if (!isSharingConfigured()) return
    const timer = setTimeout(() => {
      for (const [id, jobs] of JSON.parse(jobsKey) as [string, PlayerJob[]][]) {
        const text = JSON.stringify(jobs)
        if (published.get(id) === text) continue
        const campaign = campaigns?.find((c) => c.id === id)
        if (!campaign) continue
        published.set(id, text)
        // Only the device that made the campaign may publish; others just don't.
        publishJobs(campaign, jobs).catch(() => published.delete(id))
      }
    }, 1500)
    return () => clearTimeout(timer)
    // campaigns is read for the latest copy; jobsKey decides when to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey])

  // Player side: the GM's job list for each joined campaign.
  const joinedKey = (campaigns ?? [])
    .filter((c) => c.role === 'player' && !c.closed)
    .map((c) => c.id)
    .join('|')
  useEffect(() => {
    if (!isSharingConfigured() || !joinedKey) return
    const stops: (() => void)[] = []
    let cancelled = false
    void db.campaigns.bulkGet(joinedKey.split('|')).then((list) => {
      if (cancelled) return
      for (const campaign of list) if (campaign) stops.push(watchJobs(campaign))
    })
    return () => {
      cancelled = true
      stops.forEach((stop) => stop())
    }
  }, [joinedKey])

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
