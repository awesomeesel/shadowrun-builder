import { useLiveQuery } from 'dexie-react-hooks'
import { Maximize2, PenLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Section } from '../../../components/ui'
import { db, type SketchBoard } from '../../../db/db'
import { SKETCH_HEIGHT, SKETCH_WIDTH } from '../../../map/sketch'
import { SketchCanvas } from '../../../map/SketchCanvas'

/** The rough layout the GM is showing, for a runner shared in that campaign. */
export function SketchView({ characterId }: { characterId: string }) {
  const board = useLiveQuery(async () => {
    const campaigns = (await db.campaigns.where('role').equals('player').toArray()).filter(
      (c) => !c.closed && c.characterIds.includes(characterId),
    )
    for (const c of campaigns) {
      const b = await db.sketchBoards.get(c.id)
      if (b?.strokes.length) return b
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
  return (
    <Section
      title="Sketch from the GM"
      icon={<PenLine className="size-4" />}
      className="lg:col-span-2"
      aside={
        <button className="btn px-2 py-1 text-xs" onClick={() => setFull(true)}>
          <Maximize2 className="size-3.5" /> Full screen
        </button>
      }
    >
      <div ref={box} className="overflow-hidden rounded-lg border border-line">
        {width > 0 && <SketchCanvas strokes={board.strokes} width={width} />}
      </div>
      {full && <FullSketch board={board} onClose={() => setFull(false)} />}
    </Section>
  )
}

function FullSketch({ board, onClose }: { board: SketchBoard; onClose: () => void }) {
  const width = Math.max(
    280,
    Math.min(window.innerWidth - 24, ((window.innerHeight - 76) * SKETCH_WIDTH) / SKETCH_HEIGHT),
  )
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
    <div className="fixed inset-0 z-[55] flex flex-col bg-bg" role="dialog" aria-label="Sketch, full screen">
      <div className="flex items-center gap-2 border-b border-line p-2">
        <span className="mr-auto font-display text-lg">Sketch from the GM</span>
        <button className="btn h-9 px-3 text-xs" onClick={onClose} title="Close (Esc)">
          <X className="size-4" /> Close
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-2">
        <div className="overflow-hidden rounded-lg border border-line">
          <SketchCanvas strokes={board.strokes} width={width} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
