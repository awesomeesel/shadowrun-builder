import { forwardRef } from 'react'
import { SKETCH_HEIGHT, SKETCH_WIDTH, type SketchStroke } from './sketch'

/** A sketch, scaled to `width` pixels across, on a faint grid. */
export const SketchCanvas = forwardRef<
  SVGSVGElement,
  { strokes: SketchStroke[]; width: number; draft?: SketchStroke | null } & Omit<React.SVGProps<SVGSVGElement>, 'ref'>
>(function SketchCanvas({ strokes, width, draft, ...rest }, ref) {
  const grid: React.ReactNode[] = []
  for (let x = 50; x < SKETCH_WIDTH; x += 50) grid.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={SKETCH_HEIGHT} />)
  for (let y = 50; y < SKETCH_HEIGHT; y += 50) grid.push(<line key={`h${y}`} x1={0} y1={y} x2={SKETCH_WIDTH} y2={y} />)
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}
      width={width}
      height={(width * SKETCH_HEIGHT) / SKETCH_WIDTH}
      className="block touch-none select-none"
      {...rest}
    >
      <rect width={SKETCH_WIDTH} height={SKETCH_HEIGHT} className="fill-bg" />
      <g className="stroke-line/40" strokeWidth={1}>
        {grid}
      </g>
      {[...strokes, ...(draft ? [draft] : [])].map((s) => (
        <Stroke key={s.id} stroke={s} />
      ))}
    </svg>
  )
})

function Stroke({ stroke: s }: { stroke: SketchStroke }) {
  const p = s.points
  const line = {
    stroke: s.color,
    strokeWidth: 4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }
  switch (s.kind) {
    case 'pen':
      return p.length <= 2 ? (
        <circle cx={p[0]} cy={p[1]} r={2.5} fill={s.color} />
      ) : (
        <polyline points={p.join(' ')} {...line} />
      )
    case 'line':
      return <line x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} {...line} />
    case 'box':
      return (
        <rect
          x={Math.min(p[0], p[2])}
          y={Math.min(p[1], p[3])}
          width={Math.abs(p[2] - p[0])}
          height={Math.abs(p[3] - p[1])}
          {...line}
          fill={s.color}
          fillOpacity={0.08}
        />
      )
    case 'text':
      return (
        <text
          x={p[0]}
          y={p[1]}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={24}
          fontWeight={600}
          fill={s.color}
          stroke="#0a0d14"
          strokeWidth={4}
          paintOrder="stroke"
        >
          {s.text}
        </text>
      )
  }
}
