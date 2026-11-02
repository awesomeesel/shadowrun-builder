import { forwardRef } from 'react'
import { colorOf, meters, rangeBand, type BattleMap, type MapShape, type TokenView } from './battleMap'
import { initials } from './tokens'

const SIDE_COLOR: Record<TokenView['side'], string> = {
  runner: '#3ee8b5',
  enemy: '#ff5c7a',
  other: '#ffb547',
}

export interface Measure {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Draws a battle map: grid, shapes, tokens, and (in the editor) the shape
 * being drawn and a measuring line. One unit of the drawing is one square;
 * `cell` sets how many pixels that is.
 */
export const MapCanvas = forwardRef<
  SVGSVGElement,
  {
    map: BattleMap
    tokens: TokenView[]
    cell: number
    preview?: MapShape | null
    measure?: Measure | null
    selected?: string | null
    /** A player's own character: their token gets a white ring. */
    ownCharacterId?: string
    onShapeDown?: (shape: MapShape, e: React.PointerEvent) => void
    onTokenDown?: (token: TokenView, e: React.PointerEvent) => void
  } & Omit<React.SVGProps<SVGSVGElement>, 'ref'>
>(function MapCanvas(
  { map, tokens, cell, preview, measure, selected, ownCharacterId, onShapeDown, onTokenDown, ...rest },
  ref,
) {
  const lines: React.ReactNode[] = []
  for (let x = 0; x <= map.cols; x++) {
    lines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={map.rows} className={x % 5 ? 'stroke-line/50' : 'stroke-line'} />,
    )
  }
  for (let y = 0; y <= map.rows; y++) {
    lines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={map.cols} y2={y} className={y % 5 ? 'stroke-line/50' : 'stroke-line'} />,
    )
  }
  const drawn = preview ? [...map.shapes, preview] : map.shapes
  const m = measure ? meters(map, measure.x1, measure.y1, measure.x2, measure.y2) : 0

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${map.cols} ${map.rows}`}
      width={map.cols * cell}
      height={map.rows * cell}
      className="block touch-none select-none"
      {...rest}
    >
      <rect x={0} y={0} width={map.cols} height={map.rows} className="fill-bg" />
      <g strokeWidth={0.03}>{lines}</g>

      {drawn.map((s) => (
        <Shape
          key={s.id}
          shape={s}
          selected={s.id === selected}
          faint={s === preview}
          onPointerDown={onShapeDown ? (e) => onShapeDown(s, e) : undefined}
        />
      ))}

      {tokens.map((t) => {
        const color = SIDE_COLOR[t.side]
        const own = !!ownCharacterId && t.characterId === ownCharacterId
        return (
          <g
            key={t.id}
            transform={`translate(${t.x} ${t.y})`}
            opacity={t.out ? 0.35 : 1}
            onPointerDown={onTokenDown ? (e) => onTokenDown(t, e) : undefined}
            className={onTokenDown ? 'cursor-grab' : undefined}
          >
            {t.active && <circle r={0.5} fill="none" stroke="#ffffff" strokeWidth={0.07} strokeDasharray="0.15 0.1" />}
            {own && <circle r={0.48} fill="none" stroke="#ffffff" strokeWidth={0.1} />}
            <circle r={0.4} fill={color} fillOpacity={0.9} stroke="#0a0d14" strokeWidth={0.05} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.34}
              fontWeight={700}
              fill="#0a0d14"
              style={{ pointerEvents: 'none' }}
            >
              {initials(t.name)}
            </text>
            {t.out && <path d="M-0.28 -0.28 L0.28 0.28 M0.28 -0.28 L-0.28 0.28" stroke="#0a0d14" strokeWidth={0.08} />}
            <text
              y={0.72}
              textAnchor="middle"
              fontSize={0.26}
              className="fill-fg"
              stroke="#0a0d14"
              strokeWidth={0.06}
              paintOrder="stroke"
              style={{ pointerEvents: 'none' }}
            >
              {t.name.length > 14 ? `${t.name.slice(0, 13)}…` : t.name}
            </text>
          </g>
        )
      })}

      {measure && (
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={measure.x1}
            y1={measure.y1}
            x2={measure.x2}
            y2={measure.y2}
            stroke="#ffffff"
            strokeWidth={0.06}
            strokeDasharray="0.2 0.12"
          />
          <circle cx={measure.x1} cy={measure.y1} r={0.12} fill="#ffffff" />
          <text
            x={measure.x2}
            y={measure.y2 - 0.35}
            textAnchor="middle"
            fontSize={0.42}
            fontWeight={700}
            fill="#ffffff"
            stroke="#0a0d14"
            strokeWidth={0.1}
            paintOrder="stroke"
          >
            {`${Math.round(m * 10) / 10} m · ${rangeBand(m)}`}
          </text>
        </g>
      )}
    </svg>
  )
})

function Shape({
  shape: s,
  selected,
  faint,
  onPointerDown,
}: {
  shape: MapShape
  selected: boolean
  faint: boolean
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  const c = colorOf(s.color)
  const common = {
    onPointerDown,
    opacity: faint ? 0.7 : 1,
    className: onPointerDown ? 'cursor-pointer' : undefined,
  }
  const outline = selected ? { stroke: '#ffffff', strokeDasharray: '0.15 0.1' } : {}
  switch (s.kind) {
    case 'wall':
      return (
        <g {...common}>
          {/* A wider invisible line makes thin walls easy to grab. */}
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={0.6} />
          <line
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={selected ? '#ffffff' : c.stroke}
            strokeWidth={0.22}
            strokeLinecap="round"
          />
        </g>
      )
    case 'rect':
      return (
        <rect
          {...common}
          x={Math.min(s.x1, s.x2)}
          y={Math.min(s.y1, s.y2)}
          width={Math.abs(s.x2 - s.x1)}
          height={Math.abs(s.y2 - s.y1)}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={0.08}
          {...outline}
        />
      )
    case 'circle':
      return (
        <circle
          {...common}
          cx={s.x1}
          cy={s.y1}
          r={Math.hypot(s.x2 - s.x1, s.y2 - s.y1)}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={0.08}
          {...outline}
        />
      )
    case 'text':
      return (
        <text
          {...common}
          x={s.x1}
          y={s.y1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={0.5}
          fontWeight={600}
          fill={selected ? '#ffffff' : c.stroke}
          stroke="#0a0d14"
          strokeWidth={0.08}
          paintOrder="stroke"
        >
          {s.text}
        </text>
      )
  }
}
