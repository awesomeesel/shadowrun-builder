import { useLiveQuery } from 'dexie-react-hooks'
import { Eraser, Eye, EyeOff, Minus, Pencil, Redo2, Send, Square, Trash2, Type, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { noAutofill } from '../components/noAutofill'
import { db, type Campaign } from '../db/db'
import { changeSketch } from '../gm/store'
import { publishSketch } from '../share/sketchBoard'
import {
  addPoint,
  changedSinceShown,
  emptySketch,
  SKETCH_COLORS,
  SKETCH_WIDTH,
  SketchStrokeSchema,
  touches,
  type Sketch,
  type SketchStroke,
} from './sketch'
import { SketchCanvas } from './SketchCanvas'

type Tool = 'pen' | 'line' | 'box' | 'text' | 'erase'

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'pen', label: 'Pen', icon: <Pencil className="size-4" /> },
  { id: 'line', label: 'Line', icon: <Minus className="size-4 -rotate-45" /> },
  { id: 'box', label: 'Box', icon: <Square className="size-4" /> },
  { id: 'text', label: 'Text', icon: <Type className="size-4" /> },
  { id: 'erase', label: 'Eraser', icon: <Eraser className="size-4" /> },
]

const HISTORY = 60

/**
 * The campaign's sketch pad, over the whole screen: scribble a rough layout
 * and show it to the players when it's ready. One pad, like a whiteboard: it
 * stays until it's cleared.
 */
export function SketchPad({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const stored = useLiveQuery(async () => (await db.campaigns.get(campaign.id))?.sketch ?? emptySketch(), [campaign.id])
  const sketch: Sketch = stored ?? emptySketch()
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(SKETCH_COLORS[0].color)
  const [draft, setDraft] = useState<SketchStroke | null>(null)
  const [label, setLabel] = useState<{ x: number; y: number; text: string } | null>(null)
  const [undo, setUndo] = useState<SketchStroke[][]>([])
  const [redo, setRedo] = useState<SketchStroke[][]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [width, setWidth] = useState(800)
  const svg = useRef<SVGSVGElement>(null)
  // While the eraser is held down; a ref, so every move sees it at once.
  const erasing = useRef(false)
  const area = useRef<HTMLDivElement>(null)

  // Fit the pad to the screen, keeping its shape.
  useEffect(() => {
    const el = area.current
    if (!el) return
    const fit = () =>
      setWidth(Math.max(280, Math.min(el.clientWidth - 16, ((el.clientHeight - 16) * SKETCH_WIDTH) / 700)))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Change the strokes as stored now, keeping undo history. */
  const commit = (change: (strokes: SketchStroke[]) => SketchStroke[]) =>
    void changeSketch(campaign.id, (s) => {
      setUndo((u) => [...u.slice(-HISTORY + 1), s.strokes])
      setRedo([])
      return { ...s, strokes: change(s.strokes) }
    })
  const step = (from: SketchStroke[][], setFrom: typeof setUndo, setTo: typeof setUndo) => {
    const previous = from.at(-1)
    if (!previous) return
    setFrom(from.slice(0, -1))
    void changeSketch(campaign.id, (s) => {
      setTo((t) => [...t, s.strokes])
      return { ...s, strokes: previous }
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        if (label) setLabel(null)
        else onClose()
        return
      }
      if (e.target instanceof HTMLInputElement) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) step(redo, setRedo, setUndo)
        else step(undo, setUndo, setRedo)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const toPad = (e: React.PointerEvent): [number, number] => {
    const ctm = svg.current?.getScreenCTM()
    if (!ctm) return [0, 0]
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return [Math.round(p.x), Math.round(p.y)]
  }
  const eraseAt = (x: number, y: number) => {
    if (sketch.strokes.some((s) => touches(s, x, y))) commit((strokes) => strokes.filter((s) => !touches(s, x, y)))
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const [x, y] = toPad(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'text') setLabel({ x, y, text: '' })
    else if (tool === 'erase') {
      erasing.current = true
      eraseAt(x, y)
    } else {
      const points = tool === 'pen' ? [x, y] : [x, y, x, y]
      setDraft(SketchStrokeSchema.parse({ kind: tool, color, points }))
    }
  }
  const follow = (stroke: SketchStroke, x: number, y: number): SketchStroke =>
    stroke.kind === 'pen'
      ? { ...stroke, points: addPoint(stroke.points, x, y) }
      : { ...stroke, points: [stroke.points[0], stroke.points[1], x, y] }
  const onMove = (e: React.PointerEvent) => {
    const [x, y] = toPad(e)
    if (draft) setDraft(follow(draft, x, y))
    else if (erasing.current) eraseAt(x, y)
  }
  const onUp = (e: React.PointerEvent) => {
    erasing.current = false
    if (!draft) return
    const [x, y] = toPad(e)
    const done = follow(draft, x, y)
    setDraft(null)
    const p = done.points
    // A click with the line or box tool drew nothing.
    if (done.kind !== 'pen' && p[0] === p[2] && p[1] === p[3]) return
    commit((strokes) => [...strokes, done])
  }

  const show = async (on: boolean) => {
    setBusy(true)
    setError('')
    try {
      await publishSketch(campaign, on ? sketch.strokes : null)
      await changeSketch(campaign.id, (s) => ({
        ...s,
        shown: on ? JSON.stringify(sketch.strokes) : '',
        shownAt: on ? new Date().toISOString() : '',
      }))
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      setError(
        /permission/i.test(text)
          ? 'The server refused: only the device that made the campaign can show things to the players.'
          : text,
      )
    } finally {
      setBusy(false)
    }
  }
  const shown = !!sketch.shown
  const changed = changedSinceShown(sketch)

  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col bg-bg" role="dialog" aria-label="Sketch pad">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2">
        <span className="mr-1 hidden font-display text-lg sm:inline">Sketch · {campaign.name}</span>
        <div className="flex gap-1" role="toolbar" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`btn h-9 gap-1 px-2 text-xs ${tool === t.id ? 'border-accent bg-accent/15 text-accent' : ''}`}
              onClick={() => setTool(t.id)}
              aria-pressed={tool === t.id}
              title={t.label}
            >
              {t.icon} <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1" aria-label="Color">
          {SKETCH_COLORS.map((c) => (
            <button
              key={c.color}
              className={`size-7 rounded-full border-2 ${color === c.color ? 'border-white' : 'border-transparent'}`}
              style={{ background: c.color }}
              onClick={() => setColor(c.color)}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>
        <button
          className="btn size-9 p-0"
          onClick={() => step(undo, setUndo, setRedo)}
          disabled={!undo.length}
          aria-label="Undo"
          title="Undo (⌘Z)"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          className="btn size-9 p-0"
          onClick={() => step(redo, setRedo, setUndo)}
          disabled={!redo.length}
          aria-label="Redo"
          title="Redo (⇧⌘Z)"
        >
          <Redo2 className="size-4" />
        </button>
        <button
          className="btn size-9 p-0 text-danger"
          onClick={() => sketch.strokes.length && commit(() => [])}
          disabled={!sketch.strokes.length}
          aria-label="Clear the pad"
          title="Clear the pad (you can undo it)"
        >
          <Trash2 className="size-4" />
        </button>
        <span className="mx-auto" />
        {shown ? (
          <>
            <button
              className="btn btn-primary h-9 px-3 text-xs"
              onClick={() => void show(true)}
              disabled={busy || !changed}
              title={changed ? 'Send what you’ve drawn since' : 'Players see the pad as it is'}
            >
              <Send className="size-4" /> {changed ? 'Update players' : 'Players see it'}
            </button>
            <button className="btn h-9 px-3 text-xs" onClick={() => void show(false)} disabled={busy}>
              <EyeOff className="size-4" /> Hide
            </button>
          </>
        ) : (
          <button
            className="btn h-9 px-3 text-xs"
            onClick={() => void show(true)}
            disabled={busy || !sketch.strokes.length}
            title="Send the pad as it is to the players’ Play tabs"
          >
            <Eye className="size-4" /> Show to players
          </button>
        )}
        <button className="btn h-9 px-3 text-xs" onClick={onClose} title="Close (Esc)">
          <X className="size-4" /> Done
        </button>
      </div>
      {error && <p className="border-b border-line px-3 py-1.5 text-xs text-danger">{error}</p>}
      <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <div className="overflow-hidden rounded-lg border border-line">
          <SketchCanvas
            ref={svg}
            strokes={sketch.strokes}
            draft={draft}
            width={width}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            style={{ cursor: tool === 'erase' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
          />
        </div>
        {label && (
          <form
            className="absolute inset-x-0 bottom-4 mx-auto flex w-80 max-w-[90%] gap-2 rounded-lg border border-line bg-surface p-2 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              const text = label.text.trim()
              if (text) {
                const stroke = SketchStrokeSchema.parse({ kind: 'text', color, points: [label.x, label.y], text })
                commit((strokes) => [...strokes, stroke])
              }
              setLabel(null)
            }}
          >
            <input
              {...noAutofill}
              className="input min-w-0 flex-1 py-1"
              placeholder="Door, Bar, Stairs up…"
              value={label.text}
              onChange={(e) => setLabel({ ...label, text: e.target.value })}
              autoFocus
            />
            <button className="btn btn-primary py-1 text-xs">Add</button>
          </form>
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
        {shown
          ? changed
            ? 'You’ve drawn more since the players got it: press Update players to send it.'
            : 'The players see this sketch on their Play tab.'
          : 'Players see nothing until you press Show to players.'}
      </p>
    </div>,
    document.body,
  )
}
