import { useId } from 'react'
import type { MetatypeId } from '../rules/sr6/metatypes'
import { METATYPE_COLORS } from './metatypeColors'

/** App logo: a hexagon with a stylised eye. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-neon)" />
        </linearGradient>
      </defs>
      <path d="M24 3 42 13.5v21L24 45 6 34.5v-21Z" fill="none" stroke={`url(#${id})`} strokeWidth="2.5" />
      <path
        d="M12 24c4-6.5 8-9 12-9s8 2.5 12 9c-4 6.5-8 9-12 9s-8-2.5-12-9Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
      />
      <circle cx="24" cy="24" r="4.5" fill={`url(#${id})`} />
      <path d="M24 9v4M24 35v4" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Building outlines for the skyline: [x, width, height]. Windows are drawn on a grid inside each.
const BUILDINGS: [number, number, number][] = [
  [0, 46, 70],
  [40, 30, 110],
  [66, 52, 86],
  [112, 26, 140],
  [134, 44, 96],
  [174, 36, 160],
  [206, 58, 118],
  [258, 28, 76],
  [282, 40, 132],
  [318, 64, 92],
  [378, 30, 150],
  [404, 48, 104],
  [448, 26, 72],
  [470, 54, 128],
  [520, 34, 170],
  [550, 46, 90],
  [592, 30, 116],
  [618, 58, 80],
  [672, 36, 138],
  [704, 50, 98],
  [750, 50, 120],
]

/** Night-time city skyline with neon-lit windows. Purely decorative. */
export function Skyline({ className = '' }: { className?: string }) {
  const id = useId()
  const windows: [number, number, string][] = []
  BUILDINGS.forEach(([x, w, h], b) => {
    for (let wy = 200 - h + 10; wy < 192; wy += 12) {
      for (let wx = x + 6; wx < x + w - 6; wx += 10) {
        // Deterministic pseudo-random pattern so the skyline doesn't flicker between renders.
        const n = (wx * 7 + wy * 13 + b * 31) % 17
        if (n < 4) windows.push([wx, wy, n % 2 ? 'var(--color-accent)' : 'var(--color-neon)'])
        else if (n < 6) windows.push([wx, wy, 'var(--color-amber)'])
      }
    }
  })
  return (
    <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-neon)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--color-neon)" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`${id}-bld`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2335" />
          <stop offset="1" stopColor="#0a0d14" />
        </linearGradient>
      </defs>
      <rect width="800" height="200" fill={`url(#${id}-sky)`} />
      {BUILDINGS.map(([x, w, h]) => (
        <rect
          key={x}
          x={x}
          y={200 - h}
          width={w}
          height={h}
          fill={`url(#${id}-bld)`}
          stroke="#243046"
          strokeWidth="1"
        />
      ))}
      {windows.map(([x, y, color], i) => (
        <rect key={i} x={x} y={y} width="4" height="5" fill={color} opacity="0.75" />
      ))}
      <path d="M174 40v-8M378 50v-10M520 30v-12" stroke="var(--color-neon)" strokeWidth="2" />
      <circle cx="174" cy="31" r="2" fill="var(--color-neon)" />
      <circle cx="520" cy="17" r="2" fill="var(--color-accent)" />
    </svg>
  )
}

/** A stylised head for each metatype: ears, beard, tusks or horns on a shared silhouette. */
export function MetatypeEmblem({ metatype, className = 'size-full' }: { metatype: MetatypeId; className?: string }) {
  const id = useId()
  const color = METATYPE_COLORS[metatype]
  const wide = metatype === 'troll' || metatype === 'dwarf'
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {metatype === 'troll' && (
        <path
          d="M22 21C14 15 12 7 17 2c0 8 4 12 9 15ZM42 21c8-6 10-14 5-19 0 8-4 12-9 15Z"
          fill={color}
          opacity="0.8"
        />
      )}
      {(metatype === 'elf' || metatype === 'ork') && (
        <path
          d={metatype === 'elf' ? 'M20 28 8 17l11 16ZM44 28l12-11-11 16Z' : 'M20 29l-7-6 7 11ZM44 29l7-6-7 11Z'}
          fill={color}
          opacity="0.85"
        />
      )}
      <path d="M12 64c2-13 10-18 20-18s18 5 20 18Z" fill={`url(#${id})`} />
      <ellipse cx="32" cy="29" rx={wide ? 15 : 13} ry={metatype === 'dwarf' ? 13 : 15} fill={`url(#${id})`} />
      {metatype === 'dwarf' && <path d="M19 32q13 26 26 0-13 9-26 0Z" fill={color} opacity="0.9" />}
      {/* Visor-like eyes give the cyberpunk look. */}
      <rect x="23" y="26" width="7" height="2.5" rx="1" fill="#0a0d14" />
      <rect x="34" y="26" width="7" height="2.5" rx="1" fill="#0a0d14" />
      <rect x="24" y="26.5" width="3" height="1.5" fill="var(--color-accent)" />
      {metatype === 'ork' && <path d="M26 40l-2-6 4 5ZM38 40l2-6-4 5Z" fill="#e6edf3" />}
      {metatype === 'troll' && <path d="M25 41l-2-7 4 6ZM39 41l2-7-4 6Z" fill="#e6edf3" />}
    </svg>
  )
}

/** Character portrait: the uploaded picture, or the metatype emblem on a tinted backdrop. */
export function Portrait({
  src,
  metatype,
  className = 'size-14',
}: {
  src?: string
  metatype: MetatypeId
  className?: string
}) {
  const color = METATYPE_COLORS[metatype]
  if (src) return <img src={src} alt="" className={`${className} shrink-0 rounded-lg object-cover ring-1 ring-line`} />
  return (
    <div
      className={`${className} shrink-0 overflow-hidden rounded-lg ring-1 ring-line`}
      style={{ background: `radial-gradient(circle at 50% 30%, ${color}33, transparent 70%), #0d121c` }}
    >
      <MetatypeEmblem metatype={metatype} />
    </div>
  )
}
