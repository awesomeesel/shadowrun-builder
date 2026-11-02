import { useLiveQuery } from 'dexie-react-hooks'
import { Map as MapIcon, Maximize2, Minus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Section } from '../../../components/ui'
import { db, type MapBoard } from '../../../db/db'
import { MapCanvas } from '../../../map/MapCanvas'

/**
 * The battle map the GM is showing, live, for a runner shared in that
 * campaign. Your own token has a white ring; the dashed ring is whose turn
 * it is. Look only: the GM moves things.
 */
export function BattleMapView({ characterId }: { characterId: string }) {
  const board = useLiveQuery(async () => {
    const campaigns = (await db.campaigns.where('role').equals('player').toArray()).filter(
      (c) => !c.closed && c.characterIds.includes(characterId),
    )
    for (const c of campaigns) {
      const b = await db.mapBoards.get(c.id)
      if (b) return b
    }
    return null
  }, [characterId])
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [full, setFull] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [board])
  if (!board) return null
  const cell = width ? width / board.map.cols : 20

  return (
    <Section
      title={`Battle map · ${board.title}`}
      icon={<MapIcon className="size-4" />}
      className="lg:col-span-2"
      aside={
        <button className="btn px-2 py-1 text-xs" onClick={() => setFull(true)}>
          <Maximize2 className="size-3.5" /> Full screen
        </button>
      }
    >
      <div ref={box} className="overflow-hidden rounded-lg border border-line">
        <MapCanvas map={board.map} tokens={board.tokens} cell={cell} ownCharacterId={characterId} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        1 square = {board.map.meters} m. White ring: you. Dashed ring: whose turn it is.
      </p>
      {full && <FullMap board={board} characterId={characterId} onClose={() => setFull(false)} />}
    </Section>
  )
}

function FullMap({ board, characterId, onClose }: { board: MapBoard; characterId: string; onClose: () => void }) {
  const fit = Math.max(
    12,
    Math.floor(Math.min((window.innerWidth - 24) / board.map.cols, (window.innerHeight - 76) / board.map.rows)),
  )
  const [cell, setCell] = useState(fit)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col bg-bg" role="dialog" aria-label="Battle map, full screen">
      <div className="flex items-center gap-2 border-b border-line p-2">
        <span className="mr-auto truncate font-display text-lg">{board.title}</span>
        <button className="btn size-9 p-0" onClick={() => setCell(Math.max(10, cell - 6))} aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
        <button className="btn size-9 p-0" onClick={() => setCell(Math.min(90, cell + 6))} aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button className="btn h-9 px-3 text-xs" onClick={onClose} title="Close (Esc)">
          <X className="size-4" /> Close
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <MapCanvas map={board.map} tokens={board.tokens} cell={cell} ownCharacterId={characterId} />
      </div>
    </div>,
    document.body,
  )
}
