import {
  Circle,
  Eraser,
  Eye,
  EyeOff,
  Hand,
  Minus,
  Plus,
  Redo2,
  Ruler,
  Settings2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import type { Encounter, Participant } from '../model/encounter'
import {
  cellOf,
  clampTo,
  isUseful,
  MAP_COLORS,
  MapShapeSchema,
  moveShape,
  newMap,
  placeToken,
  snapCorner,
  snapHalf,
  type BattleMap,
  type MapShape,
  type TokenView,
} from './battleMap'
import { MapCanvas, type Measure } from './MapCanvas'
import { tokenViews } from './tokens'

type Tool = 'move' | 'wall' | 'rect' | 'circle' | 'text' | 'measure' | 'erase'

const TOOLS: { id: Tool; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    id: 'move',
    label: 'Move',
    icon: <Hand className="size-4" />,
    hint: 'Drag tokens and shapes. Click a shape, then Delete to remove it.',
  },
  {
    id: 'wall',
    label: 'Wall',
    icon: <Minus className="size-4 rotate-45" />,
    hint: 'Drag along the grid lines to draw a wall.',
  },
  {
    id: 'rect',
    label: 'Area',
    icon: <Square className="size-4" />,
    hint: 'Drag from corner to corner: a building, cover, water.',
  },
  {
    id: 'circle',
    label: 'Circle',
    icon: <Circle className="size-4" />,
    hint: 'Drag from the middle outwards: a blast, a tree, a pillar.',
  },
  { id: 'text', label: 'Label', icon: <Type className="size-4" />, hint: 'Click where the label goes.' },
  {
    id: 'measure',
    label: 'Measure',
    icon: <Ruler className="size-4" />,
    hint: 'Drag to measure: meters and range band.',
  },
  { id: 'erase', label: 'Erase', icon: <Eraser className="size-4" />, hint: 'Click a shape or token to remove it.' },
]

const HISTORY = 60

/**
 * The GM's battle mat for an encounter, over the whole screen: draw walls,
 * areas, circles and labels on a grid, put the combatants on it, measure
 * distances, and show it to the players.
 */
export function MapEditor({
  encounter,
  update,
  characterIdOf,
  canShow,
  onClose,
}: {
  encounter: Encounter
  update: (change: (e: Encounter) => Encounter) => void
  characterIdOf: (p: Participant) => string | undefined
  /** The encounter belongs to a campaign, so players can be shown the map. */
  canShow: boolean
  onClose: () => void
}) {
  const map = encounter.map ?? newMap()
  const [tool, setTool] = useState<Tool>('wall')
  const [color, setColor] = useState('stone')
  const [cell, setCell] = useState(32)
  const [preview, setPreview] = useState<MapShape | null>(null)
  const [measure, setMeasure] = useState<Measure | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [placing, setPlacing] = useState<string | null>(null)
  const [label, setLabel] = useState<{ x: number; y: number; text: string } | null>(null)
  const [settings, setSettings] = useState(false)
  const [undo, setUndo] = useState<BattleMap[]>([])
  const [redo, setRedo] = useState<BattleMap[]>([])
  // While dragging a token or shape: what, from where, and where it is now.
  const [drag, setDrag] = useState<{
    kind: 'token' | 'shape'
    id: string
    x0: number
    y0: number
    x: number
    y: number
  } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  /** Change the map as stored now (quick clicks build on each other), keeping undo history. */
  const commit = useCallback(
    (change: (m: BattleMap) => BattleMap) => {
      update((e) => {
        const before = e.map ?? newMap()
        setUndo((u) => [...u.slice(-HISTORY + 1), before])
        setRedo([])
        return { ...e, map: change(before) }
      })
    },
    [update],
  )
  const step = (from: BattleMap[], to: (fn: (s: BattleMap[]) => BattleMap[]) => void, setFrom: typeof setUndo) => {
    const previous = from.at(-1)
    if (!previous) return
    setFrom(from.slice(0, -1))
    update((e) => {
      const current = e.map ?? newMap()
      to((s) => [...s, current])
      // Keep whether it's shown as it is now; undo is about the drawing.
      return { ...e, map: { ...previous, shown: current.shown } }
    })
  }
  const doUndo = () => step(undo, setRedo, setUndo)
  const doRedo = () => step(redo, setUndo, setRedo)

  // Fit the map to the screen when it opens.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const fit = Math.floor(Math.min((el.clientWidth - 16) / map.cols, (el.clientHeight - 16) / map.rows))
    setCell(Math.max(14, Math.min(48, fit)))
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement
      if (e.key === 'Escape') {
        // Close the editor, not whatever is behind it.
        e.stopImmediatePropagation()
        if (label) setLabel(null)
        else if (placing) setPlacing(null)
        else onClose()
        return
      }
      if (typing) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) doRedo()
        else doUndo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault()
        commit((m) => ({ ...m, shapes: m.shapes.filter((s) => s.id !== selected) }))
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const toGrid = (e: React.PointerEvent): [number, number] => {
    const el = svg.current
    const ctm = el?.getScreenCTM()
    if (!el || !ctm) return [0, 0]
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return clampTo(map, p.x, p.y)
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const [x, y] = toGrid(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    setMeasure(null)
    if (placing) {
      const who = placing
      commit((m) => placeToken(m, who, x, y))
      // Ready for the next one still off the map.
      const next = encounter.participants.find((p) => p.id !== placing && !map.tokens.some((t) => t.id === p.id))
      setPlacing(next?.id ?? null)
      return
    }
    const base = { color, text: '' }
    if (tool === 'wall' || tool === 'rect') {
      const [cx, cy] = [snapCorner(x), snapCorner(y)]
      setPreview(MapShapeSchema.parse({ ...base, kind: tool, x1: cx, y1: cy, x2: cx, y2: cy }))
    } else if (tool === 'circle') {
      const [cx, cy] = [snapHalf(x), snapHalf(y)]
      setPreview(MapShapeSchema.parse({ ...base, kind: 'circle', x1: cx, y1: cy, x2: cx, y2: cy }))
    } else if (tool === 'text') {
      setLabel({ x: snapHalf(x), y: snapHalf(y), text: '' })
    } else if (tool === 'measure') {
      setMeasure({ x1: cellOf(x) + 0.5, y1: cellOf(y) + 0.5, x2: cellOf(x) + 0.5, y2: cellOf(y) + 0.5 })
    } else if (tool === 'move') {
      setSelected(null)
    }
  }

  /** Where the shape being drawn, the drag or the measure ends up with the pointer at (x, y). */
  const follow = (x: number, y: number) => {
    let nextPreview = preview
    if (preview) {
      const snap = preview.kind === 'circle' ? snapHalf : snapCorner
      let [x2, y2] = [snap(x), snap(y)]
      // Walls run along grid lines or diagonals; keep them straight when nearly so.
      if (preview.kind === 'wall') {
        const dx = Math.abs(x2 - preview.x1)
        const dy = Math.abs(y2 - preview.y1)
        if (dx < dy / 3) x2 = preview.x1
        else if (dy < dx / 3) y2 = preview.y1
      }
      nextPreview = { ...preview, x2, y2 }
    }
    const nextDrag = drag ? { ...drag, x, y } : null
    const nextMeasure = measure ? { ...measure, x2: cellOf(x) + 0.5, y2: cellOf(y) + 0.5 } : null
    return { preview: nextPreview, drag: nextDrag, measure: nextMeasure }
  }

  const onMove = (e: React.PointerEvent) => {
    if (!preview && !drag && !(measure && e.buttons)) return
    const [x, y] = toGrid(e)
    const next = follow(x, y)
    if (preview) setPreview(next.preview)
    else if (drag) setDrag(next.drag)
    else setMeasure(next.measure)
  }

  // The release point counts too: a quick drag may end without a last move.
  const onUp = (e: React.PointerEvent) => {
    const [x, y] = toGrid(e)
    const next = follow(x, y)
    if (next.preview) {
      const shape = next.preview
      if (isUseful(shape)) commit((m) => ({ ...m, shapes: [...m.shapes, shape] }))
      setPreview(null)
    }
    if (next.drag) {
      const d = next.drag
      if (d.kind === 'token') commit((m) => placeToken(m, d.id, d.x, d.y))
      else {
        const dx = Math.round(d.x - d.x0)
        const dy = Math.round(d.y - d.y0)
        if (dx || dy) commit((m) => ({ ...m, shapes: m.shapes.map((s) => (s.id === d.id ? moveShape(s, dx, dy) : s)) }))
      }
      setDrag(null)
    }
    if (measure && !preview && !drag) setMeasure(next.measure)
  }

  const onShapeDown = (shape: MapShape, e: React.PointerEvent) => {
    if (tool === 'erase') {
      e.stopPropagation()
      commit((m) => ({ ...m, shapes: m.shapes.filter((s) => s.id !== shape.id) }))
    } else if (tool === 'move' && !placing) {
      e.stopPropagation()
      svg.current?.setPointerCapture(e.pointerId)
      const [x, y] = toGrid(e)
      setSelected(shape.id)
      setDrag({ kind: 'shape', id: shape.id, x0: x, y0: y, x, y })
    }
  }

  const onTokenDown = (token: TokenView, e: React.PointerEvent) => {
    if (tool === 'erase') {
      e.stopPropagation()
      commit((m) => ({ ...m, tokens: m.tokens.filter((t) => t.id !== token.id) }))
    } else if (tool === 'move' && !placing) {
      e.stopPropagation()
      svg.current?.setPointerCapture(e.pointerId)
      const [x, y] = toGrid(e)
      setDrag({ kind: 'token', id: token.id, x0: x, y0: y, x, y })
    }
  }

  // What's drawn: shapes and tokens as they'd be after the current drag.
  let shown = map
  if (drag?.kind === 'shape') {
    const dx = Math.round(drag.x - drag.x0)
    const dy = Math.round(drag.y - drag.y0)
    shown = { ...map, shapes: map.shapes.map((s) => (s.id === drag.id ? moveShape(s, dx, dy) : s)) }
  }
  let tokens = tokenViews({ ...encounter, map }, characterIdOf)
  if (drag?.kind === 'token') tokens = tokens.map((t) => (t.id === drag.id ? { ...t, x: drag.x, y: drag.y } : t))

  const offMap = encounter.participants.filter((p) => !map.tokens.some((t) => t.id === p.id))
  const onMap = encounter.participants.filter((p) => map.tokens.some((t) => t.id === p.id))
  const hint = placing
    ? `Click a square for ${encounter.participants.find((p) => p.id === placing)?.name ?? 'them'} (Esc to stop).`
    : TOOLS.find((t) => t.id === tool)?.hint

  const setSize = (change: Partial<Pick<BattleMap, 'cols' | 'rows' | 'meters'>>) => commit((m) => ({ ...m, ...change }))

  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col bg-bg" role="dialog" aria-label="Battle map">
      {/* Top bar: tools, colors, undo, zoom, show, close. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2">
        <span className="mr-1 hidden font-display text-lg sm:inline">Map · {encounter.name}</span>
        <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`btn h-9 gap-1 px-2 text-xs ${tool === t.id && !placing ? 'border-accent bg-accent/15 text-accent' : ''}`}
              onClick={() => {
                setTool(t.id)
                setPlacing(null)
                setSelected(null)
              }}
              title={t.hint}
              aria-pressed={tool === t.id}
            >
              {t.icon} <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1" aria-label="Color">
          {MAP_COLORS.map((c) => (
            <button
              key={c.id}
              className={`size-7 rounded-full border-2 ${color === c.id ? 'border-white' : 'border-transparent'}`}
              style={{ background: c.stroke }}
              onClick={() => setColor(c.id)}
              title={c.label}
              aria-label={c.label}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button
            className="btn size-9 p-0"
            onClick={doUndo}
            disabled={!undo.length}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            className="btn size-9 p-0"
            onClick={doRedo}
            disabled={!redo.length}
            title="Redo (⇧⌘Z)"
            aria-label="Redo"
          >
            <Redo2 className="size-4" />
          </button>
          <button className="btn size-9 p-0" onClick={() => setCell(Math.max(10, cell - 6))} aria-label="Zoom out">
            <Minus className="size-4" />
          </button>
          <button className="btn size-9 p-0" onClick={() => setCell(Math.min(90, cell + 6))} aria-label="Zoom in">
            <Plus className="size-4" />
          </button>
          <button
            className={`btn size-9 p-0 ${settings ? 'border-accent text-accent' : ''}`}
            onClick={() => setSettings(!settings)}
            aria-label="Map settings"
            title="Size and scale"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
        <span className="mx-auto" />
        {canShow && (
          <button
            className={`btn h-9 px-3 text-xs ${map.shown ? 'btn-primary' : ''}`}
            onClick={() => update((e) => ({ ...e, map: { ...(e.map ?? newMap()), shown: !(e.map?.shown ?? false) } }))}
            title={map.shown ? 'Players see this map live; click to hide it' : 'Show this map to the players, live'}
          >
            {map.shown ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {map.shown ? 'Players see it' : 'Show to players'}
          </button>
        )}
        <button className="btn h-9 px-3 text-xs" onClick={onClose} title="Close (Esc)">
          <X className="size-4" /> Done
        </button>
      </div>

      {settings && (
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2 text-xs">
          <SizeInput label="Columns" value={map.cols} min={4} max={80} onChange={(cols) => setSize({ cols })} />
          <SizeInput label="Rows" value={map.rows} min={4} max={80} onChange={(rows) => setSize({ rows })} />
          <label>
            <div className="mb-1 text-muted">1 square is</div>
            <select
              {...noAutofillField}
              className="input py-1"
              value={map.meters}
              onChange={(e) => setSize({ meters: Number(e.target.value) })}
            >
              {[1, 1.5, 2, 3, 5, 10].map((m) => (
                <option key={m} value={m}>
                  {m} m
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn ml-auto py-1 text-xs text-danger"
            onClick={() => {
              if (confirm('Clear all shapes from the map? Tokens stay. You can undo this.'))
                commit((m) => ({ ...m, shapes: [] }))
            }}
          >
            <Trash2 className="size-3.5" /> Clear drawing
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Combatants: tap one, then a square, to put them on the map. */}
        <aside className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line p-2 text-xs md:w-48 md:flex-col md:overflow-y-auto md:border-r md:border-b-0">
          <div className="hidden text-muted md:block">Tap someone, then a square</div>
          {encounter.participants.length === 0 && (
            <div className="text-muted">Add combatants to the encounter first.</div>
          )}
          {[...offMap, ...onMap].map((p) => {
            const placed = onMap.includes(p)
            return (
              <button
                key={p.id}
                className={`chip shrink-0 cursor-pointer justify-start ${placing === p.id ? 'border-accent bg-accent/15 text-accent' : placed ? 'text-muted' : ''}`}
                onClick={() => setPlacing(placing === p.id ? null : p.id)}
                title={placed ? 'On the map; tap, then a square, to move' : 'Tap, then a square, to place'}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: p.kind === 'runner' ? '#3ee8b5' : p.kind === 'spirit' ? '#ffb547' : '#ff5c7a' }}
                />
                <span className="truncate">{p.name}</span>
                {placed && <span className="ml-auto text-[10px]">on map</span>}
              </button>
            )
          })}
        </aside>

        <div className="relative min-h-0 flex-1">
          <div className="pointer-events-none absolute top-2 left-2 z-10 rounded bg-bg/85 px-2 py-1 text-xs text-muted">
            {hint}
          </div>
          <div ref={scroller} className="h-full overflow-auto p-2">
            <MapCanvas
              ref={svg}
              map={shown}
              tokens={tokens}
              cell={cell}
              preview={preview}
              measure={measure}
              selected={selected}
              onShapeDown={onShapeDown}
              onTokenDown={onTokenDown}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              style={{ cursor: placing ? 'copy' : tool === 'move' ? 'default' : 'crosshair' }}
            />
          </div>
          {label && (
            <form
              className="absolute inset-x-0 bottom-3 z-20 mx-auto flex w-80 max-w-[90%] gap-2 rounded-lg border border-line bg-surface p-2 shadow-xl"
              onSubmit={(e) => {
                e.preventDefault()
                const shape = MapShapeSchema.parse({
                  kind: 'text',
                  x1: label.x,
                  y1: label.y,
                  x2: label.x,
                  y2: label.y,
                  color,
                  text: label.text.trim(),
                })
                if (isUseful(shape)) commit((m) => ({ ...m, shapes: [...m.shapes, shape] }))
                setLabel(null)
              }}
            >
              <input
                {...noAutofill}
                className="input min-w-0 flex-1 py-1"
                placeholder="Label: Door, Loading dock…"
                value={label.text}
                onChange={(e) => setLabel({ ...label, text: e.target.value })}
                autoFocus
              />
              <button className="btn btn-primary py-1 text-xs">Add</button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SizeInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 text-muted">{label}</div>
      <div className="flex items-center gap-1">
        <button
          className="btn size-7 p-0"
          onClick={() => onChange(Math.max(min, value - 2))}
          aria-label={`Fewer ${label}`}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-7 text-center tabular-nums">{value}</span>
        <button
          className="btn size-7 p-0"
          onClick={() => onChange(Math.min(max, value + 2))}
          aria-label={`More ${label}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
